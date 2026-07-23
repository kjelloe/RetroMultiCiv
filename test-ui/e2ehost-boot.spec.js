// e2ehost host-boot (helper #2376, root-caused): the onboarding overlay (a
// full-screen click-to-dismiss layer) fired on the bare-URL ?e2ehost= path and
// sat OVER the lobby's Start button, swallowing the click — so the HOST never
// started/booted (lobby-start-mobile masked it by only asserting the GUEST).
// Fixed in main.js (onboarding is suppressed under e2e/demo params). This spec
// UN-MASKS the host: BOTH contexts must boot when the host starts.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => { server = await startServer({ seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' }); });
test.afterAll(async () => { await server.close(); });

test('e2ehost: BOTH the host and the guest boot the game when the host starts', async ({ browser }) => {
  test.setTimeout(90000);
  const base = `http://127.0.0.1:${server.port}/client/`;
  const hostCtx = await browser.newContext();
  const joinCtx = await browser.newContext();
  try {
    const host = await hostCtx.newPage();
    await host.goto(`${base}?e2ehost=1&e2ecivs=2&e2ehumans=2&e2ehold=1`);
    await expect(host.locator('#lobby-code')).toBeVisible({ timeout: 30000 });
    const code = (await host.locator('#lobby-code').textContent()).trim();

    const join = await joinCtx.newPage();
    await join.goto(`${base}?e2ejoin=${code}`);
    await expect(join.locator('#lobby-code')).toHaveText(code, { timeout: 30000 });
    await expect(host.locator('#setup-box')).toContainText('Ada', { timeout: 30000 });

    await host.locator('#setup-start').click();
    for (const p of [host, join]) {
      await expect(p.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
      await expect(p.locator('#setup-box')).toHaveCount(0);
    }
  } finally {
    await hostCtx.close();
    await joinCtx.close();
  }
});
