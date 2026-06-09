# Lokizio — Roadmap

Dernière MAJ : 2026-06-09 (v9.84)

État au 2026-06-09 :
- ✅ Stripe Connect Direct charges + Embedded Components (v9.66-72)
- ✅ Compliance RGPD/DSA/DAC7 tech (Sprint 2, v9.76)
- ✅ Escrow J+7 (Sprint 3A, v9.77)
- ✅ Reviews/notation verified (Sprint 3B, v9.80)
- ✅ KYC métier + AML monitoring TRACFIN (Sprint 3C+3D, v9.81)
- ✅ Notifications business + vérif SIRET API gouv.fr (Sprint 4, v9.82)
- ✅ **Finance hardening** — 5 BLOCKERS du workflow audit corrigés (v9.84) : Idempotency-Key Stripe, race conditions cron/dispute, audit_log atomique, brute force protection, TOCTOU

Backup tag stable : `v9.84-prod-ready-finance`

Focus suivant : **tests E2E réels + remplir params légaux (Mon compte > ADMIN > Paramètres légaux) + obtenir SIRET + RC Pro**.

---

## 🧪 TESTS À RÉALISER

> Roadmap maintenue à chaque sprint. À cocher au fur et à mesure des validations en condition réelle.
> Légende : 🔴 critique avant prod live · 🟢 important · 🟡 nice-to-have

### 🔴 Stripe Connect E2E (finance — must-pass)
- [ ] Activation Connect : Mon profil → "Activer paiements" → formulaire embedded → badge "Paiements actifs"
- [ ] Création facture : Finances → Nouvelle → cohérence DB
- [ ] Paiement carte test `4242 4242 4242 4242` → statut `paid_pending_review` + badge orange "En validation J-7"
- [ ] Refund manuel par concierge : bouton "↻ Rembourser" → status `refunded`
- [ ] **Idempotency** (Sprint 4 fix) : `curl --retry 3` sur dispute → 1 seul refund dans Stripe Dashboard
- [ ] Carte refusée `4000 0000 0000 0002` → erreur affichée
- [ ] 3DS `4000 0027 6000 3184` → challenge → succès
- [ ] Webhook signature invalide → 400 rejeté

### 🔴 Dispute escrow (Sprint 3A + Sprint 4)
- [ ] Dispute valide depuis `/dispute.html?t=TOKEN` (email) → refund auto
- [ ] Dispute après fenêtre (>J+7) → 400 "expired"
- [ ] Dispute 2x → 409 "Already disputed"
- [ ] **Race cron vs dispute** (Sprint 4 fix) : cron + dispute simultanés → état cohérent
- [ ] **Brute force token** (Sprint 4 fix) : >5 tentatives en 1h → 429 + audit `severity=critical`
- [ ] Notif provider : email "⚠ Paiement contesté" reçu

### 🔴 Reviews verified (Sprint 3B + Sprint 4)
- [ ] Submit review via `/review.html?t=TOKEN` → publié
- [ ] **1 review max par invoice** (Sprint 4 fix) : 2 onglets même token → 1 OK, 2e a 409
- [ ] Annuaire : moyenne + count sur cartes provider
- [ ] "Mes avis reçus" dans Mon profil : moyenne + liste
- [ ] Modération admin : Masquer / Signaler / Republier
- [ ] Notif provider : email "⭐ Nouvel avis"

### 🟢 KYC métier (Sprint 3C)
- [ ] Upload SIRET PDF → statut `pending_review`
- [ ] **Vérif SIRET API gouv.fr** (Sprint 4B) : input → "Vérifier" → INSEE data + doc auto-validé
- [ ] Charte : lecture + checkbox + signer → DB
- [ ] Validation admin : examiner via Signed URL → valider → status `validated`
- [ ] Badge "✓ Vérifié" dans annuaire
- [ ] Refus avec motif → user voit motif + email notif
- [ ] Upload >10MB : rejet propre

