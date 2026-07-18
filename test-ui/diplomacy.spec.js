// D2 (specs/d1-diplomacy.md) — the Foreign-relations panel, drafted INERT: on
// today's build (no engine diplomacy) it lists every foreign civ at the spec
// DEFAULT — "at war" — with NO treaty buttons (the command is feature-detected
// and absent). This pins the legibility half + the inert wiring; the live
// peace/offer/accept paths + the event rows are unit-tested in
// test/diplomacy-view.test.js (the engine half is the bugfixer's D1 window).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 15, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('foreign-relations panel: lists rivals at war, inert until the engine ships diplomacy', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=3`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  // the 🤝 corner button opens the panel
  await page.locator('#open-diplo').click();
  await expect(page.locator('#diplo-overlay')).toBeVisible();

  // 3 civs, 1 human → 2 foreign rows, each reading the default "at war"
  await expect(page.locator('.diplo-row')).toHaveCount(2);
  const first = page.locator('.diplo-row').first();
  await expect(first.locator('.diplo-status')).toContainText('at war');

  // INERT: the diplomacy command is not shipped, so no treaty actions render
  await expect(page.locator('.diplo-act')).toHaveCount(0);

  expect(errors).toEqual([]);
});
