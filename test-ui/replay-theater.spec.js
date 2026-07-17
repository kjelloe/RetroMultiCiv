// A49-ext spec 2 (#990): the REPLAY THEATER (A47/A87) — a real recording is
// built (?e2e=9 founds a city and plays three rounds), the in-page verifier
// matches hashes, the theater opens (&e2eopen=1), playback runs to the
// ✅ Verified verdict, and the scrubber jumps the sandbox to an earlier turn.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 9, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('replay theater: recording verifies, theater plays to ✅ Verified, scrubber jumps', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=9&size=xsmall&e2e=9&e2eopen=1`);

  // the in-page verifier (ctx.replay.verifyReplay) matched hash-for-hash
  const probe = page.locator('#e2e-probe');
  await expect(probe).toContainText('match:true', { timeout: 60000 });
  await expect(probe).toContainText('errors:0');
  await expect(probe).not.toContainText('majors:0'); // the events feed filled

  // the theater opened with its full control bar
  const theater = page.locator('#replay-theater');
  await expect(theater).toBeVisible();
  await expect(page.locator('#replay-scrub')).toBeAttached();
  await expect(page.locator('#replay-feed')).toBeAttached();

  // crank the tempo so the short recording finishes quickly, then the
  // verifier's verdict lands in the turn label (A87 c)
  await page.evaluate(() => {
    const el = document.getElementById('replay-tempo');
    el.value = '50';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#replay-turn')).toContainText('✅ Verified', { timeout: 30000 });
  await expect(theater).toHaveAttribute('data-verified', '1');
  const endLabel = await page.locator('#replay-turn').textContent();

  // scrub back to the start: the sandbox re-seeds and the label leaves the
  // end state (turn 1, no verdict suffix)
  await page.evaluate(() => {
    const el = document.getElementById('replay-scrub');
    el.value = '0';
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#replay-turn')).not.toHaveText(endLabel, { timeout: 10000 });
  await expect(page.locator('#replay-turn')).toContainText('turn 1');

  // close: the theater leaves the DOM
  await page.locator('#replay-close').click();
  await expect(theater).toHaveCount(0);
});
