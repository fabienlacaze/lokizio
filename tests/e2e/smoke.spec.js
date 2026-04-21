import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('app loads without JS errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    // Ignore Supabase config errors (expected in E2E without real config)
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('supabase')) errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle(/Lokizio|Cleaning|Menage/i);
    await page.waitForLoadState('domcontentloaded');

    // Filter benign errors (network to Supabase without config)
    const critical = errors.filter((e) =>
      !/supabase|Failed to fetch|NetworkError/i.test(e)
    );
    expect(critical, `Unexpected JS errors: ${critical.join('\n')}`).toHaveLength(0);
  });

  test('displays version badge', async ({ page }) => {
    await page.goto('/');
    const badge = page.locator('#versionBadge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/v\d+\.\d+/);
  });

  test('auth screen is visible on first load', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#authEmail')).toBeVisible();
    await expect(page.locator('#authPass')).toBeVisible();
  });

  test('register tab is clickable', async ({ page }) => {
    await page.goto('/');
    await page.click('#tabRegister');
    await expect(page.locator('#authConfirmWrap')).toBeVisible();
  });

  test('login tab is clickable', async ({ page }) => {
    await page.goto('/');
    await page.click('#tabRegister');
    await page.click('#tabLogin');
    await expect(page.locator('#authConfirmWrap')).toBeHidden();
  });

  test('service worker registers', async ({ page }) => {
    await page.goto('/');
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.getRegistration();
      return !!reg;
    });
    expect(swRegistered).toBe(true);
  });
});
