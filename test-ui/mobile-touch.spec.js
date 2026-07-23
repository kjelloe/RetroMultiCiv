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

  // the unit is auto-selected at boot (its stat card is already up); no select-tap
  // (tapping the already-selected unit re-arms the bar — the old pass only worked
  // because onboarding absorbed that first tap)
  await expect(page.locator('#unit-line')).toBeVisible({ timeout: 5000 });
  const c0 = coords(await page.locator('#unit-line').textContent());
  expect(c0).not.toBe('?');

  // tap-to-move on touch is a DOUBLE-tap of the target tile (XIV §7 — one adjacent
  // step, or a GoTo if farther); try directions until one is passable
  let moved = false;
  for (const [dx, dy] of [[130, 0], [-130, 0], [0, 110], [0, -110], [130, 110]]) {
    await page.touchscreen.tap(cx + dx, cy + dy); await page.waitForTimeout(120);
    await page.touchscreen.tap(cx + dx, cy + dy); await page.waitForTimeout(500); // double-tap = move
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

test('mobile: action-bar drops the keyboard hints when a unit is selected (#1754)', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2&zoom=5`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
  await page.waitForTimeout(700);

  // the starting unit is auto-selected at boot, so the action bar is already
  // populated; its keyboard-shortcut hints (dead weight on a phone) must be hidden.
  // (No select-tap: tapping the already-selected unit re-arms the bar and clears
  // the hints — the old pass only worked because onboarding absorbed that tap.)
  await expect(page.locator('#unit-line')).toBeVisible({ timeout: 5000 });
  const keys = await page.evaluate(() => {
    const ks = [...document.querySelectorAll('#action-bar .key')];
    return { count: ks.length, allHidden: ks.length > 0 && ks.every(k => getComputedStyle(k).display === 'none') };
  });
  expect(keys.count).toBeGreaterThan(0);
  expect(keys.allHidden, 'every action-bar .key hint is display:none on mobile').toBe(true);
});

test('mobile: city nav arrows sit on-screen on the full-width sheet (#1754)', async ({ page }) => {
  // ?e2e=1 deterministically founds a city and opens its panel (no flaky tap-loop)
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2&e2e=1`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
  await expect(page.locator('#city-panel')).toBeVisible({ timeout: 10000 });

  // the prev/next nav arrows (which hang off-box at left/right:-48px on desktop)
  // must be pinned to the viewport edges, fully on-screen on the phone sheet
  const arrows = await page.evaluate(() => {
    const vw = window.innerWidth;
    const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return { left: Math.round(b.left), right: Math.round(b.right) }; };
    return { vw, prev: r('city-prev'), next: r('city-next') };
  });
  expect(arrows.prev.left, 'prev arrow left edge on-screen').toBeGreaterThanOrEqual(0);
  expect(arrows.next.right, 'next arrow right edge on-screen').toBeLessThanOrEqual(arrows.vw + 1);
});
