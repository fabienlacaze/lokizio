# Lokizio — Tests

Suite de tests pour le logiciel Lokizio. Trois niveaux :

| Niveau | Outil | Couvre |
|--------|-------|--------|
| Unitaires | Vitest + jsdom | Helpers purs (TVA, dates, i18n, validations, parser iCal, jours feries) |
| Edge Functions | Vitest | CORS helper, requireAuth JWT |
| E2E | Playwright (Chromium + iPhone 13) | UI : smoke, auth, validation formulaires, a11y, mobile |

## Commandes

```bash
# Installation (une seule fois)
npm install
npx playwright install chromium webkit

# Tests unitaires (rapide, ~1s)
npm test

# Watch mode
npm run test:watch

# Par dossier
npm run test:unit
npm run test:edge

# E2E (lance automatiquement le serveur local)
npm run test:e2e

# E2E avec UI interactive (pratique pour debugger)
npm run test:e2e:ui

# Tout
npm run test:all

# Couverture
npm run coverage
```

## Structure

```
tests/
  unit/                           # Tests Vitest (jsdom)
    computeAmounts-tva.test.js    # Calcul TVA auto-bill
    getPeriod.test.js             # Periode de facturation
    ical-parser.test.js           # Parser iCal Airbnb/Booking
    i18n.test.js                  # Fonction t() traduction
    notifyError.test.js           # Helper erreurs utilisateur
    vacation-holidays.test.js     # Jours feries FR/BE/CH/LU/CA
    validators.test.js            # Email, SIRET, mot de passe
  edge/                           # Tests helpers Edge Functions
    cors.test.js                  # CORS restrictif par origine
    requireAuth.test.js           # Validation JWT
  e2e/                            # Tests Playwright
    smoke.spec.js                 # L'app charge, version affichee
    auth-validation.spec.js       # Regles mot de passe cote client
    ui-basics.spec.js             # Langue, a11y, mobile
```

## Couverture actuelle

- **119 tests unitaires** (passent en 1s)
- **~8 tests E2E** smoke (auth UI)
- **CI GitHub Actions** : `.github/workflows/tests.yml` — lance a chaque push/PR

## Limitations connues

- Les tests unitaires **dupliquent** la logique testee plutot que d'importer les modules. Raison : les modules Lokizio dependent de globals (`sb`, `API`, `window.X`) qui rendent l'import unitaire difficile. Tradeoff : on teste la LOGIQUE mais pas le CABLAGE du code reel.
- Les E2E **n'appellent pas Supabase** (pas de projet de test configure). Ils testent uniquement l'UI statique et la validation client.
- Un bug timezone dans `auto-bill` est contourne dans les tests (voir `getPeriod.test.js` commentaire) — si le serveur tourne en zone CET/CEST, `new Date(y, m, d).toISOString()` peut retourner le jour precedent.

## Ajouter un test

### Test unitaire

Creer `tests/unit/<nom>.test.js` :
```js
import { describe, it, expect } from 'vitest';
describe('maFonction', () => {
  it('fait X', () => { expect(1 + 1).toBe(2); });
});
```

### Test E2E

Creer `tests/e2e/<nom>.spec.js` :
```js
import { test, expect } from '@playwright/test';
test('mon parcours', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

## Pour aller plus loin

- **RLS tests** : lancer un projet Supabase local (`supabase start`) et tester chaque policy par role (admin/concierge/owner/provider/tenant).
- **Edge Functions integrations** : utiliser `supabase functions serve` + fetch reel.
- **Visual regression** : ajouter `@playwright/test` screenshot comparisons.
