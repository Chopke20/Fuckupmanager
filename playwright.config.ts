import { defineConfig, devices } from '@playwright/test'

const webPort = Number(process.env.WEB_PORT ?? 5180)

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Uruchom pełny stos (API + web) przed testami. Ustaw WEB_PORT=5180 jeśli chcesz stały port.
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${webPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
