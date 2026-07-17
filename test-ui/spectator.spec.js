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
  try {
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${server.port}/client/?server=1&spectate=1`);
    // connected as a spectator: the tokenless spectator chip appears
    await expect(page.locator('#spectator-chip')).toBeVisible();
    // view-only: the selection hint invites watching, never controlling
    await expect(page.locator('#hud-selection')).toContainText('watching');
    // the map rendered (the three.js canvas is present)
    await expect(page.locator('canvas')).toBeVisible();
    // controls nothing: the End Turn button never shows for a spectator
    await expect(page.locator('#end-turn')).toBeHidden();
  } finally {
    await ctx.close();
  }
});
