import { defineConfig, devices } from '@playwright/test'

// E2E tests create real client records in the local database. Keep every Playwright
// process, helper subprocess, and locally spawned app server from queuing external
// Redwood/ToxAccess automation, regardless of the developer's .env setting.
process.env.REDWOOD_AUTOMATION_ENABLED = 'false'

const port = Number(process.env.PORT || 3000)
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`
const workers = Number(process.env.PLAYWRIGHT_WORKERS || 1)
const slowMo = process.env.PLAYWRIGHT_SLOW_MO ? Number(process.env.PLAYWRIGHT_SLOW_MO) : undefined

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  // Next canary + Turbopack dev server actions have been flaky under concurrent E2E workers.
  // Keep the default stable, and allow opt-in overrides via PLAYWRIGHT_WORKERS.
  workers,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    launchOptions: slowMo ? { slowMo } : undefined,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `pnpm dev --port ${port}`,
        url: baseURL,
        timeout: 180_000,
        // Reusing a developer server could inherit REDWOOD_AUTOMATION_ENABLED=true.
        // Fail on a busy port instead of running E2E against an unsafe process.
        reuseExistingServer: false,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
