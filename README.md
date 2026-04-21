# Lokizio

[![Tests](https://github.com/fabienlacaze/lokizio/actions/workflows/tests.yml/badge.svg)](https://github.com/fabienlacaze/lokizio/actions/workflows/tests.yml)

Logiciel de conciergerie et gestion locative (PWA Supabase + vanilla JS).

## Stack

- **Frontend** : vanilla JS modulaire + PWA (service worker + manifest)
- **Backend** : Supabase (Postgres + RLS + Edge Functions Deno)
- **Paiement** : Stripe (checkout + portal + webhook)
- **Emails** : Resend API (avec footer unsubscribe HMAC)
- **Push** : Web Push natif via VAPID
- **Hebergement** : GitHub Pages

## Demarrer en local

```bash
npm install
npm run serve          # http://localhost:8000
```

## Tests & audit

**Un seul bouton pour tout verifier :**

```bash
npm run audit          # tests + couverture + E2E + lint + secrets + a11y + i18n (~2min)
npm run audit:quick    # idem sans E2E (~5s) — pour iterer
npm run audit:strict   # warnings traites comme des echecs (CI strict)
```

Le rapport HTML complet est genere dans [audit-report.html](audit-report.html).

**Ou les commandes individuelles :**

```bash
npm test               # 137 tests unitaires (~1s)
npm run test:watch
npm run test:e2e       # Playwright (lance le serveur auto)
npm run coverage
```

Voir [tests/README.md](tests/README.md) pour les details.

## Structure

```
menage-manager-app/
  index.html           # Entree app (10k lignes, en cours de refactoring)
  app.css              # Styles extraits
  helpers.js           # Fonctions pures testables (TVA, dates, validators, i18n...)
  api_bridge.js        # Client Supabase + API globale
  i18n.js              # Traductions FR/EN/ES/PT/IT/DE
  auth.js, dashboard.js, account.js, ...  # Modules par feature
  sw.js                # Service worker (cache offline)
  tests/
    unit/              # Vitest + jsdom
    edge/              # Tests Edge Functions (CORS, JWT)
    e2e/               # Playwright
```

## Deploiement

Push sur `main` = deploy automatique via GitHub Pages. Les Edge Functions Supabase se deploient separement avec `supabase functions deploy`.

## Versioning

A chaque push, incrementer :
- `v9.XX` dans `index.html` (4 occurrences) via `replace_all`
- `APP_VERSION` dans `sw.js` (meme numero sans `v`)
- Cache busters `?v=XX` sur les modules modifies
