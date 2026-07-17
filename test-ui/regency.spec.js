// A49-ext spec 3 (#990): AI REGENCY HANDOFF (A40) — a human hands the seat to
// the AI regent mid-game, the regent plays turns on its own, the human takes
// the seat back and keeps playing. Local-engine client; the regent drive loop
// (regent-driver.js) does the turns for real.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 6, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

const turnNumber = page => page.evaluate(() => {
  const m = document.getElementById('hud-status').textContent.match(/turn (\d+)/);
  return m ? parseInt(m[1], 10) : null;
});

test('regency: hand the seat to the AI, it plays turns, take it back, keep playing', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=6&size=xsmall`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  // hand over: 🤖 opens the stance dialog; pick the first stance
  await page.locator('#regent-btn').click();
  await expect(page.locator('#regent-dialog')).toBeVisible();
  await page.locator('.regent-stance').first().click();
  await expect(page.locator('#regent-dialog')).toBeHidden();
  await expect(page.locator('#regent-btn')).toHaveClass(/active/);

  // the regent plays the seat: the turn counter advances without any input
  await expect
    .poll(() => turnNumber(page), { timeout: 60000, message: 'the regent advances turns' })
    .toBeGreaterThanOrEqual(3);

  // take back control (the button is a quick take-back while regency is on)
  await page.locator('#regent-btn').click();
  await expect(page.locator('#regent-btn')).not.toHaveClass(/active/);

  // the regent stops at the turn boundary; then the HUMAN plays on
  await page.waitForTimeout(1500); // let any in-flight regent turn finish
  const back = await turnNumber(page);
  // 'E' may first surface the needs-orders confirm ('E again to ignore') for
  // cities the regent finished — press until the turn actually advances
  await expect
    .poll(async () => {
      await page.keyboard.press('Escape'); // close any panel the confirm opened
      await page.keyboard.press('e');
      await page.waitForTimeout(700);
      return turnNumber(page);
    }, { timeout: 30000, message: 'the human end-turn still works' })
    .toBeGreaterThan(back);
  // taking back did not re-arm: the button stays inactive
  await expect(page.locator('#regent-btn')).not.toHaveClass(/active/);
  // and the session surfaced no error
  await expect(page.locator('#hud-status')).not.toContainText('ERROR');
});
