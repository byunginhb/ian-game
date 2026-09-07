import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: true,
  workers: 4,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm dev --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'android', testIgnore: '**/regressions.spec.js', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'iphone', testIgnore: '**/regressions.spec.js', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
    { name: 'compact', testIgnore: '**/regressions.spec.js', use: { ...devices['iPhone 13'], viewport: { width: 320, height: 568 } } },
    { name: 'landscape', testIgnore: '**/regressions.spec.js', use: { ...devices['Pixel 7'], viewport: { width: 844, height: 390 } } },
  ],
})
