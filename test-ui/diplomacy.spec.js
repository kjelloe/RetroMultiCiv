// D2 (specs/d1-diplomacy.md) — the Foreign-relations panel, ACTIVATED against
// the landed D1 engine. The peace/expiry/event-fog logic is unit-tested in
// test/diplomacy-view.test.js; this pins the live wiring end to end.
//
// REWRITTEN 2026-08-05 after A105. This spec used to open the panel at turn 1
// and click "Offer peace" — a flow that is now unreachable by design, because a
// civ you have not MET is rendered as an anonymous row with no actions. The old
// assertions failed in the nightly UI lane while `node --test test/` stayed
// green, since that command does not run test-ui/. Worth remembering: a
// client-behaviour change can pass the whole engine suite and still break the
// only lane that drives the real UI.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 15, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('foreign-relations panel: an UNMET civ is anonymous and cannot be negotiated with', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // e2eclose=1 as well as e2e=1: e2e=1 founds a city AND leaves #city-panel open,
  // and that panel covers the 🤝 corner button, so the click was intercepted
  // rather than failing on anything to do with diplomacy. The old comment here
  // only mentioned the onboarding overlay.
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=3&e2e=1&e2eclose=1`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  await page.locator('#open-diplo').click();
  await expect(page.locator('#diplo-overlay')).toBeVisible();

  // 3 civs, 1 human → 2 foreign rows. At turn 1 nobody has made contact, so
  // every row is a rumour: no name, no colour, no actions.
  await expect(page.locator('.diplo-row')).toHaveCount(2);
  await expect(page.locator('.diplo-row.diplo-unmet')).toHaveCount(2);
  await expect(page.locator('.diplo-unknown').first()).toHaveText('unknown civilization');
  await expect(page.locator('.diplo-row').first().locator('.diplo-status'))
    .toContainText('you have not met them');

  // the whole point: no treaty action is offered to a civ you have never seen
  await expect(page.locator('.diplo-act')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test.skip('foreign-relations panel: a MET rival can be offered peace', async ({ page }) => {
  // TODO(v1.0.1): reaching a met pair from a fresh boot needs contact to happen
  // first — ?debug=1 + revealMap + a turn wrap, or an e2e hook that seeds the
  // relations entry. Skipped rather than deleted so the offer-dispatch path is
  // visibly UNCOVERED here instead of silently dropped; the command itself is
  // covered by test/scenarios/012-diplomacy.json in both engines, and the panel
  // wiring by test/d4-treaty-shell.test.js.
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  // e2e=1 keeps the in-game onboarding overlay down (it would otherwise sit over
  // the 🤝 button and swallow the click); it founds the human city but leaves the
  // foreign-relation rows unchanged.
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=3&e2e=1`);
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

// D4 human-treaty SHELL (specs/d4-treaty-ui.md, provisional wire). ?parleydemo
// forces the shell visible on a local-engine boot (the demo param is captured at
// module eval — A45); it exercises the DOM the live D4 engine will drive.
test('parley chooser: term buttons reveal their detail (tribute gold / tech pickers)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=3&parleydemo=chooser`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  await expect(page.locator('#parley-chooser')).toBeVisible();
  // THREE, not four: the cease-fire tier was dropped by ruling #2507, leaving
  // peace / tribute / techswap. The spec kept asserting 4 and had been failing
  // ever since — invisible while the nightly was red for unrelated reasons.
  await expect(page.locator('.parley-term')).toHaveCount(3);           // peace/tribute/techswap
  await expect(page.locator('#parley-gold')).toBeHidden();             // detail hidden until a term is picked
  await expect(page.locator('#parley-give')).toBeHidden();

  await page.locator('.parley-term', { hasText: 'Tribute' }).click();  // tribute → gold stepper only
  await expect(page.locator('#parley-gold')).toBeVisible();
  await expect(page.locator('#parley-give')).toBeHidden();

  await page.locator('.parley-term', { hasText: 'Tech swap' }).click(); // tech swap → two pickers, gold hidden
  await expect(page.locator('#parley-give')).toBeVisible();
  await expect(page.locator('#parley-want')).toBeVisible();
  await expect(page.locator('#parley-gold')).toBeHidden();

  expect(errors).toEqual([]);
});

test('parley inbound offer reuses the envoy modal (terms from the payload)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=3&parleydemo=1`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  await expect(page.locator('#envoy-modal')).toBeVisible();
  await expect(page.locator('#envoy-body')).toContainText('exchange for your'); // describeParley techswap text
  await expect(page.locator('#envoy-accept')).toBeVisible();
  await expect(page.locator('#envoy-later')).toBeVisible();

  expect(errors).toEqual([]);
});
