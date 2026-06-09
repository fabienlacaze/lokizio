# Stripe Connect — Architecture Lokizio

État : **Phase 1 (Foundations) complète v9.66**. Pas encore exposé en UI.

## TL;DR

Lokizio permet aux prestataires (concierge, owner, provider, tenant) d'encaisser leurs factures en ligne via Stripe Connect Express + Direct Charges. Lokizio prend **3% de commission** automatiquement.

## Modèle choisi

- **Type de compte** : Stripe Connect **Express** (le plus simple pour les marketplaces, Stripe gère le KYC, dashboard, payouts).
- **Type de charge** : **Direct charges** (l'argent va directement au compte connecté, Lokizio prélève `application_fee_amount`).
- **Commission Lokizio** : 3% par défaut, paramétrable dans `platform_config.value.fee_percent`.
- **Frais Stripe** : payés par le prestataire (~1.4% + 0.25€ EU CB).
- **Pays initial** : FR. Liste extensible dans `platform_config.value.supported_countries`.

## Variables d'environnement Supabase

| Variable | Description | Déjà existante |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` (puis `sk_live_...`) | ✅ oui (pour l'abonnement Lokizio) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` du dashboard webhooks | ✅ oui (avec extension du même webhook) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | standards | ✅ oui |
| `LOKIZIO_APP_URL` | URL de redirection après onboarding | ❌ à ajouter (défaut `https://fabienlacaze.github.io/lokizio/`) |

## Schéma DB

### `members` (colonnes ajoutées v9.66)

| Colonne | Type | Notes |
|---|---|---|
| `stripe_account_id` | text | `acct_xxx`. Identique pour toutes les memberships d'un même user (cross-org) |
| `stripe_charges_enabled` | boolean | KYC OK pour encaisser |
| `stripe_payouts_enabled` | boolean | KYC OK pour recevoir des payouts |
| `stripe_details_submitted` | boolean | onboarding terminé |
| `stripe_account_country` | text | 'FR', 'BE', etc. |
| `stripe_onboarding_started_at` | timestamptz | |
| `stripe_account_updated_at` | timestamptz | dernière maj via webhook |

### `invoices` (colonnes ajoutées v9.66)

| Colonne | Type | Notes |
|---|---|---|
| `stripe_payment_intent_id` | text | `pi_xxx` |
| `stripe_payment_status` | text | `requires_payment_method`, `succeeded`, `failed`, `canceled` |
| `stripe_paid_at` | timestamptz | rempli par `payment_intent.succeeded` webhook |
| `stripe_application_fee_amount` | integer | centimes, ce que Lokizio prélève |
| `stripe_destination_account_id` | text | acct_ destinataire du paiement |
| `payment_link` | text | URL Checkout Session |

### `platform_config` (table créée v9.66)

Stocke la configuration Stripe Connect (commission, pays, etc.) en DB pour pouvoir l'ajuster sans déploiement. RLS : seuls les `super_admins` peuvent lire/écrire.

```json
{
  "fee_percent": 3.0,
  "fee_fixed_cents": 0,
  "enabled": true,
  "test_mode": true,
  "supported_countries": ["FR", "BE", "CH", "LU", "CA", "DE", "ES", "IT", "PT", "NL", "GB", "US"]
}
```

## Edge Functions

| Fonction | Description |
|---|---|
| `stripe-connect-onboard` | Crée un compte Stripe Express + renvoie une URL d'onboarding (5 min de validité). Idempotent. |
| `stripe-connect-link` | Régénère une URL d'onboarding si l'utilisateur a déjà un compte. |
| `stripe-connect-status` | Refresh KYC status depuis Stripe + sync `members`. |
| `stripe-invoice-payment-create` | Crée une Checkout Session pour une facture, avec 3% application_fee + transfert au compte destinataire. |
| `stripe-webhook` (étendu) | Écoute `account.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled` en plus des events subscriptions existants. |

## Flow utilisateur (prévu Phase 2-3)

### Onboarding prestataire

1. Le user clique **« Activer les paiements en ligne »** dans son profil.
2. Le browser appelle `stripe-connect-onboard` qui :
   - Crée un compte Express (idempotent — si déjà créé, skip).
   - Génère une URL d'onboarding Stripe.
3. Le user est redirigé vers Stripe pour remplir : identité (CNI), IBAN, infos fiscales.
4. Stripe redirige vers Lokizio (`return_url`).
5. L'app appelle `stripe-connect-status` pour synchroniser.
6. Si `charges_enabled = true` → badge **« ✓ Paiements en ligne actifs »** affiché.
7. Webhook `account.updated` sync à chaque changement Stripe ultérieur.

### Paiement d'une facture

1. Le créateur de la facture (prestataire avec Connect actif) clique **« Activer paiement en ligne »** sur la facture.
2. Le browser appelle `stripe-invoice-payment-create` qui crée une Checkout Session et stocke le `payment_link` sur l'invoice.
3. L'email de facture inclut désormais un bouton **« 💳 Payer en ligne »** pointant vers `payment_link`.
4. Le client clique, paye sur Stripe.
5. Webhook `payment_intent.succeeded` :
   - Met `invoices.status = 'paid'`, `stripe_paid_at = NOW()`, `stripe_payment_status = 'succeeded'`.
6. L'argent arrive sur le compte Stripe du prestataire (payout J+2 par défaut).
7. Lokizio reçoit sa commission (3%) sur son compte Stripe principal.

## Comptes de test Stripe

- Carte test : `4242 4242 4242 4242`, expiration `12/40`, CVC `123`, code postal `75001`.
- Carte 3D Secure : `4000 0027 6000 3184` (test SCA).
- Carte refusée : `4000 0000 0000 0002`.

Plus : https://stripe.com/docs/testing

## Sécurité

- Le `STRIPE_SECRET_KEY` est **uniquement** côté Edge Functions, jamais en frontend.
- Les Edge Functions vérifient `requireAuth` (JWT du user) avant tout appel Stripe.
- `stripe-invoice-payment-create` vérifie que le caller appartient à la même org que la facture.
- Webhook signé HMAC SHA256 (déjà en place).
- RLS sur `platform_config` : super_admin only.

## Phase suivante : Phase 2 (Onboarding UI prestataire)

À faire :

- Bouton « Activer paiements en ligne » dans Mon compte → ADMIN ou dans le profil annuaire.
- Modal de choix du pays (par défaut FR).
- Appel à `stripe-connect-onboard` + redirection.
- Page de retour `#stripe-onboard-return` qui appelle `stripe-connect-status`.
- Badge UI selon le statut KYC.

## ⚠️ Action utilisateur requise avant la Phase 2

1. **Aller sur le dashboard Stripe en mode test** : https://dashboard.stripe.com/test/settings/connect
2. **Activer Stripe Connect** (clic sur « Get started » / « Activate Connect »).
3. **Choisir « Platform or marketplace »** comme type d'utilisation.
4. **Récupérer la signature du webhook** (déjà fait → `STRIPE_WEBHOOK_SECRET` existe).
5. **Ajouter les events Connect à écouter** : aller dans Developers → Webhooks → l'endpoint existant → ajouter :
   - `account.updated`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
6. **Optionnel : configurer le nom de la plateforme** affiché aux prestataires sur le dashboard Express : Connect settings → Branding → « Lokizio ».

Sans ces étapes, l'Edge Function `stripe-connect-onboard` retournera une erreur « Account does not have permission to create Connect accounts ».

## Rappel sur le SIRET

Pour passer en mode **live** (vrais paiements), Lokizio doit avoir un statut juridique (micro-entreprise minimum) avec SIRET. Toute la Phase 1 et la Phase 2 peuvent être développées et testées en mode test sans SIRET.

Inscription gratuite micro-entrepreneur : https://www.autoentrepreneur.urssaf.fr
SIRET délivré sous 8 jours après inscription.
