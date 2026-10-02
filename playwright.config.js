import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: { baseURL: 'http://localhost:10000', serviceWorkers: 'block', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium-phone', use: { ...devices['Pixel 7'], defaultBrowserType: 'chromium' } },
    { name: 'webkit-phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } }
  ],
  webServer: { command: 'npm start', url: 'http://localhost:10000/health', reuseExistingServer: true, timeout: 30000 }
});
