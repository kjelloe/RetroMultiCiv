// C4 (§4 UX leg): sentry via the V key — cycling skips the asleep unit,
// End Turn stops warning about it, and clicking it wakes it. (The wake-on-
// enemy radius + the automation policy are unit-tested in
// test/automate.test.js — deterministic crafted states.)
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 9, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('sentry: V sleeps, N skips, End Turn quiet, click wakes', async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2`);
    await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
    // the starting settler is auto-selected; the action bar carries Sentry
    await expect(page.locator('#action-bar')).toContainText('Sentry');

    await page.keyboard.press('v');
    await expect(page.locator('#hud-selection')).toContainText('sentried');
    // the ONLY unit is asleep: cycling finds nothing (N re-check)
    await page.keyboard.press('n');
    await expect(page.locator('#hud-selection')).toContainText('no units with moves left');

    // End Turn goes through WITHOUT the still-has-moves confirm (one press)
    await page.keyboard.press('e');
    await expect(page.locator('#hud-status')).toContainText('turn 2', { timeout: 15000 });

    // clicking the unit wakes it (camera booted centered on it)
    const canvas = page.locator('#app canvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('#hud-selection')).toContainText('awake');
  } finally {
    await ctx.close();
  }
});
