# Deploiement Lokizio — checklist production

## Etat actuel

- [x] 7 Edge Functions deployees sur projet prod `mrvejwyvhuivmipfwlzz`
  - send-push, send-email, create-checkout, change-subscription, create-portal, delete-account, auto-bill, export-ical
- [x] Code frontend pushe sur GitHub Pages (auto-deploy)
- [x] Tests auto (250) passent avec integration Supabase reelle
- [x] SQL prod bundle pret ([sql/prod-bundle-v9.18.sql](sql/prod-bundle-v9.18.sql))

## A faire par Fabien

### 1. Appliquer le bundle SQL sur prod (5 min)

1. Dashboard Supabase > projet Lokizio (prod) > SQL Editor
2. Copier-coller : https://raw.githubusercontent.com/fabienlacaze/lokizio/main/sql/prod-bundle-v9.18.sql
3. Run

### 2. Configurer les secrets Edge Functions (10 min)

Dashboard Supabase > projet Lokizio > Edge Functions > Secrets (ou `supabase secrets set` via CLI)

**Push notifications (obligatoire pour push)**
```
VAPID_PUBLIC_KEY=<ta_cle_publique>
VAPID_PRIVATE_KEY=<ta_cle_privee>
VAPID_SUBJECT=mailto:lokizio.service@outlook.com
```

Generer les cles VAPID une seule fois :
```bash
npx web-push generate-vapid-keys
```

Mettre aussi le `VAPID_PUBLIC_KEY` dans `menage-manager-app/push.js` (constante `VAPID_PUBLIC_KEY`).

**Emails (obligatoire pour emails transactionnels)**
```
RESEND_API_KEY=re_xxxxx
FROM_EMAIL=onboarding@resend.dev  # ou ton domaine verifie dans Resend
UNSUB_SECRET=<chaine aleatoire forte, 32+ chars>
```

Recuperer `RESEND_API_KEY` sur https://resend.com (plan free : 100 mails/jour).

**Stripe (obligatoire pour subscriptions)**
```
STRIPE_SECRET_KEY=sk_live_xxxxx       # cle LIVE pour prod (pas sk_test_)
STRIPE_WEBHOOK_SECRET=whsec_xxxxx     # celui du webhook Supabase
```

Dans le dashboard Stripe :
1. Webhook endpoint : `https://mrvejwyvhuivmipfwlzz.supabase.co/functions/v1/stripe-webhook`
2. Events a ecouter : `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`

### 3. Remplir les infos legales (10 min)

Une fois connecte comme super-admin :
1. Ouvrir l'app > icone engrenage (settings)
2. Bouton "Infos legales"
3. Renseigner :
   - Nom / Raison sociale : **Fabien Lacaze** (ou ton entite)
   - Statut juridique : **Micro-entrepreneur** (ou autre)
   - SIRET : **<14 chiffres>**
   - Adresse du siege : **<rue, CP, ville>**
   - Email de contact RGPD : **<email>**
   - Mediateur agree (CGV) : ex. **CNPM Mediation Consommation**

Les pages mentions.html, cgu.html, cgv.html, privacy.html se remplissent automatiquement via legal-fill.js.

### 4. Verifier Stripe Price IDs

Dans `menage-manager-app/supabase_config.js` :
```js
const STRIPE_PK = 'pk_live_xxxxx';  // cle PUBLIC live (pas test)
const STRIPE_PRICE_PRO = 'price_live_xxx';
const STRIPE_PRICE_BUSINESS = 'price_live_xxx';
```

Actuellement c'est en mode test (`pk_test_...`). A remplacer pour aller en live.

### 5. Domaine custom (optionnel)

Actuellement l'app est sur https://fabienlacaze.github.io/lokizio/
Pour un domaine custom (ex: app.lokizio.fr) :
1. Acheter le domaine
2. Dans GitHub Pages > Settings > Custom domain
3. CNAME `app.lokizio.fr` -> `fabienlacaze.github.io`
4. Mettre a jour `SITE_URL` dans les Edge Functions create-checkout et create-portal

## Tests post-deploy

Apres avoir fait les etapes ci-dessus :

```bash
cd menage-manager-app
npm run audit
```

Should be all green. Tests d'integration sur `lokizio-test` (pas prod).

Pour tester la prod reelle :
1. Creer un compte test sur l'app
2. Faire un checkout Stripe (avec carte de test 4242 4242 4242 4242 en sandbox)
3. Verifier qu'une facture arrive en DB
4. Activer push notifications et verifier qu'elles arrivent
5. Envoyer un email de facture et verifier reception
