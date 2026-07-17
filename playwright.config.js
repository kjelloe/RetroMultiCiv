// A49: the nightly multi-client UI lane. NOT under test/ — `node --test test/`
// stays playwright-free and fast; this runs via `npx playwright test`. Config
// mirrors the headless SwiftShader setup the screenshot tooling uses
// (debugging/screenshot.sh): no GPU here, so WebGL needs ANGLE→SwiftShader.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test-ui',
  fullyParallel: false,
  workers: 2,                       // ws contention is measured + real (B2)
  retries: process.env.CI ? 1 : 0,
  reporter: [['line']],
  timeout: 30000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      // same flags as debugging/screenshot.sh — WebGL1 via SwiftShader, no sandbox
      args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader']
    }
  }
});
