// Playwright config for the NDE smoke test (tests/smoke/). Issue #75: the Angular 20 upgrade.
//
// The smoke test drives a *deployed* view — it does not build or serve anything. Point it with:
//   SMOKE_BASE_URL  default https://tau.primo.exlibrisgroup.com
//                   (the dev proxy, http://localhost:4201, also works: it serves the local build)
//   SMOKE_VID       default 972TAU_INST:NDE
//
// Full guide: tests/smoke/README.md
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/smoke',
  // The host is slow to boot and the module loads after it; a single page can take 20s+.
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  workers: 3,
  // A live site flakes; one retry tells a flake from a break without hiding a real failure.
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    // Wide enough that the host renders the filter side panel in-page rather than in a drawer.
    viewport: { width: 1440, height: 900 },
    baseURL: process.env.SMOKE_BASE_URL || 'https://tau.primo.exlibrisgroup.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
