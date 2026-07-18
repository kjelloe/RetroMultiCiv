// Late-game save loading (#1668): a user's HOSTED-game save is a
// `retromulticiv-server-save`; the client must load it (A), recenter the camera
// so the map isn't blank (B), and — since the save records the now-DEAD other
// human seat — collapse non-self humans to AI so a solo load doesn't hotseat
// hand off to a dead player (C). Drives the real turn-1617 g5khd save.
// Golden-neutral (client load path only).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAVE = path.join(__dirname, '..', 'debugging', 'logs', 'retromulticiv-g5khd-turn-1617.json');

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('server-save loads locally, recenters, and collapses non-self humans', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('dialog', d => d.accept()); // the ruleset-drift confirm()
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  // (A) the server-save envelope loads (before the fix: "not a RetroMultiCiv save")
  await page.setInputFiles('input[type=file][accept*="json"]', SAVE);
  await expect(page.locator('#hud-status')).toContainText('turn 1617', { timeout: 30000 });
  await page.waitForTimeout(600);

  // (B) the camera recentered onto the human's empire — read the minimap's
  // viewport rectangle (a 2D canvas, so getImageData works, unlike the WebGL
  // main view) and assert its centroid is over p1's cities (top-left of this
  // 40×25 map: Tenochtitlan etc. at x≈6-10, y≈3-6). Before the fix the camera
  // stayed at its pre-load position and the map rendered blank.
  const rect = await page.evaluate(() => {
    const c = document.getElementById('minimap-rect');
    if (!c || !c.width) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 10) { sx += x; sy += y; n++; }
    }
    return n > 0 ? { x: sx / n / c.width, y: sy / n / c.height } : null;
  });
  // (x wraps — the map is cylindrical, so the horizontal centroid is unreliable;
  // the vertical axis does NOT wrap, and p1's cities sit in the map's TOP third)
  expect(rect, 'the minimap viewport rectangle is drawn').not.toBeNull();
  expect(rect.y, 'camera recentered onto p1 cities (top of the map)').toBeLessThan(0.45);
  await page.screenshot({ path: test.info().outputPath('late-loaded.png') });

  // (C) ending the turn must NOT hotseat hand off to the dead second human —
  // it was collapsed to AI, so no hand-off screen appears
  await page.keyboard.press('e');
  await page.waitForTimeout(2500);
  await expect(page.locator('#handoff-screen')).toBeHidden(); // no hand-off to the dead p2

  expect(errors, 'no error while loading the late-game save').toEqual([]);
});
