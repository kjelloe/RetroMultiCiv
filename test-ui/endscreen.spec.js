// A49 flow-4 + regression-guard 3: the END-GAME endscreen play-lane. Two halves:
//   1. ?ending=<kind> previews each Founder's Record MOMENT over a live local game
//      — asserts the moment plays, is CONTINUE-gated (no auto-close), and reveals a
//      scoreboard with real content. Covers all four endings deterministically.
//   2. a REAL ?server=1 gameOver (endYear at the start year → the first End Turn
//      ends it) renders the endscreen over the FOG-FILTERED server view without
//      crashing — the score-view/endscreen fog bug class (guard 3).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  // endYear = the start year (4000 BC = -4000): score.js ends the game as soon as
  // the first turn is processed (state.year >= endYear).
  server = await startServer({
    seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false,
    host: '127.0.0.1', rulesOverrides: { endYear: -4000 }
  });
});
test.afterAll(async () => { await server.close(); });

// Click through the Continue-gated moment stages until the scoreboard appears.
// Asserts a moment card + a Continue button existed en route (the gate).
async function throughMoment(page) {
  await expect(page.locator('#moment-card')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('#moment-continue')).toBeVisible(); // Continue-gated, never auto-closes
  for (let i = 0; i < 6; i++) {
    if (await page.locator('#endscreen').count() > 0) break;
    const cont = page.locator('#moment-continue');
    if (await cont.count() === 0) break;
    await cont.click();
    await page.waitForTimeout(150);
  }
  await expect(page.locator('#endscreen')).toBeVisible({ timeout: 10000 });
}

for (const kind of ['defeat', 'score', 'conquest', 'space']) {
  test(`endscreen: the ${kind} Founder's Record moment plays, Continue-gates, and reveals the scoreboard`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    // local game (no ?server=1) + the ?ending preview hook
    await page.goto(`http://127.0.0.1:${server.port}/client/?seed=7&civs=2&ending=${kind}`);
    await throughMoment(page);
    // the scoreboard carries real content — a verdict line + at least one standings row
    await expect(page.locator('#endscreen-verdict')).toBeVisible();
    await expect(page.locator('#endscreen-table tbody tr').first()).toBeVisible();
    if (kind === 'space') await expect(page.locator('#endscreen-card.stellar')).toBeVisible(); // the stellar frame
    expect(errors, `a page error surfaced during the ${kind} ending`).toEqual([]);
    await ctx.close();
  });
}

test('endscreen: a real ?server=1 gameOver renders the endscreen on the fog-filtered view', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.port}/client/?server=1`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  // End the turn → endYear reached → score victory → gameOver. The unmoved-units
  // gate needs a confirm, so click End Turn until the moment/endscreen appears.
  for (let i = 0; i < 5; i++) {
    if (await page.locator('#moment-card, #endscreen').count() > 0) break;
    const btn = page.locator('#end-turn');
    if (await btn.isVisible().catch(() => false)) await btn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  // the endscreen must render over the fog-filtered server view (no crash)
  await throughMoment(page);
  await expect(page.locator('#endscreen-verdict')).toBeVisible();
  await expect(page.locator('#endscreen-table tbody tr').first()).toBeVisible();
  expect(errors, 'a page error surfaced on the fog-filtered gameOver view').toEqual([]);
  await ctx.close();
});
