import { defineConfig, devices } from '@playwright/test';

const PORT = 4318;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `node dist/server/server/main.js --port ${PORT}`,
    url: `http://localhost:${PORT}/api/sample/me`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
