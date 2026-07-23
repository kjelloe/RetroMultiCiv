// A49 flow-2 (play-visibility): two HUMAN clients in ONE started server game
// each see their OWN fog-filtered view — the ?server=1 per-seat filtering guard
// (the score-view/endscreen fog bugs came from the SAME filter; this pins that a
// seat never leaks the other's view). The server hosts a 2-human game; two
// browser contexts join it directly (each takes the next open seat, the
// browser.test.js LAN-pass topology — no lobby handshake to flake on). In play:
//   - each seat's HUD shows ITS OWN civ/viewpoint (ctx.HUMAN stays local), and
//   - each seat's minimap paints a DIFFERENT fog map (different explored area).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 4242, civs: 2, humans: 2, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

// a fog signature of the fog-filtered minimap (#minimap-map, state-driven — no
// anim noise, unlike the 3D scene canvas): a checksum + a painted-pixel count.
function fogSig(page) {
  return page.evaluate(() => {
    const c = document.getElementById('minimap-map');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let h = 2166136261, painted = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (!(d[i] === 5 && d[i + 1] === 7 && d[i + 2] === 12)) painted++; // void = #05070c
      h = Math.imul(h ^ (d[i] + d[i + 1] * 3 + d[i + 2] * 7 + i), 16777619) >>> 0;
    }
    return { h, painted };
  });
}

test('play-visibility: two seats in one game each see their own fog + viewpoint', async ({ browser }) => {
  test.setTimeout(90000); // two full SwiftShader client boots into the same game
  const base = `http://127.0.0.1:${server.port}/client/`;
  const aCtx = await browser.newContext();
  const bCtx = await browser.newContext();
  try {
    // both clients join the SAME default 2-human game directly; the server hands
    // each the next open seat (p1, then p2). A distinct ?civ= keeps the pick clear.
    const a = await aCtx.newPage();
    await a.goto(`${base}?server=1&civ=romans`);
    await expect(a.locator('#hud-status')).toContainText('turn 1', { timeout: 45000 });
    await expect(a.locator('#minimap')).toBeVisible();

    const b = await bCtx.newPage();
    await b.goto(`${base}?server=1&civ=zulus`);
    await expect(b.locator('#hud-status')).toContainText('turn 1', { timeout: 45000 });
    await expect(b.locator('#minimap')).toBeVisible();

    // (1) per-seat VIEWPOINT: each client keeps its OWN seat (ctx.HUMAN local),
    // so the two HUD status lines name different civilizations — a view leak
    // (both rendering the same seat) would make these identical.
    const aStatus = (await a.locator('#hud-status').textContent()) || '';
    const bStatus = (await b.locator('#hud-status').textContent()) || '';
    expect(aStatus).not.toBe(bStatus);

    // (2) per-seat FOG: the two minimaps paint different explored areas. A filter
    // that leaked the other seat's tiles would make these checksums match.
    const as = await fogSig(a);
    const bs = await fogSig(b);
    expect(as.painted).toBeGreaterThan(0);
    expect(bs.painted).toBeGreaterThan(0);
    expect(as.h).not.toBe(bs.h);
  } finally {
    await aCtx.close();
    await bCtx.close();
  }
});
