// Mobile touch-gameplay (#1736, user T0 playtest): the core interactions on a
// phone viewport must work by TAP — select a unit, move it, open a city and
// pick production — and the city panel (whose desktop `overflow: visible` lets
// its nav arrows hang outside) must SCROLL on a phone so the whole catalog is
// reachable. Golden-neutral (render/UI only). Emulates a Pixel 5 (touch,
// chromium — the descriptor keeps this project's installed browser).
import { test, expect, devices } from '@playwright/test';
import { startServer } from '../server/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'temple-oracle.json');

test.use({ ...devices['Pixel 5'] });

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 2, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

const coords = t => { const m = (t || '').match(/\((\d+),(\d+)\)/); return m ? m[1] + ',' + m[2] : '?'; };

test('mobile: tap selects a unit and tap-to-move moves it', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2&zoom=5`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
  await page.waitForTimeout(800);
  const box = await page.locator('#app canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  // tap the auto-centered unit → selected (its stat card appears)
  await page.touchscreen.tap(cx, cy);
  await expect(page.locator('#unit-line')).toBeVisible({ timeout: 5000 });
  const c0 = coords(await page.locator('#unit-line').textContent());
  expect(c0).not.toBe('?');

  // tap-to-move: tap a tile a couple over; try directions until one is passable
  let moved = false;
  for (const [dx, dy] of [[130, 0], [-130, 0], [0, 110], [0, -110], [130, 110]]) {
    await page.touchscreen.tap(cx, cy); await page.waitForTimeout(200);           // reselect
    await page.touchscreen.tap(cx + dx, cy + dy); await page.waitForTimeout(450);
    if (coords(await page.locator('#unit-line').textContent()) !== c0) { moved = true; break; }
  }
  expect(moved, 'tap-to-move changed the unit tile').toBe(true);
});

test('mobile: city panel scrolls so the whole production catalog is reachable', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2&zoom=5`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
  await page.waitForTimeout(700);
  await page.setInputFiles('input[type=file][accept*="json"]', FIXTURE);
  await page.waitForTimeout(1000);

  // open the city (single tap; fall back to the stack's "Open city view")
  const box = await page.locator('#app canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const panel = page.locator('#city-panel');
  for (let i = 0; i < 3 && !(await panel.isVisible().catch(() => false)); i++) {
    await page.touchscreen.tap(cx, cy); await page.waitForTimeout(400);
    const ocv = page.locator('button', { hasText: 'Open city view' });
    if (await ocv.isVisible().catch(() => false)) { await ocv.tap(); await page.waitForTimeout(400); }
  }
  await expect(panel).toBeVisible();

  // the full-screen sheet must be vertically scrollable (the fix): content
  // taller than the viewport, overflow-y auto, and scrollTop actually moves
  const m = await page.evaluate(() => {
    const p = document.getElementById('city-panel');
    return { overflowY: getComputedStyle(p).overflowY, scrollH: p.scrollHeight, clientH: p.clientHeight };
  });
  expect(m.overflowY).toBe('auto');
  expect(m.scrollH).toBeGreaterThan(m.clientH);
  const top = await page.evaluate(() => {
    const p = document.getElementById('city-panel'); p.scrollTop = p.scrollHeight; return p.scrollTop;
  });
  expect(top, 'panel scrolled down').toBeGreaterThan(0);

  // a production option that lives below the fold is reachable + settable
  const opts = page.locator('#city-panel .option:not(.current):not([disabled])');
  const last = opts.nth(await opts.count() - 1);
  const before = await page.evaluate(() => document.querySelector('#city-panel .option.current')?.textContent || '');
  await last.scrollIntoViewIfNeeded();
  await last.tap();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => document.querySelector('#city-panel .option.current')?.textContent || '');
  expect(after).not.toBe(before);
});
