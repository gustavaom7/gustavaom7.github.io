import { defineConfig, devices } from '@playwright/test';

// BASE_URL points the suite at the published site; without it a local server is started.
const baseURL = process.env.BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // IGNORE_HTTPS_ERRORS is for sandboxes behind a TLS-intercepting proxy (Google Fonts, the badge).
  use: { baseURL, trace: 'retain-on-failure', ignoreHTTPSErrors: !!process.env.IGNORE_HTTPS_ERRORS },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // iPhone 12 viewport, touch and user agent on Chromium (isMobile is supported there).
    { name: 'mobile', use: { ...devices['iPhone 12'], browserName: 'chromium' } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npm run serve', url: baseURL, reuseExistingServer: !process.env.CI },
});
