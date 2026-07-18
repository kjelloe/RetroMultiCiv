// A49 coverage (#1705 item 4): the city view's SELL-BUILDING two-step (A97) —
// first click ARMS ("Confirm? 💰N"), a second click within the window sells.
// DOM coverage the A97 ship deferred to "when A49 lands". Loads a tiny
// engine-generated fixture (a p1 city with a barracks) so a sellable building
// exists. Golden-neutral (client DOM only).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'sell-building.json');

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('city view: sell-building arm → confirm two-step (A97)', async ({ page }) => {
  page.on('dialog', d => d.accept()); // safety net (fixture has no ruleset drift)
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  // load the fixture: a p1-owned city (Tenochtitlan) holding a barracks
  await page.setInputFiles('input[type=file][accept*="json"]', FIXTURE);
  await page.waitForTimeout(1000); // replaceState + the load recenter

  // open the city panel — the load recenters on the city, so it's at canvas
  // center; a click (else double-click) on it opens the panel
  const canvas = page.locator('#app canvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.click(cx, cy);
  if (await page.locator('#city-panel').isHidden()) await page.mouse.dblclick(cx, cy);
  await expect(page.locator('#city-panel')).toBeVisible({ timeout: 5000 });

  // the barracks row shows a Sell button (owner's turn — A97)
  const sell = page.locator('.sell-btn').first();
  await expect(sell).toContainText('💰 Sell');

  // first click ARMS the two-step confirm
  await sell.click();
  await expect(sell).toHaveClass(/armed/);
  await expect(sell).toContainText('Confirm?');

  // second click SELLS — the barracks and its sell button leave the panel
  await sell.click();
  await expect(page.locator('.sell-btn')).toHaveCount(0);
  await expect(page.locator('#city-stats')).not.toContainText('Barracks');
});
