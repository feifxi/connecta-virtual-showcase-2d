import { defineConfig } from '@playwright/test';

// End-to-end against a running stack (dev servers or the production compose) seeded with `npm run db:seed`
// BASE=http://localhost:3000 npm run e2e · uses the locally installed Chrome (fake mic/camera)
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: process.env.BASE ?? 'http://localhost:3000',
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
    trace: 'retain-on-failure',
  },
});
