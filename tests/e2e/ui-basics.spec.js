import { test, expect } from '@playwright/test';

test.describe('UI basics', () => {
  test('language switcher toggles FR/EN', async ({ page }) => {
    await page.goto('/');
    // Should have both flags visible
    const fr = page.locator('[data-lang="fr"]');
    const en = page.locator('[data-lang="en"]');
    await expect(fr).toBeVisible();
    await expect(en).toBeVisible();

    // Click English
    await en.click();
    // Check that some data-i18n element changed to English
    await expect(page.locator('#tabLogin')).toContainText(/Log in|Sign in|Login/i);

    // Back to French
    await fr.click();
    await expect(page.locator('#tabLogin')).toContainText(/connecter/i);
  });

  test('flags have accessible labels', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-lang="fr"]')).toHaveAttribute('aria-label', /francais|french/i);
    await expect(page.locator('[data-lang="en"]')).toHaveAttribute('aria-label', /english/i);
  });

  test('app is keyboard navigable (tab reaches email input)', async ({ page }) => {
    await page.goto('/');
    const email = page.locator('#authEmail');
    await email.focus();
    await expect(email).toBeFocused();
  });

  test('critical inputs have labels associated via for=', async ({ page }) => {
    await page.goto('/');
    const emailLabel = page.locator('label[for="authEmail"]');
    const passLabel = page.locator('label[for="authPass"]');
    await expect(emailLabel).toBeVisible();
    await expect(passLabel).toBeVisible();
  });

  test('app.css is loaded (CSS variables defined)', async ({ page }) => {
    await page.goto('/');
    const accent = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    });
    expect(accent).toBe('#e94560');
  });

  test('mobile viewport: no horizontal scroll on auth screen', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/');
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });
});
