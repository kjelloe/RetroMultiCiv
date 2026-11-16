// The soundtrack (client/music + shared/music-theme.js): a game boots, the
// player fetches the theme rule's piece, and nothing throws. Listening quality
// is the user's ears (debugging/soundboard.html), not this lane.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 2, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('a new game loads the ancient map piece and plays without page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const piece = page.waitForResponse(r => r.url().endsWith('/client/music/pieces/map-ancient.json'));
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&size=xsmall&civs=2`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
  expect((await piece).status()).toBe(200);
  await page.mouse.click(5, 5); // a gesture resumes the audio context
  await page.waitForTimeout(600); // a few 100 ms player ticks
  expect(errors).toEqual([]);
});
