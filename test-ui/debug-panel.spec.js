// A92: the client debug panel — exists ONLY on debug-enabled games, issues
// ordinary logged commands (engine judges), and the first success taints
// the game permanently (⚠ DEBUG on the HUD status + the save toast).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 13, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('debug panel: absent on normal games, live grant-gold taints the game', async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    // a NORMAL local game: no 🐞 button
    const plain = await ctx.newPage();
    await plain.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2`);
    await expect(plain.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
    await expect(plain.locator('#open-debug')).toHaveCount(0);
    await plain.close();

    // a ?debug=1 game: the panel exists; grantGold lands + taints
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2&debug=1`);
    await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
    await expect(page.locator('#hud-status')).not.toContainText('DEBUG'); // enabled ≠ tainted
    await page.locator('#open-debug').click();
    await expect(page.locator('#debug-panel')).toBeVisible();
    const goldOf = async () =>
      Number(((await page.locator('#research-label').innerText()).match(/💰 (\d+)/) || [0, 0])[1]);
    const before = await goldOf();
    await page.locator('#debug-gold').fill('250');
    await page.locator('#debug-grant-gold').click();
    // gold rose by exactly the grant (start gold varies by civ specialty)
    await expect(async () => {
      expect(await goldOf()).toBe(before + 250);
    }).toPass({ timeout: 10000 });
    await expect(page.locator('#hud-status')).toContainText('⚠ DEBUG');
    await expect(page.locator('#debug-taint')).toContainText('tainted');
    // the save toast carries the watermark (F5 quick-save)
    await page.keyboard.press('F5');
    await expect(page.locator('#code-toast')).toContainText('DEBUG');
  } finally {
    await ctx.close();
  }
});
