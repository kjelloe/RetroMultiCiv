// Live strategic overlay: absent on a normal (fair-play) game; present on a
// ?debug=1 game and populated with per-AI stance/mode/threat rows computed
// from the SAME shared/strategic.js the soak uses.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 15, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('strategic overlay: hidden on a fair game, live on ?debug=1', async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    // a normal local game: no 🧠 button (fairness — AI internals stay hidden)
    const plain = await ctx.newPage();
    await plain.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=3`);
    await expect(plain.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
    await expect(plain.locator('#open-strat')).toHaveCount(0);
    await plain.close();

    // ?debug=1: the overlay exists and lists the AI civs with stance/mode/threat
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=3&debug=1`);
    await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
    await page.locator('#open-strat').click();
    await expect(page.locator('#strat-overlay')).toBeVisible();
    // 3 civs, 1 human → 2 AI rows
    await expect(page.locator('.strat-row')).toHaveCount(2);
    const first = page.locator('.strat-row').first();
    await expect(first.locator('.strat-mode')).toContainText(/warring|expanding|building|defending/);
    await expect(first.locator('.strat-threat')).toContainText('threat:');
  } finally {
    await ctx.close();
  }
});
