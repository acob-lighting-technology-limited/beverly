import { defineConfig } from '@playwright/test'

/** End-to-end tests run the real web app and API against the in-memory dev server (sample data). */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', channel: 'msedge', trace: 'retain-on-failure' },
  webServer: [
    { command: 'pnpm dev:mock', url: 'http://127.0.0.1:8787/api/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'pnpm dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 60_000 },
  ],
})
