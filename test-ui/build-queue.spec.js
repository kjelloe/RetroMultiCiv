// C3 (specs/civ24-features-proposal.md §3): the per-city build queue —
// shift-click queues two items, end turns until the current production
// completes, the queue head becomes CURRENT production (advanced via a
// logged setProduction), and the Shift+D recording REPLAYS to 'OK' (the
// honest proof the queue added no out-of-band state).
import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 8, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('build queue: shift-click add, advance on completion, replay-clean', async ({ browser }, testInfo) => {
  test.setTimeout(150000); // ~10 end-turn rounds with AI in between + a replay run
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    // seed 2: the e2e city yields 1 shield/turn (seed 1's site yields ZERO
    // shields — production there never completes; measured by seed scan)
    await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2&e2e=1`);
    await expect(page.locator('#city-queue')).toBeVisible({ timeout: 30000 });
    await expect(page.locator('#city-queue')).toContainText('queue: empty');

    // queue the first two available (non-locked, non-current) catalog items
    const options = page.locator('#city-production .option:not(.locked):not(.current)');
    await options.nth(0).click({ modifiers: ['Shift'] });
    await options.nth(1).click({ modifiers: ['Shift'] });
    const queued = await page.locator('#city-queue').innerText();
    const first = queued.match(/1\. ([^↑]+)/)[1].trim();
    expect(queued).toContain('2.');

    // end turns until the current item completes and the queue advances;
    // 'e' twice per round rides through the still-have-moves / city-orders
    // confirm gates (each is an ignore-once 5s window)
    let advanced = false;
    for (let i = 0; i < 25 && !advanced; i++) {
      await page.keyboard.press('e');
      await page.waitForTimeout(250);
      await page.keyboard.press('e');
      await page.waitForTimeout(600);
      const q = await page.locator('#city-queue').innerText();
      if (!q.includes('2.')) advanced = true;
    }
    expect(advanced, 'the queue advanced within 25 rounds').toBe(true);
    // the head became CURRENT production (the panel's building row names it)
    await expect(page.locator('#city-stats')).toContainText(`building: ${first}`);

    // the recording replays clean — queue commands are ordinary logged clicks
    const downloadP = page.waitForEvent('download');
    await page.keyboard.press('Shift+D');
    const download = await downloadP;
    const file = testInfo.outputPath('c3-recording.json');
    await download.saveAs(file);
    const out = execFileSync('node', ['tools/replay.js', file], { encoding: 'utf8' });
    expect(out).toContain('OK: the recorded game reproduces exactly');
  } finally {
    await ctx.close();
  }
});
