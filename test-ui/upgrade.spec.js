// N11 (CP18): the upgrade button — driven end-to-end via the A92 debug
// panel (grant gold + gunpowder, spawn a militia at the capital): the
// action bar offers "Upgrade to Musketeers (💰50)" (10 base + 2/shield ×
// 20Δ — read from the ruleset by the engine's own upgradeCost export),
// clicking pays and swaps the unit in place, and the turnlog names it.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 14, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('upgrade: militia → musketeers for 50 gold, veteran-carrying label', async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2&debug=1&e2e=1`);
    await expect(page.locator('#city-stats')).toBeVisible({ timeout: 30000 });
    await page.keyboard.press('Escape'); // close the e2e panels

    // A92 setup: gold + gunpowder + a militia spawned at the capital
    await page.keyboard.press('c'); // camera exactly on the capital
    await page.locator('#open-debug').click();
    await page.locator('#debug-gold').fill('500');
    await page.locator('#debug-grant-gold').click();
    await page.locator('#debug-tech').selectOption('gunpowder');
    await page.locator('#debug-grant-tech').click();
    await page.locator('#debug-unit').selectOption('militia');
    await page.locator('#debug-spawn').click();
    await page.locator('#debug-close').click();

    // select the spawned militia; the bar offers the priced upgrade
    await page.keyboard.press('n');
    const upBtn = page.locator('#action-bar button', { hasText: 'Upgrade to Musketeers' });
    await expect(upBtn).toBeVisible();
    await expect(upBtn).toContainText('💰50');
    await expect(upBtn).toHaveAttribute('title', /veteran/);
    await upBtn.click();

    // the unit swapped in place and the log line landed
    await expect(page.locator('#hud-selection')).toContainText('Musketeers');
    await page.locator('#turn-log summary').click();
    await expect(page.locator('#turn-list')).toContainText('Militia upgraded to Musketeers (−50💰)');
  } finally {
    await ctx.close();
  }
});
