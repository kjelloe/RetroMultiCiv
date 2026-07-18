// XII.4 (user, mobile playtest): don't-lose-your-game. A server game left
// mid-play (a mobile back-swipe unloads the page) is recoverable — the setup
// screen shows a Rejoin banner that reopens ?server&game (the stored seat token
// auto-reclaims the seat). Also: the active-game entry is written while playing
// and cleared on Dismiss. Golden-neutral (client + localStorage only).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 12, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('rejoin: a left-behind server game surfaces on setup and one-tap rejoins', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, hasTouch: true, isMobile: true });
  ctx.on('page', p => p.on('dialog', d => d.accept())); // don't hang on the leave-guard prompt
  try {
    const base = `http://127.0.0.1:${server.port}/client/`;
    const page = await ctx.newPage();

    // join a server game → the active-game entry is stored while playing
    await page.goto(`${base}?server=1`);
    await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
    const stored = await page.evaluate(() => localStorage.getItem('retromulticiv-active-game'));
    expect(stored, 'active-game entry written while in a server game').toBeTruthy();
    const gameId = JSON.parse(stored).gameId;
    expect(gameId).toBeTruthy();

    // leave to the bare setup screen (the swipe-back lands the user at the menu)
    await page.goto(base);
    await expect(page.locator('#setup-box')).toBeVisible();
    await expect(page.locator('#rejoin-banner')).toBeVisible();
    await expect(page.locator('#rejoin-banner')).toContainText('still in progress');

    // one-tap Rejoin reopens the game and reclaims the seat (via the stored token)
    await page.locator('#rejoin-go').click();
    await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
    expect(page.url()).toContain(`game=${gameId}`);

    // now leave again and DISMISS — the entry clears, no banner on the next load
    await page.goto(base);
    await expect(page.locator('#rejoin-banner')).toBeVisible();
    await page.locator('#rejoin-dismiss').click();
    await expect(page.locator('#rejoin-banner')).toHaveCount(0);
    const afterDismiss = await page.evaluate(() => localStorage.getItem('retromulticiv-active-game'));
    expect(afterDismiss, 'Dismiss clears the stored entry').toBeNull();

    // a fresh setup load now shows no banner
    await page.goto(base);
    await expect(page.locator('#setup-box')).toBeVisible();
    await expect(page.locator('#rejoin-banner')).toHaveCount(0);
  } finally {
    await ctx.close();
  }
});

test('rejoin: a local game never writes an active-game entry (no banner)', async ({ page }) => {
  const base = `http://127.0.0.1:${server.port}/client/`;
  await page.goto(`${base}?seed=2&civs=2`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
  const stored = await page.evaluate(() => localStorage.getItem('retromulticiv-active-game'));
  expect(stored, 'a local game is a no-op for the rejoin guard').toBeNull();
});
