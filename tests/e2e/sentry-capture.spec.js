// Validation that Sentry captures errors from Playwright-driven sessions.
// Tags the event with `via=playwright-e2e` so we can filter from real-user errors.
//
// NOTE: in CI, the SW kill-switch (added v9.58+) sometimes triggers an early
// location.reload() which destroys the page.evaluate execution context. We
// guard against that by sleeping past the kill-switch window and using
// expect.toPass() to retry the whole capture sequence on navigation.

import { test, expect } from '@playwright/test';

test('Sentry captures errors from E2E sessions', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  // Wait past the SW kill-switch window (it fires within ~1s of load if a stale
  // SW is detected). Without this, page.evaluate can race a location.reload().
  await page.waitForTimeout(1500);

  // Wait until Sentry SDK is initialized (the loader script init is async)
  await page.waitForFunction(() => {
    return typeof window.Sentry !== 'undefined'
      && typeof window.Sentry.captureMessage === 'function';
  }, { timeout: 15_000 });

  // Retry on navigation (execution context destroyed) up to 3 times.
  let result = null;
  await expect.poll(async () => {
    try {
      result = await page.evaluate(async () => {
        if (typeof Sentry.forceLoad === 'function') await Sentry.forceLoad();
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
      return result && result.hasSetTag === true;
    } catch (e) {
      // navigation race, retry
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(500);
      return false;
    }
  }, { timeout: 30_000, intervals: [1000, 2000, 3000] }).toBe(true);

  console.log('Sentry capture result:', result);
  expect(result.hasSetTag, 'Sentry SDK should be fully loaded').toBe(true);
  expect(result.id).toBeTruthy();
  expect(result.flushed).toBe(true);
});
