// A49 spec (b): live reconnect — a seated player's socket is severed and the
// client's 1/s retry loop reclaims the seat with its stored token, HUD intact.
// Drives the client's own ?e2e=8 reconnect probe (A46) under Playwright's
// event-driven waits — the reliable complement to browser.test.js's CDP case.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 4, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('reconnect: a severed socket reclaims its seat by token, no errors', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${server.port}/client/?server=1&e2e=8`);
  // ?e2e=8 severs the socket immediately, then the retry loop reconnects and
  // the resync (stateReplaced) flips the probe. Give the 1/s retry room.
  const probe = page.locator('#e2e-probe');
  await expect(probe).toContainText('reconnected:true', { timeout: 15000 });
  await expect(probe).toContainText('seatCode:present'); // reclaimed via the stored token
  await expect(probe).toContainText('errors:0');         // the recovery surfaced no error
});
