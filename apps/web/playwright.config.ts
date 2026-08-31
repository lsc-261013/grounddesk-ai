import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.E2E_BASE_URL?.trim()
const localWebServers = [
  {
    command: 'pnpm --filter @grounddesk/api dev',
    cwd: '../..',
    url: 'http://127.0.0.1:8787/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  {
    command: 'pnpm --filter @grounddesk/web dev',
    cwd: '../..',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
]

export default defineConfig({
  testDir: './e2e',
  outputDir: '../../test-results/playwright',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: externalBaseUrl || 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  ...(externalBaseUrl ? {} : { webServer: localWebServers }),
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
