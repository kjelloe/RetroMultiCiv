// A49 spec (c): a spectator joins tokenless, sees the whole (omniscient) map,
// and controls nothing. Uses the server's already-started DEFAULT game via
// ?server=1&spectate=1 — no lobby dance needed.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  // spectators default ON; the default game is 'started' at boot
  server = await startServer({ seed: 3, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('spectator: tokenless, omniscient view, no controls', async ({ browser }) => {
  const ctx = await browser.newContext();
  const errors = [];
  try {
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${server.port}/client/?server=1&spectate=1`);
    // connected as a spectator: the tokenless spectator chip appears
    await expect(page.locator('#spectator-chip')).toBeVisible();
    // view-only: the selection hint invites watching, never controlling
    await expect(page.locator('#hud-selection')).toContainText('watching');
    // the map rendered (the three.js canvas is present)
    await expect(page.locator('#app canvas')).toBeVisible();
    // controls nothing: the End Turn button never shows for a spectator
    await expect(page.locator('#end-turn')).toBeHidden();
    // L6 seat-action AUDIT — every command-issuing control absent/inert:
    await expect(page.locator('#regent-btn')).toHaveCount(0);   // the 🤖 regency button never exists
    await expect(page.locator('#action-bar')).toBeHidden();     // no unit orders
    await expect(page.locator('#unit-line')).toBeHidden();      // no seat stat card
    await page.keyboard.press('t');                             // research stays closed (view-only note instead)
    await expect(page.locator('#research-panel')).toBeHidden();

    // spectator MESSAGE AUDIT (#1652): the seated-player action keys are no-ops
    // for a seatless viewer — no command mis-fires, and no crash from the keys
    // that read players[ctx.HUMAN] (i/m/r/o/c/production) which a spectator lacks
    for (const k of ['b', 'f', 'i', 'm', 'r', 'o', 'c', 'n', ' ', '1', '2', '3', 'g', 'k', 'h', 'p', 'x']) {
      await page.keyboard.press(k === ' ' ? 'Space' : k);
    }
    // first-timer ADVICE is a seated-player aid — a spectator gets none
    await expect(page.locator('#advice-card')).toHaveCount(0);
    // the action bar stayed hidden and nothing crashed
    await expect(page.locator('#action-bar')).toBeHidden();
    expect(errors, 'spectator keys raised no error').toEqual([]);
  } finally {
    await ctx.close();
  }
});
