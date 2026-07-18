// D2 (specs/d1-diplomacy.md) — the Foreign-relations panel, ACTIVATED against
// the landed D1 engine: it lists every foreign civ with its real war/peace
// status (default war today) and — the command being present — offers the
// treaty actions, which dispatch as logged {type:'diplomacy'} commands the
// engine records. The peace/expiry/event-fog logic is unit-tested in
// test/diplomacy-view.test.js; this pins the live wiring end to end.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 15, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('foreign-relations panel: lists rivals at war and dispatches a peace offer', async ({ page }) => {
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

  // D1 is live → the command is present → an "Offer peace" action per rival
  await expect(page.locator('.diplo-act', { hasText: 'Offer peace' })).toHaveCount(2);

  // dispatching the offer is a real logged command: the engine records it and
  // the row flips to "offer sent" (a standing offer FROM me)
  await first.locator('.diplo-act', { hasText: 'Offer peace' }).click();
  await expect(first.locator('.diplo-pending')).toHaveText('offer sent');
  // the other rival is untouched — still offerable
  await expect(page.locator('.diplo-act', { hasText: 'Offer peace' })).toHaveCount(1);

  expect(errors).toEqual([]);
});
