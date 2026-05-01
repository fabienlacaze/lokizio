// Validation that Sentry captures errors from Playwright-driven sessions.
// Tags the event with `via=playwright-e2e` so we can filter from real-user errors.

import { test, expect } from '@playwright/test';

test('Sentry captures errors from E2E sessions', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Wait until Sentry SDK is initialized (the loader script init is async)
  await page.waitForFunction(() => {
    return typeof window.Sentry !== 'undefined'
      && typeof window.Sentry.captureMessage === 'function';
  }, { timeout: 15_000 });

  // Force the loader to fully initialize Sentry, then capture
  const result = await page.evaluate(async () => {
    if (typeof Sentry.forceLoad === 'function') await Sentry.forceLoad();
    // Some loader builds are async — wait until setTag exists (full SDK loaded)
    await new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (typeof Sentry.setTag === 'function') return resolve();
        if (Date.now() - start > 5000) return resolve();
        setTimeout(check, 100);
      };
      check();
    });
    const id = Sentry.captureMessage('E2E sentry-capture canary ' + Date.now());
    const flushed = typeof Sentry.flush === 'function' ? await Sentry.flush(5000) : false;
    return { id, flushed, hasSetTag: typeof Sentry.setTag === 'function' };
  });

  console.log('Sentry capture result:', result);
  expect(result.hasSetTag, 'Sentry SDK should be fully loaded').toBe(true);
  expect(result.id).toBeTruthy();
  expect(result.flushed).toBe(true);
});
