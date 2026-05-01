// Niveau 2 — Crawler exhaustif de Lokizio
//
// Ce test :
//   1. Login en tant que concierge (utilisateur de test sur lokizio-test)
//   2. Visite chaque ecran principal (dashboard, planning, factures, etc.)
//   3. Ouvre chaque modal connu (accountModal, marketplaceModal, etc.)
//   4. Survol des boutons / liens / form fields visibles
//   5. Toute exception JS est capturee par Sentry (env=development)
//
// Lancer : npx playwright test tests/e2e-crawler/crawler.spec.js --project=flows
// Puis : npm run sentry pour voir les bugs decouverts

import { test, expect, seedUser, loginUI, cleanupUser, hasTestEnv, adminClient } from '../e2e-flows/_helpers.js';

test.skip(!hasTestEnv(), '.env.test missing — crawler needs Supabase test creds');

let userId = null;
test.afterEach(async () => { await cleanupUser(userId); userId = null; });

const MODALS_TO_OPEN = [
  // Le pattern : { name: 'pour les logs', fn: 'nom de la fonction window.X', wait: ms apres ouverture }
  { name: 'Account', fn: 'showAccountModal' },
  { name: 'Team', fn: 'showTeamModal' },
  { name: 'Marketplace', fn: 'showMarketplace' },
  { name: 'Premium', fn: 'showPremiumModal' },
  { name: 'Help', fn: 'showHelp' },
  { name: 'Lang', fn: 'showLangModal' },
  { name: 'Changelog', fn: 'showChangelog' },
  { name: 'Send', fn: 'showSendModal' },
  { name: 'AddProvider', fn: 'showAddProviderModal' },
  { name: 'Invite', fn: 'showInviteModal' },
  { name: 'GlobalSearch', fn: 'showGlobalSearch' },
  { name: 'ConnectionRequests', fn: 'showConnectionRequests' },
  { name: 'ServiceRequest', fn: 'showServiceRequestModal' },
  { name: 'AddPropertyWizard', fn: 'showAddPropertyWizard' },
  { name: 'CreateInvoice', fn: 'showCreateInvoiceModal', args: ['concierge_to_owner', false] },
  { name: 'LegalSettings', fn: 'showLegalSettingsModal' },
  { name: 'AddManualContact', fn: 'showAddManualContact' },
  { name: 'FullChangelog', fn: 'showFullChangelog' },
];

const CONSOLE_ERRORS = [];
const PAGE_ERRORS = [];

test.describe.configure({ mode: 'serial' });

test('crawler: visit all screens, open all modals, capture errors', async ({ page }) => {
  // Capture toutes les erreurs JS et console
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      CONSOLE_ERRORS.push({ type: msg.type(), text: msg.text(), at: new Date().toISOString() });
    }
  });
  page.on('pageerror', (err) => {
    PAGE_ERRORS.push({ name: err.name, message: err.message, stack: err.stack, at: new Date().toISOString() });
  });

  // 1. Seed user + org + property manuellement (plus fiable que l'auto-creation)
  const { user, email, password } = await seedUser('crawler');
  userId = user.id;
  const admin = adminClient();
  const { data: org } = await admin.from('organizations').insert({
    name: 'Crawler-Org-' + Date.now(), plan: 'business', onboarding_completed: true,
  }).select().single();
  await admin.from('members').insert({
    org_id: org.id, user_id: user.id, role: 'concierge',
    accepted: true, invited_email: email, display_name: 'Crawler',
  });
  await admin.from('properties').insert({
    org_id: org.id, name: 'Villa Crawler', address: '1 rue Test 75001 Paris',
  });

  await loginUI(page, email, password);
  // Wait for nav to appear (signals the app is logged in and rendered)
  await expect(page.locator('#nav_properties')).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000); // let async loaders settle

  // 2. Naviguer dans les onglets principaux
  const TABS = ['planning', 'finance', 'admin', 'config', 'comm'];
  for (const tab of TABS) {
    try {
      await page.evaluate((t) => {
        if (typeof window.switchNav === 'function') window.switchNav(t);
      }, tab);
      await page.waitForTimeout(500);
      console.log(`✓ Tab ${tab} visited`);
    } catch (e) {
      console.log(`✗ Tab ${tab} failed:`, e.message);
    }
  }

  // 3. Ouvrir chaque modal puis le fermer
  for (const modal of MODALS_TO_OPEN) {
    try {
      await page.evaluate(({ fn, args }) => {
        if (typeof window[fn] === 'function') {
          return window[fn].apply(null, args || []);
        }
        throw new Error(`window.${fn} is not a function`);
      }, modal);
      await page.waitForTimeout(800); // laisser le modal s'afficher

      // Force la capture d'une erreur Sentry si une exception JS est synchrone-pending
      await page.evaluate(() => { /* tick */ });

      // Fermer (clic sur overlay ou ESC)
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(200);
      console.log(`✓ Modal ${modal.name} opened`);
    } catch (e) {
      console.log(`✗ Modal ${modal.name} failed:`, e.message);
    }
  }

  // 4. Force un flush Sentry (envoie les events buffered)
  await page.evaluate(() => {
    if (typeof Sentry !== 'undefined' && Sentry.flush) {
      return Sentry.flush(2000);
    }
  });

  // 5. Rapport final
  console.log('\n═══ CRAWLER REPORT ═══');
  console.log(`Console errors: ${CONSOLE_ERRORS.length}`);
  CONSOLE_ERRORS.forEach((e) => console.log(`  [console] ${e.text.substring(0, 200)}`));
  console.log(`Page errors (uncaught): ${PAGE_ERRORS.length}`);
  PAGE_ERRORS.forEach((e) => console.log(`  [page] ${e.name}: ${e.message}`));

  // Le test passe meme avec des erreurs — le but est de les decouvrir, pas de les bloquer
});