### 🟢 AML monitoring (Sprint 3D)
- [ ] Seuil 30j : seed factures >7500€ → cron OU "Scanner maintenant" → alerte créée
- [ ] Fragmentation : 10+ tx <750€ en 24h → alerte high
- [ ] Self-billing : facture avec client_email = créateur → alerte critical
- [ ] Anti-doublon : re-scanner → pas de re-création
- [ ] Actions admin : Rejeter / Examinée / Déclarer TRACFIN

### 🟢 Sécurité (red team mindset)
- [ ] Cross-org RLS : GET `/invoices?org_id=AUTRE` → 0 rows
- [ ] XSS propertyName : `"><script>alert(1)</script>` dans nom bien → escape OK
- [ ] IDOR invoice : guess UUID → 404 RLS
- [ ] Storage KYC : folder d'un autre user → 401
- [ ] Webhook replay >300s → rejeté

### 🟡 UX (avant beta publique)
- [ ] **Latence pricing** (v9.78) : changer prix → marge update **instantanée**
- [ ] **Couleur Marge violette** (v9.79) : tableaux Détail mensuel + jour + Tarifs
- [ ] **Mode pick mission** : "Ajouter manuellement" → contact créé + assigné (v9.72)
- [ ] **Toggle "Masquer ADMIN"** (v9.83) : cache section pour test UX user normal
- [ ] **Catégorisation ADMIN** (v9.83) : 4 groupes collapsibles
- [ ] PWA install mobile → Add to Home Screen
- [ ] Service Worker offline → app charge en avion mode
- [ ] Push notif prestataire → reçue après assign
- [ ] Export ZIP année (v9.65) : PDFs + CSV récap

### 🟡 Pages publiques compliance
- [ ] `/lokizio/ranking-criteria.html`
- [ ] `/lokizio/security-policy.html`
- [ ] `/lokizio/provider-charter.html` v1.0
- [ ] `/.well-known/security.txt` valide
- [ ] **Photo consent** modale avant upload (Sprint 2)
- [ ] **Account deletion** : 2-step + cascade complète

### 🔵 Scénarios business complets

**A — Concierge nouveau client (15 étapes)** : crée compte → Connect → crée bien → invite owner → planning ménage hebdo → assigne prestataire annuaire → mission done → facture → paiement carte test → `paid_pending_review` → J+7 cron → `paid` → owner laisse avis 5★ → provider notif → AML scan OK

**B — Provider veut être trusted (11 étapes)** : crée compte → Activation KYC → vérif SIRET API gouv.fr → upload RC Pro + identité → signe charte v1.0 → `pending_review` → admin valide → `validated` → email "✅ KYC validé" → badge ✓ Vérifié → haut classement annuaire

**C — Litige client (9 étapes)** : owner paie → constate ménage mal fait → "Contester" dans email → `/dispute.html` → confirme + motif → refund Stripe (Idempotency-Key) → provider notif → facture `draft + refunded` → audit_log 2 entries (initiated + finalized) → owner reçoit son argent J+5

### 🔶 Tests automatisés à coder

**Priorité 1 (CI-bloquant)** :
- [ ] `e2e/stripe-payment-flow.spec.js` — mock Stripe + paiement complet
- [ ] `e2e/dispute-flow.spec.js` — `/dispute.html?t=...` → EF
- [ ] `e2e/review-flow.spec.js` — `/review.html?t=...` → DB
- [ ] `e2e/kyc-upload.spec.js` — fixture PDF
- [ ] `integration/aml-detection.spec.js` — seed → run scan → alertes
- [ ] `integration/idempotency-stripe.spec.js` — double call → 1 refund

**Priorité 2** :
- [ ] Visual regression Playwright
- [ ] Charge test 100 paiements simultanés
- [ ] Migration test : SQL sur DB vierge

---

## 🆕 IDÉES 2026-05-01 — Issues du brainstorm post-audit

### 🔴 Quick wins (1-3h, ROI fort)

1. **Activer Stripe en mode live** (cf section Blockers `pk_test_` → `pk_live_`)
2. **Splitter `i18n.js` par langue** : 113 KB → ~20 KB chargé. -90 KB sur le payload initial. Effort : 2h.
3. **Onboarding wizard auto au premier login** : utiliser `showAddPropertyWizard` qui existe déjà, le déclencher quand un user n'a pas encore de propriété. +taux d'activation. Effort : 1h.
4. **Dashboard Sentry intégré (admin only)** : page admin qui affiche les Sentry issues récentes via l'API que `npm run sentry` utilise. Effort : 3h.

