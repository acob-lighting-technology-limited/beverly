import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests run the real web app and API against the in-memory dev server (sample data).
 * They use their own ports and always start fresh servers, so they never collide with, or talk to, a dev server you already
 * have running (which may be wired to real services).
 */
const WEB = 5199
const API = 8799

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${WEB}`, channel: 'msedge', trace: 'retain-on-failure' },
  webServer: [
    { command: 'pnpm dev:mock', url: `http://127.0.0.1:${API}/api/health`, reuseExistingServer: false, timeout: 90_000, env: { MOCK_PORT: String(API), MOCK_ORIGIN: `http://127.0.0.1:${WEB}` } },
    { command: `pnpm --filter @beverly-call/web exec vite --host 127.0.0.1 --port ${WEB} --strictPort`, url: `http://127.0.0.1:${WEB}`, reuseExistingServer: false, timeout: 90_000, env: { API_PROXY_TARGET: `http://127.0.0.1:${API}` } },
  ],
})
