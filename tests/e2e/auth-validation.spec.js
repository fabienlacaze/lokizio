import { test, expect } from '@playwright/test';

// Helper: go to register tab and accept RGPD checkbox (required before password validation runs)
async function gotoRegister(page) {
  await page.goto('/');
  await page.click('#tabRegister');
  const rgpd = page.locator('#authRgpdAccept');
  if (await rgpd.count()) await rgpd.check();
}

test.describe('Auth form validation (client-side)', () => {
  test('shows error when submitting empty fields on login', async ({ page }) => {
    await page.goto('/');
    await page.click('#authSubmitBtn');
    await expect(page.locator('#authError')).not.toBeEmpty();
  });

  test('rejects password shorter than 8 chars on register', async ({ page }) => {
    await gotoRegister(page);
    await page.fill('#authEmail', 'test@example.com');
    await page.fill('#authPass', 'Ab1!');
    await page.fill('#authPassConfirm', 'Ab1!');
    await page.click('#authSubmitBtn');
    await expect(page.locator('#authError')).toContainText(/8 caracteres|minimum/i);
  });

  test('rejects password without uppercase', async ({ page }) => {
    await gotoRegister(page);
    await page.fill('#authEmail', 'test@example.com');
    await page.fill('#authPass', 'abcdefg1!');
    await page.fill('#authPassConfirm', 'abcdefg1!');
    await page.click('#authSubmitBtn');
    await expect(page.locator('#authError')).toContainText(/majuscule/i);
  });

  test('rejects password without digit', async ({ page }) => {
    await gotoRegister(page);
    await page.fill('#authEmail', 'test@example.com');
    await page.fill('#authPass', 'Abcdefgh!');
    await page.fill('#authPassConfirm', 'Abcdefgh!');
    await page.click('#authSubmitBtn');
    await expect(page.locator('#authError')).toContainText(/chiffre/i);
  });

  test('rejects password without special char', async ({ page }) => {
    await gotoRegister(page);
    await page.fill('#authEmail', 'test@example.com');
    await page.fill('#authPass', 'Abcdefg1');
    await page.fill('#authPassConfirm', 'Abcdefg1');
    await page.click('#authSubmitBtn');
    await expect(page.locator('#authError')).toContainText(/special/i);
  });

  test('rejects password mismatch', async ({ page }) => {
    await gotoRegister(page);
    await page.fill('#authEmail', 'test@example.com');
    await page.fill('#authPass', 'ValidPass1!');
    await page.fill('#authPassConfirm', 'Different2@');
    await page.click('#authSubmitBtn');
    await expect(page.locator('#authError')).not.toBeEmpty();
  });

  test('register requires RGPD checkbox', async ({ page }) => {
    await page.goto('/');
    await page.click('#tabRegister');
    // Do NOT check RGPD
    await page.fill('#authEmail', 'test@example.com');
    await page.fill('#authPass', 'ValidPass1!');
    await page.fill('#authPassConfirm', 'ValidPass1!');
    await page.click('#authSubmitBtn');
    await expect(page.locator('#authError')).toContainText(/CGU|confidentialite|accepter/i);
  });

  test('email input has correct attributes', async ({ page }) => {
    await page.goto('/');
    const email = page.locator('#authEmail');
    await expect(email).toHaveAttribute('type', 'email');
    await expect(email).toHaveAttribute('autocomplete', 'email');
    await expect(email).toHaveAttribute('required', '');
  });

  test('password has autocomplete current-password', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#authPass')).toHaveAttribute('autocomplete', 'current-password');
  });
});
