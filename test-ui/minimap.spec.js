// C1 (specs/civ24-features-proposal.md §1): the world minimap — paints >0
// non-void pixels after boot (fog-honest: SOME tiles are explored at start,
// most are not), and a click jumps the camera (renderer.getView moves).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 6, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('minimap: fog-honest paint + click-to-jump', async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${server.port}/client/?seed=1&civs=2`);
    await expect(page.locator('#minimap')).toBeVisible({ timeout: 30000 });
    const counts = await page.evaluate(() => {
      const c = document.getElementById('minimap-map');
      const g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let painted = 0, voidPx = 0;
      for (let i = 0; i < d.length; i += 4) {
        // void = #05070c
        if (d[i] === 5 && d[i + 1] === 7 && d[i + 2] === 12) voidPx++;
        else painted++;
      }
      return { painted, voidPx, total: d.length / 4 };
    });
    // explored start area painted, the rest fog-void
    expect(counts.painted).toBeGreaterThan(0);
    expect(counts.voidPx).toBeGreaterThan(counts.total / 2);

    // click the minimap's far corner: the camera (and so the viewport
    // rectangle's centroid on the rect layer) must move there
    const centroid = () => page.evaluate(() => {
      const c = document.getElementById('minimap-rect');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let on = 0, sx = 0, sy = 0;
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] > 0) { const px = (i - 3) / 4; on++; sx += px % c.width; sy += Math.floor(px / c.width); }
      }
      return on === 0 ? null : { x: sx / on, y: sy / on, on };
    });
    await page.waitForTimeout(300);
    const before = await centroid();
    expect(before).not.toBeNull();
    await page.evaluate(() => {
      const mm = document.getElementById('minimap');
      const r = mm.getBoundingClientRect();
      mm.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: r.left + r.width * 0.85, clientY: r.top + r.height * 0.85,
        bubbles: true, pointerId: 7
      }));
    });
    await page.waitForTimeout(300);
    const after = await centroid();
    expect(after).not.toBeNull();
    const dist = Math.hypot(after.x - before.x, after.y - before.y);
    expect(dist).toBeGreaterThan(3);
  } finally {
    await ctx.close();
  }
});