### 🟠 Moyennes (1-2 jours)

5. **Sync queue offline (PWA mode complet)** : IndexedDB pour queuer les écritures concierge en zone blanche, sync au retour. Cas d'usage : valider un ménage offline.
6. **Notifications push enrichies** : rappel J-1 ménage au prestataire, paiement en retard au propriétaire, nouvelle réservation iCal. Infra existe.
7. **Recherche globale étendue** : ajouter prestations (status + date) et réservations (par tenant_email/dates). Effort : 4h.
8. **Export PDF factures avec design pro** : `jsPDF` lazy-loadé. Vérifier rendu actuel et améliorer (logo, couleurs, layout).
9. **Multi-langue marketing** : traduire `mentions.html`, `cgu.html`, `privacy.html`. Si Lokizio cible l'Europe.
10. **Programme parrainage activé** : `referral_code` + `referral_rewards` existent déjà dans `organizations`. Communiquer dans l'app.
11. **Templates de messages pré-rédigés** : table `message_templates` (org_id, label, body). Editable par admin. Cas : Bienvenue, Rappel check-in, Merci.
12. **Analytics business sans GA** : compteurs Supabase — nb cleanings/mois par org, revenu généré, taux d'occupation par bien. Affichés dans dashboard owner. Pas de tiers RGPD.
13. **Pages publiques vitrines `/c/[slug]`** : photo, services, avis. Drive SEO + partage social.
14. **Système de feedback in-app** : bouton 💬 → modale → table `feedback`. Apprends ce que veulent les vrais users.

### 🟡 Stratégiques (1 semaine, ROI long terme)

15. **Refactor `index.html`** (10 081 lignes → modules) : approche **incrémentale** feature par feature. Plus gros gisement de productivité future.
16. **Build pipeline minimal (esbuild)** : minification (-50% poids JS), tree shaking, source maps Sentry, cache busting auto. 15 min install + 1h config.
17. **CI sur GitHub Actions** : workflow qui exécute `npm test` + `npm run test:integration` + `npm run coverage` (gate 80%) sur chaque PR. Bloque les régressions.

### Recommandations par scénario

**Si lancement payant prévu dans le mois** :
1 → 3 → 6 → 8 → 10. Met les fondamentaux business en place.

**Si focus pérennité du code** :
16 → 17 → 15 → 2. Transforme le projet en machine à fer.

**Si focus croissance audience** :
3 → 14 → 13. Apprends comment faire grandir.

**Première étape recommandée par ROI/effort** :
- Splitter i18n (-90 KB, 2h) **OU**
- Build pipeline esbuild (-50% bundle, 1h) **OU**
- Onboarding wizard auto (gain conversion, 1h)

### À éviter pour l'instant

- ❌ Refactoriser en React/Vue → coût trop élevé pour le bénéfice
- ❌ App mobile native → la PWA suffit largement
- ❌ Migrer la DB → Supabase fait très bien le job
- ❌ Tests visuels CSS exhaustifs → ROI faible

---

## ⚖️ LÉGAL — À COMPLÉTER POUR COMMERCIALISER

