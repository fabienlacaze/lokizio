// Probe the prod app via Playwright, capture all console messages and network errors.
// Reads logs the same way a human would in DevTools.
//
// Usage:
//   node scripts/probe-prod-console.js                # default: lokizio prod
//   node scripts/probe-prod-console.js http://localhost:8000  # local

import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://fabienlacaze.github.io/lokizio/';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const consoleMessages = [];
  const networkErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ name: err.name, message: err.message, stack: (err.stack || '').slice(0, 500) });
  });
  page.on('requestfailed', (req) => {
    networkErrors.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText });
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      networkErrors.push({ url: resp.url(), method: resp.request().method(), status: resp.status() });
    }
  });

  console.log(`Probing ${URL} ...`);
  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch (e) {
    console.log('goto error:', e.message);
  }

  // Wait extra time for async script errors
  await page.waitForTimeout(3000);

  console.log('\n═══ CONSOLE MESSAGES ═══');
  const errors = consoleMessages.filter((m) => m.type === 'error');
  const warnings = consoleMessages.filter((m) => m.type === 'warning');
  const logs = consoleMessages.filter((m) => m.type === 'log');
  console.log(`Errors: ${errors.length}, Warnings: ${warnings.length}, Logs: ${logs.length}`);

  errors.forEach((m, i) => console.log(`[ERR #${i + 1}] ${m.text.slice(0, 300)}`));
  warnings.forEach((m, i) => console.log(`[WARN #${i + 1}] ${m.text.slice(0, 200)}`));

  console.log('\n═══ PAGE ERRORS (uncaught) ═══');
  pageErrors.forEach((e, i) => {
    console.log(`#${i + 1} ${e.name}: ${e.message}`);
    console.log(e.stack.split('\n').slice(0, 5).map((l) => '  ' + l).join('\n'));
  });

  console.log('\n═══ NETWORK ERRORS ═══');
  networkErrors.forEach((n, i) => {
    console.log(`#${i + 1} ${n.method || ''} ${n.status || n.failure} ${n.url}`);
  });

  console.log('\n═══ APP STATE ═══');
  try {
    const state = await page.evaluate(() => ({
      version: window.APP_VERSION,
      sentryLoaded: typeof Sentry !== 'undefined',
      sentryHasInit: typeof Sentry !== 'undefined' && typeof Sentry.captureMessage === 'function',
      bodyHasAuthScreen: !!document.getElementById('authScreen'),
      authScreenVisible: document.getElementById('authScreen')?.offsetParent !== null,
      url: location.href,
    }));
    console.log(JSON.stringify(state, null, 2));
  } catch (e) {
    console.log('state probe failed:', e.message);
  }

  await browser.close();
})();
