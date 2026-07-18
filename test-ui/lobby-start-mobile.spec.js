// L5 (#1696, user X.6): a MOBILE seated player who joins the lobby, waits, and
// sees the host START must boot into the game (the reported hang was "start
// showed NOTHING"). This pins the ACTIVE-connection seated-start path on a phone
// viewport (the drop-while-backgrounded case is the separate mobile-resilience
// A+B+C class). Also pins the L5 fix: ?mlog=1 survives the persistAndBoot reload
// so a console-less phone can self-report through the game boot.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('mobile seated player boots the game when the host starts; mlog survives the reload', async ({ browser }) => {
  const base = `http://127.0.0.1:${server.port}/client/`;
  const hostCtx = await browser.newContext();
  const joinCtx = await browser.newContext({ viewport: { width: 412, height: 800 }, isMobile: true, hasTouch: true });
  try {
    // host holds a 2-human lobby
    const host = await hostCtx.newPage();
    await host.goto(`${base}?e2ehost=1&e2ecivs=2&e2ehumans=2&e2ehold=1`);
    await expect(host.locator('#lobby-code')).toBeVisible({ timeout: 30000 });
    const code = (await host.locator('#lobby-code').textContent()).trim();

    // mobile joiner joins the lobby (with the on-screen mlog armed)
    const join = await joinCtx.newPage();
    await join.goto(`${base}?e2ejoin=${code}&mlog=1`);
    await expect(join.locator('#lobby-code')).toHaveText(code, { timeout: 30000 });

    // host starts → the joiner must reload into the seated game, not hang blank
    await host.locator('#setup-start').click();
    await expect(join.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
    await expect(join.locator('#app canvas')).toBeVisible();
    await expect(join.locator('#setup-box')).toHaveCount(0); // left the lobby screen

    // L5: the debug overlay survived the persistAndBoot reload (mobile self-report)
    expect(join.url()).toContain('mlog=1');
    await expect(join.locator('#mlog')).toBeVisible();
  } finally {
    await hostCtx.close();
    await joinCtx.close();
  }
});
