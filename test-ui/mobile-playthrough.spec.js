// MOBILE UI PLAYTHROUGH (user request 2026-07-30): not a unit-ish spec but a
// whole session walked at phone size — setup, first turns, founding, city view,
// the panel stack, save/load, options — asserting the things that only break on
// a small screen, and SHOOTING each step into debugging/mobile-playthrough/ so a
// human can review the look in one pass instead of driving a phone by hand.
//
//   npx playwright test test-ui/mobile-playthrough.spec.js
//   (artifacts land in debugging/mobile-playthrough/*.png, gitignored)
//
// The load-bearing assertion is NO HORIZONTAL OVERFLOW: a phone user cannot
// discover UI that sits off the right edge, and every panel we open is checked
// for it. The rest asserts reachability (controls visible, tappable, not
// overlapped) rather than pixels, so it does not fight normal design churn.
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { startServer } from '../server/index.js';

const SHOTS = path.join('debugging', 'mobile-playthrough');
const PHONE = { width: 390, height: 844 };   // iPhone-class portrait
const SMALL = { width: 360, height: 640 };   // the small-Android floor

let server;
test.beforeAll(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  server = await startServer({ seed: 9, civs: 3, humans: 1, size: 'small', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

// a phone user cannot scroll sideways to find UI: anything wider than the
// viewport is unreachable. Checked after every panel we open.
async function noHorizontalOverflow(page, where) {
  const over = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth
  }));
  expect(over.scroll, `${where}: content is wider than the phone screen`).toBeLessThanOrEqual(over.inner + 1);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

test('mobile playthrough: setup → play → city → panels → save, at phone size', async ({ browser }) => {
  test.setTimeout(180000);
  const ctx = await browser.newContext({ viewport: PHONE, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  // main.js:150 aborts the bootstrap with `throw new Error('setup')` when a bare
  // URL should show the setup screen — deliberate control flow, not a fault, so
  // it is the one page error this playthrough tolerates. Anything else fails.
  page.on('pageerror', e => { if (!/Error: setup$/.test(String(e))) errors.push(String(e)); });

  // --- 1. the start screen (the ruled title + the repo subtitle) -------------
  await page.goto(`http://127.0.0.1:${server.port}/client/`);
  await expect(page.locator('#setup-box h2')).toContainText('A World Begun');
  const sub = page.locator('.setup-subtitle a');
  await expect(sub).toBeVisible();
  await expect(sub).toHaveAttribute('href', /github\.com/);
  await noHorizontalOverflow(page, 'setup screen');
  await shot(page, '01-setup');

  // every control on the setup screen must be reachable inside the viewport
  const offscreen = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('#setup-box select, #setup-box button, #setup-box input')) {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1)) out.push(el.id || el.tagName);
    }
    return out;
  });
  expect(offscreen, 'setup controls sit off the phone screen').toEqual([]);

  // --- 2. into a game ------------------------------------------------------
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=9&civs=3&size=small&zoom=5`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 60000 });
  await noHorizontalOverflow(page, 'in game');
  await shot(page, '02-first-turn');

  // the touch controls a phone player depends on
  await expect(page.locator('#dpad')).toBeVisible();
  await expect(page.locator('#end-turn')).toBeVisible();
  const clash = await page.evaluate(() => {
    const r = id => { const e = document.getElementById(id); return e ? e.getBoundingClientRect() : null; };
    const a = r('dpad'), b = r('end-turn');
    if (!a || !b) return false;
    return !(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y);
  });
  expect(clash, 'the d-pad overlaps End Turn on a phone').toBe(false);

  // --- 3. found a city and open the city view ------------------------------
  // 'b' does not found immediately — it opens the NAME DIALOG, which must be
  // confirmed by TAP on a phone (a keystroke here would type into the field;
  // the first run of this playthrough did exactly that and stalled).
  await page.keyboard.press('b');
  await expect(page.locator('#name-dialog')).toBeVisible({ timeout: 10000 });
  await noHorizontalOverflow(page, 'city name dialog');
  await shot(page, '03a-name-dialog');
  // REGRESSION GUARD (found here 2026-07-30): the touch d-pad used to cover the
  // CENTRE of this button, so a tap panned the map instead of founding the city.
  // Ask the DOM what is actually on top at the tap point, not just whether the
  // button is "visible" — visibility never catches an overlay.
  const onTop = await page.evaluate(() => {
    const b = document.getElementById('name-ok').getBoundingClientRect();
    const el = document.elementFromPoint((b.x + b.right) / 2, (b.y + b.bottom) / 2);
    return el ? (el.id || el.className || el.tagName) : null;
  });
  expect(onTop, 'something overlays the Found city button at its tap point').toBe('name-ok');
  await page.locator('#name-ok').click();
  await page.waitForTimeout(700);
  await shot(page, '03b-founded');

  // founding opens the city panel directly (input.js foundCityFlow)
  await expect(page.locator('#city-panel')).toBeVisible({ timeout: 10000 });
  await noHorizontalOverflow(page, 'city view');
  await shot(page, '04-city-view');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // --- 4. the panel stack, one at a time -----------------------------------
  for (const [key, name] of [['t', 'tech-tree'], ['o', 'overview'], ['l', 'turnlog']]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(350);
    await noHorizontalOverflow(page, `panel ${name}`);
    await shot(page, `05-panel-${name}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }

  // --- 5. a few turns, so the log and the AI actually move ------------------
  for (let i = 0; i < 3; i++) {
    await page.locator('#end-turn').click();
    await page.waitForTimeout(900);
  }
  await noHorizontalOverflow(page, 'after three turns');
  await shot(page, '06-after-turns');

  // --- 6. save/load reachability WITHOUT a keyboard (the touch path) --------
  // Save is a corner button; Load lives in the Options panel — a phone player
  // has no Shift+S, so both must be reachable by tapping alone.
  await expect(page.locator('#save-game-btn')).toBeVisible();
  await page.locator('#open-options').click();
  await page.waitForTimeout(300);
  await expect(page.locator('#opt-load')).toBeVisible();
  await noHorizontalOverflow(page, 'options panel');
  await shot(page, '07-options-save-load');
  await page.keyboard.press('Escape');

  expect(errors, 'the console reported errors during the playthrough').toEqual([]);
  await ctx.close();
});

test('mobile playthrough: the small-Android floor still fits', async ({ browser }) => {
  test.setTimeout(120000);
  const ctx = await browser.newContext({ viewport: SMALL, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=9&civs=3&size=small&zoom=5`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 60000 });
  await noHorizontalOverflow(page, `${SMALL.width}px in game`);
  await expect(page.locator('#end-turn')).toBeVisible();
  await shot(page, '08-small-android');
  await ctx.close();
});
