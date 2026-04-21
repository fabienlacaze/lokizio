import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:8000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testDir: './tests/e2e' },
    { name: 'mobile', use: { ...devices['iPhone 13'] }, testDir: './tests/e2e' },
    // Full authenticated user flows against lokizio-test Supabase.
    // Runs serially to avoid session conflicts and share a single http-server.
    {
      name: 'flows',
      testDir: './tests/e2e-flows',
      use: { ...devices['Desktop Chrome'] },
      timeout: 60_000,
      fullyParallel: false,
    },
  ],
  webServer: {
    command: 'npm run serve',
    url: 'http://localhost:8000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