### 📝 Placeholders à remplir par Fabien dans les pages HTML
Les 4 pages légales existent ([mentions.html](menage-manager-app/mentions.html), [cgu.html](menage-manager-app/cgu.html), [cgv.html](menage-manager-app/cgv.html), [privacy.html](menage-manager-app/privacy.html)). Il faut remplacer **tous les `[À COMPLÉTER]`** par :
- **Nom complet / raison sociale** (toi ou ton entreprise)
- **Statut juridique** (micro-entrepreneur, SAS, SARL, particulier)
- **SIRET** (à obtenir sur [autoentrepreneur.urssaf.fr](https://www.autoentrepreneur.urssaf.fr) si tu n'es pas immatriculé)
- **Siège social / adresse** (ton adresse perso suffit pour micro-entreprise)
- **Numéro TVA intracom** (ou "TVA non applicable, art. 293 B du CGI" pour micro-entreprise sous seuil)
- **Directeur de la publication** (ton nom)
- **Email RGPD de contact** (ex `rgpd@lokizio.app`, `contact@...`)
- **Médiateur agréé** pour CGV (ex CNPM Médiation Consommation — payant ~50€/an)

### 🚨 Actions légales côté Fabien
1. **Choisir un statut juridique** :
   - Usage perso uniquement ? → particulier, pas d'obligation fiscale si pas de revenus
   - Projet commercialisable ? → **micro-entrepreneur** (gratuit, rapide, en ligne)
2. **Immatriculation** (micro-entreprise) : ~15 min en ligne sur autoentrepreneur.urssaf.fr → SIRET délivré sous 8j
3. **Registre RGPD des traitements** (obligatoire si > 250 salariés, mais recommandé dès le 1er utilisateur). Template : [cnil.fr/fr/cartographier-vos-traitements-de-donnees-personnelles](https://www.cnil.fr/fr/cartographier-vos-traitements-de-donnees-personnelles)
4. **Assurance RC Pro** : optionnel mais recommandé (~100€/an) si tu factures des clients pros
5. **Déclaration CNIL** : plus obligatoire depuis 2018 (RGPD), mais obligations à respecter en interne
6. **Compte bancaire pro** : obligatoire micro-entreprise si CA > 10 000€/an pendant 2 années consécutives

### 📜 Features légales manquantes en code (à faire)
- [ ] **Lien de désabonnement** dans chaque email de facture (Resend config ou footer email)
- [ ] **Log de consentement RGPD** (stocker en DB la date et IP à l'acceptation des CGU)
- [ ] **Facturation électronique Factur-X** (PDF/A-3 + XML UBL) — obligatoire B2B à partir de sept. 2026 (PME) ou 2027 (petites entreprises). Pas urgent mais à prévoir.
- [ ] **Signature numérique devis** (optionnel mais pro — via DocuSign ou simple case à cocher horodatée)
- [ ] **Conservation conforme factures 10 ans** (vérifier que les archives sont accessibles même après suppression de compte)

---

---

## 🔴 BLOCKERS AVANT LANCEMENT PUBLIC

Audit complet du 2026-04-28. 2 items critiques restants après v9.46.

### 1. 🔑 Rotation complète des secrets exposés en dev

Plusieurs secrets ont transité dans des conversations / scripts pendant le dev. À régénérer **systématiquement** avant les premiers vrais utilisateurs publics.

À renouveler (ordre recommandé) :

| Secret | Où régénérer | Impact côté app |
|---|---|---|
| **Supabase `service_role` key** (projet `mrvejwyvhuivmipfwlzz`) | Dashboard Supabase → Project Settings → API → ⋯ Reset service_role key | Edge Functions : aucune action (rechargement auto). Scripts locaux (`scripts/seed-test-users.js`, `scripts/reset-and-seed-prod.js`, `.env.prod`) : mettre à jour la clé localement. |
| **Supabase Personal Access Token (PAT)** créé pour le CLI | https://supabase.com/dashboard/account/tokens → revoke `lokizio-dev-fabien` puis Generate new token | Mettre à jour `SUPABASE_ACCESS_TOKEN` dans `.env.prod`. Aucun impact prod runtime. |
| **Stripe `STRIPE_SECRET_KEY`** (sk_test_…) | Stripe Dashboard → Developers → API keys → Roll secret key | Mettre à jour le secret Supabase : `supabase secrets set STRIPE_SECRET_KEY=...`. ⚠️ Tous les webhooks/api en cours échoueront le temps de la propagation. |
| **Stripe `STRIPE_WEBHOOK_SECRET`** (whsec_…) | Stripe Dashboard → Developers → Webhooks → endpoint → Reveal signing secret (ou recréer l'endpoint) | Mettre à jour : `supabase secrets set STRIPE_WEBHOOK_SECRET=...`. ⚠️ Sans ça, la fonction `stripe-webhook` rejette tous les events. |
| **VAPID keys** (web push) | Régénérer une paire VAPID (script `web-push generate-vapid-keys`) | Mettre à jour `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` côté Supabase secrets ET côté frontend (`push.js`). ⚠️ Tous les abonnements push existants devront être ré-enregistrés. |
| **Resend API key** (`re_…`) | Resend Dashboard → API Keys → revoke + new | `supabase secrets set RESEND_API_KEY=...`. Bloque les emails le temps de la propagation. |
| **`UNSUB_SECRET`** (signature liens désabonnement) | Générer une random 32 chars : `openssl rand -hex 16` | `supabase secrets set UNSUB_SECRET=...`. Les anciens liens unsubscribe deviendront invalides. |

Procédure express (à faire en une session de ~15 min juste avant le lancement) :
1. Régénérer chaque secret côté provider (Supabase, Stripe, Resend)
2. Pour chacun : `supabase secrets set NOM=valeur` côté Supabase
3. Mettre à jour `.env.prod` local pour les opérations de maintenance futures
4. **Supprimer ce token / cette conversation** de l'historique (ou changer de session Claude)

**Effort total** : ~15-30 min

### 2. Pages légales avec `[À COMPLÉTER]`
- mentions/cgu/cgv/privacy non finalisées (cf section LÉGAL ci-dessus).
- **Bloquant juridique** dès qu'un vrai client s'inscrit.
- **Effort** : ~1 journée

---

## ✅ FAIT EN v9.46 (2026-04-28)

- ✅ **Vérification signature Stripe webhook** : HMAC SHA256 sur `t=...,v1=...` + protection rejeu 5min — déployé en prod
- ✅ **`STRIPE_WEBHOOK_SECRET` configuré** dans Supabase secrets — webhook fonctionnel
- ✅ **CORS prod restreint** : `fabienlacaze.github.io` uniquement, localhost seulement si `ENV=dev` — déployé sur 8 Edge Functions
- ✅ **14 catch silencieux** dans index.html → `console.warn` explicites avec contexte
- ✅ **Cleanup intervals au logout** (marketplace, connection badge, auto-refresh)
- ✅ **2 console.log debug** retirés ([marketplace.js](marketplace.js))
- ✅ **SQL doublon supprimé** : `prod-bundle-v9.18.sql` (remplacé par fixed)
- ✅ **Input sans label** : aria-label ajouté sur `wizAnnuaireVisible`
- ✅ **Lokizio CLI auto** : projet Supabase lié, scripts d'admin (`apply-sql-prod.js`, `reset-and-seed-prod.js`) opérationnels via `.env.prod` (gitignored)

---

## 🟠 IMPORTANTS (non bloquants mais à régler dans la semaine)

### index.html à 662KB
- Au-dessus du soft limit (audit). Lent à charger sur 3G/mobile.
- **Fix** : extraire chat (~3500-3800), wizard onboarding, modals factures.
- **Effort** : 2-3 jours.

### E2E manquants : Stripe checkout, RGPD delete, refund
- Couverture E2E à 94/94 mais aucun test sur les flows critiques de monétisation et conformité RGPD.
- **Effort** : ~1 journée.

### Coverage code à 1% lines
- Les modules critiques (helpers, auto-billing, i18n, cors) sont bien testés. Mais index.html + gros modules UI pas testés.
- **Fix** : viser 30%+ via E2E sur les flows critiques + tests unitaires sur les helpers métier (renderXXX, format, parse).

---

## 🟡 NETTOYAGES RESTANTS

- 🟡 **11 strings français hardcodés** (i18n incomplet, bloquant pour export Belgique/Canada)
- 🟡 **Cache busters désynchronisés** : plusieurs `?v=1` sur des fichiers déjà modifiés. Idéalement automatiser via hash du fichier au build.
- 🟡 **236 globaux exposés via `window.X`** : namespace possible (`window.Lokizio = {...}`)

---

## 🟡 FEATURES INCOMPLÈTES

### Devis (v8.71) : 70% fait
- ✅ Toggle Facture/Devis, numérotation séparée, conversion
- ❌ Pas de champ UI pour `quote_valid_until` (aujourd'hui défaut 30j)
- ❌ Pas de workflow d'acceptation client (signature / bouton accepter côté destinataire)
- ❌ Pas d'email de rappel si devis non accepté avant expiration

### Marketplace / Profils publics : 85% fait
- ✅ Table `marketplace_profiles` + RLS, rating, services, visible
- ✅ Onglet Annuaire avec sous-onglets (Mes contacts / Rechercher / Mes annonces)
- ✅ Filtre rôle + ville/code postal + tri (récents / note / expérience)
- ✅ Demandes de connexion + acceptation/refus
- ✅ Création de profil public depuis l'onboarding
- ✅ Bouton "Choisir dans l'annuaire" depuis la popup Sélectionner prestataire
- ✅ Bouton "Message" in-app sur chaque fiche annuaire (push notification)
- ✅ Contacts manuels (members.user_id NULL) avec popup détail (Appeler/Email/Message/Supprimer)
- ✅ Annonces publiques (`marketplace_jobs`) : publication d'une mission, suivi via "Mes annonces", retrait possible
- ❌ Pas de formulaire d'évaluation client (`provider_reviews` existe mais pas exposée)
- ❌ Pas de recherche géo réelle (rayon km) — actuellement filtre texte sur ville

### Auto-billing : 80% fait
- ✅ Edge Function deployée, cron quotidien, 3 rôles
- ❌ Pas de preview détaillée (le bouton Simuler existe mais n'ouvre qu'un toast)
- ❌ Pas d'email à l'admin quand des factures sont auto-créées

### Pressing / Historique linge
- **Fichier** : [i18n.js:261-273](menage-manager-app/i18n.js)
- Strings et table `plannings.history` existent mais UI très basique
- ❌ Pas de calendrier pressing (dates prévues vs réelles)
- ❌ Pas de prestataire pressing assignable

### Premium / Plans payants : 90% fait
- ✅ Edge Functions Stripe créées (`create-checkout`, `change-subscription`, `create-portal`, `stripe-webhook`)
- ✅ Constantes `STRIPE_PRICE_PRO` et `STRIPE_PRICE_BUSINESS` définies
- ✅ UI + toggles + RLS limits
- ❌ **Webhook ne vérifie pas la signature Stripe** (cf BLOCKERS) — sans ça, monétisation non-sécurisée
- ❌ Pas de retry / relance automatique si paiement échoue (Stripe le gère mais pas de notif côté UI)

---

## 🆕 NOUVELLES FEATURES (prévues)

### 🎯 Rôle "Locataire" — ✅ FAIT
- Module `tenant.js` + UI simplifiée
- `reservations.tenant_user_id` lie le locataire à sa période
- RLS scoping : locataire voit messages/property liés à SA réservation active
- Tests E2E : `tests/integration/tenant-messages.test.js`
- Reste à faire (optionnel) : notifications push automatiques quand un service est programmé pendant la période

### Dashboard d'accueil
Vue KPIs (CA du mois, factures en attente, prestations à venir, retards).

### Multi-devise
Pour users hors zone euro (Canada, Suisse, UK).

### Email : migration vers Brevo (RGPD)
Actuellement Resend (US). Brevo (FR) pour conformité RGPD long terme.

### Onboarding guidé — ✅ FAIT
Wizard multi-étapes pour concierge (6) et provider (5) avec :
- Bulles d'aide ? sous chaque champ (`WIZARD_HELP` + MutationObserver)
- Préservation des valeurs au Retour
- Étape Services intégrée (création rapide ménage standard)
- Étape Annuaire (opt-in profil public)
- Bouton X = logout + retour login

---

## 🟢 DETTE TECHNIQUE

### Refactoring index.html — 70% fait
Modules déjà extraits :
- ✅ `invoices.js`, `auto-billing.js`, `vacation.js`, `provider.js`, `owner.js`, `account.js`
- ✅ `marketplace.js`, `properties.js`, `dashboard.js`, `admin-prestations.js`
- ✅ `helpers.js`, `i18n.js`, `ical_parser.js`, `api_bridge.js`, `auth.js`, `push.js`
- ✅ `quotes.js`, `search.js`, `tenant.js`, `legal.js`, `legal-fill.js`
- ❌ `index.html` reste gros (~10k lignes) avec encore beaucoup de fonctions inline
- Reste à extraire : flow chat (openChat, sendChatMessage), gestion modals, version checker, onboarding wizard logic

**Filet de sécurité** : 137 tests unitaires Vitest + suite E2E Playwright actifs.

### 14 `catch(e) {}` silencieux restants
Réduit depuis v8.76 (était 20+). Reste 14 dans index.html.
- **Action** : minimum `console.warn('Silent catch:', e)` ou gestion explicite (cf le helper `notifyError(label, err)` exposé par api_bridge.js qui logue + toast)

### Cache busters partiellement résolus
- ✅ `sw.js` `APP_VERSION` synchronisé avec la version affichée dans l'app
- ⚠️ Les `?v=N` individuels par script (api_bridge, marketplace, admin-prestations…) sont incrémentés manuellement à chaque modif. CLAUDE.md le rappelle, mais reste fragile.
- **Idée** : générer ces v=N automatiquement à partir d'un hash du fichier au build

### localStorage non chiffré
Tokens, plan, org_id stockés en clair.
- **Action** : sensibiliser ou chiffrer

### Tests automatiques — ✅ FAIT
- 137 tests unitaires Vitest + jsdom
- Suite E2E Playwright (Chromium + WebKit) avec flows chat / réservations / rôles
- Tests d'intégration Supabase contre le projet de test dédié
- Commande agrégée `npm run audit` (10 checkers)
- CI GitHub Actions sur chaque push

---

## 🔧 DB / SCHEMA

### Incohérences résolues (v8.72, v8.73)
- ✅ `invoices.client_name` et 25 autres colonnes manquantes → ajoutées
- ✅ `month` et `total_amount` NOT NULL legacy → rendues nullable
- ✅ `marketplace_profiles.vacation_periods` + `country` ajoutées

### À vérifier
- FK cascade sur `planning` / `cleaning_validations` quand on supprime une propriété (code mentionne "Also deletes planning via CASCADE" mais pas sûr que la FK soit bien configurée)

---

## 🔑 SECRETS & CONFIG

État actuel des secrets Supabase prod (`mrvejwyvhuivmipfwlzz`) — vérifié 2026-04-28 :

| Secret | Configuré ? | Utilisé pour |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SB_SERVICE_ROLE_KEY` | ✅ | Edge Functions (auto-injectés + alias custom) |
| `SUPABASE_ANON_KEY` / `SUPABASE_JWKS` / `SUPABASE_DB_URL` | ✅ | Edge Functions (validation JWT, accès DB direct) |
| `STRIPE_SECRET_KEY` | ✅ | Edge Functions Stripe |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Vérification signature webhook (v9.46) |
| `RESEND_API_KEY` | ✅ | send-email (factures, notifs) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | ✅ | Push notifications |
| `UNSUB_SECRET` | ✅ | Signature liens désabonnement email |

⚠️ **Avant lancement public** : tous ces secrets doivent être régénérés (cf section *Blockers* en haut du fichier).

---

## 📝 UX / DOCUMENTATION

### i18n incomplet
- Service Worker hardcodé : `[sw.js:84-86]` — 'lokizio', 'Nouveau menage assigne'
- Certains error messages en dur
- Changelog 60+ versions mais uniquement en FR

### Validation client faible
Messages d'erreur génériques ("Données manquantes") au lieu de "Champ X requis".

---

## ✅ FAIT RÉCEMMENT

### v9.4x (2026-04-28) — Annuaire / Marketplace / RLS
- v9.45 Clic sur bulle "Mon équipe" → popup détail (Appeler/Email/Message/Supprimer)
- v9.44 Fix Enregistrer contact : RPC `add_manual_contact` (SECURITY DEFINER) bypass un quirk PostgREST sur `auth.uid()` dans le WITH CHECK
- v9.43 Policy `members.insert` élargie aux rôles concierge/admin/manager
- v9.42 Fix silent failure : ajout colonne `members.notes` + alert d'erreur visible
- v9.41 Fix sauvegarde `serviceConfig`/`required_services`/`messageTemplate` (mapping frontend→DB) + sous-onglet "Mes annonces" rendu visible côté concierge
- v9.40 Bouton "Message" in-app sur chaque fiche annuaire
- v9.39 Sous-onglet "Mes annonces" dans l'annuaire (statut + retrait)
- v9.38 Bouton "Choisir dans l'annuaire" dans la popup Sélectionner prestataire
- v9.37 "Inviter par email" réutilise la popup parrainage (WhatsApp/SMS/Email/Telegram)
- v9.36 Confirmation visuelle après publication d'une annonce + table `marketplace_jobs` en prod
- v9.35 Bouton Sélectionner prestataire + alerte aussi dans la modale détail prestation
- v9.34 Popup Sélectionner prestataire réorganisée (Mon équipe / Diffuser)
- v9.33 4 comptes de test multi-rôles
- v9.32 Badge "Aucun prestataire" lisible
- v9.31 Bouton broadcast aux prestataires + détection iCal cleanings élargie

### v9.2x — Onboarding & UX
- v9.30 Création annuaire propre + étape onboarding annuaire (concierge + provider)
- v9.29 Alerte clignotante critique (rouge + glow + badge) sur prestations sans prestataire
- v9.28 Adresse cliquable dans détail prestation + popup nav (GMaps/Waze/Apple/copier)
- v9.27 Persistance `service_config` + `required_services` en DB + rappels cliquables
- v9.26 Flux iCal nettoyé
- v9.25 Sync calendriers liée au déclencheur de service (Fin/Début location)
- v9.24 Étape Services au wizard onboarding
- v9.23 Bulles d'aide ? sous chaque champ
- v9.22 Bouton X de l'onboarding = logout + retour login
- v9.20 Fix freeze infinite loop sur ? wizard
- v9.19 Bouton ? dans l'onboarding + préservation des valeurs au Retour
- v9.18 Tarif/durée retirés du wizard

### v9.1x — Tests & sécurité
- v9.17 Module helpers.js partagé avec tests (137 tests) + fix fuseau facturation (UTC) + CI GitHub Actions
- v9.16 Sécurité : auth JWT + CORS restreint sur Edge Functions sensibles, fix fuite chat locataire, calcul TVA correct, accessibilité, mobile <480px

### v9.0x-v9.1x — Refactor modulaire
- v9.10-v9.15 Extraction de `owner.js`, `provider.js`, `marketplace.js`, `properties.js`, `account.js`, `admin-prestations.js`

### v8.7x — Avant la v9
- v8.73 Fix : colonnes legacy `month`/`total_amount` NOT NULL → nullable
- v8.72 Fix : 25 colonnes manquantes ajoutées à `invoices`
- v8.71 Devis 3 rôles (toggle + conversion)
- v8.70 Envoi facture email (Resend)
- v8.65 6 améliorations factures
- v8.60 Recherche globale

---

## 🚦 Ordre d'attaque recommandé

### Sprint actuel — Préparation lancement public
1. **Régénérer la `service_role` key** (cf section Secrets & Config)
2. Compléter les pages légales (mentions, CGU, CGV, privacy) — `[À COMPLÉTER]` à remplacer
3. Choisir statut juridique (micro-entrepreneur recommandé) + obtenir SIRET
4. Tester en parallèle les 4 rôles via les comptes `@lokizio.test` pour valider les flows croisés
5. Workflow acceptation devis (quote_valid_until UI + bouton accepter destinataire)

### Sprint suivant
1. **Formulaire d'évaluation client** + exposer `provider_reviews` dans l'UI
2. Recherche géo réelle (rayon km) dans l'annuaire (lat/lng existent)
3. Notifications push automatiques au locataire quand un service est programmé sur sa période
4. Dashboard d'accueil avec KPIs (CA mois, factures en attente, prestations à venir)
5. Email à l'admin quand des factures sont auto-créées

### Plus tard
1. Migration Resend → Brevo (RGPD)
2. Multi-devise (CAD, CHF, GBP)
3. Lien désabonnement + log consentement RGPD + Factur-X
4. Pressing : calendrier + prestataire dédié
5. Sentry / monitoring d'erreurs en prod
