// XII.6 A/B — the graphical tech tree + client-side beeline (golden-neutral).
// A49 DOM coverage: the 🌳 overlay opens with fog-honest node states, clicking
// an available node issues setResearch, clicking a distant node sets a beeline
// goal (+ issues its first step), and the beeline auto-advances to the next
// step when a tech completes over a couple of turns. The beeline issues normal
// setResearch commands (client-only goal state) — nothing engine-side changes.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'temple-oracle.json');

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('tech tree: open, node states, click→research, beeline goal', async ({ page }) => {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  // open the tree via its keyboard shortcut
  await page.keyboard.press('Shift+T'); // #open-tech-tree now lives inside the research panel (XIV §21); Shift+T opens the overlay directly
  await expect(page.locator('#tech-tree')).toBeVisible();

  // one node per tech, each with a procedural glyph, prereq edges drawn, and a
  // fog-honest split of states
  await expect(page.locator('.tt-node')).toHaveCount(68);
  await expect(page.locator('.tt-node .tech-glyph')).toHaveCount(68);
  expect(await page.locator('.tt-edge').count()).toBeGreaterThan(50);
  expect(await page.locator('.tt-node.avail').count()).toBeGreaterThan(0);
  expect(await page.locator('.tt-node.locked').count()).toBeGreaterThan(0);

  // click an AVAILABLE node → setResearch (the research readout follows it)
  const avail = page.locator('.tt-node.avail').first();
  const availId = await avail.getAttribute('data-id');
  await page.evaluate(id => document.querySelector(`.tt-node[data-id="${id}"]`).click(), availId);
  await expect(page.locator('.tt-node.current')).toHaveAttribute('data-id', availId);
  await expect(page.locator('#research-label')).not.toContainText('choose');
  // the research readout carries the current tech's glyph (Part C surface)
  await expect(page.locator('#research-glyph')).toBeVisible();

  // click a DISTANT (locked) node → beeline goal set + its first step issued
  await page.evaluate(() => document.querySelector('.tt-node[data-id="automobile"]').click());
  await expect(page.locator('.tt-node.goal')).toHaveCount(1);
  await expect(page.locator('.tt-node.goal')).toHaveAttribute('data-id', 'automobile');
  expect(await page.locator('.tt-node.onpath').count()).toBeGreaterThan(1);
  // the first step is a researchable-now (available) tech, now current
  const current = await page.locator('.tt-node.current').getAttribute('data-id');
  expect(current).toBeTruthy();
  expect(current).not.toBe('automobile');

  expect(errs).toEqual([]);
});

test('beeline: auto-advances to the next step when a tech completes', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  // a game with a city (so research accrues): tech=mysticism, 1 city
  await page.setInputFiles('input[type=file][accept*="json"]', FIXTURE);
  await page.waitForTimeout(1000);

  await page.keyboard.press('Shift+T'); // #open-tech-tree now lives inside the research panel (XIV §21); Shift+T opens the overlay directly
  await expect(page.locator('#tech-tree')).toBeVisible();

  // beeline to a deep goal; capture the first step it picks
  await page.evaluate(() => document.querySelector('.tt-node[data-id="automobile"]').click());
  await expect(page.locator('.tt-node.goal')).toHaveAttribute('data-id', 'automobile');
  const firstStep = await page.locator('.tt-node.current').getAttribute('data-id');

  // close the tree (its overlay covers End Turn); the beeline auto-advances via
  // session.onChange regardless of whether the tree is open
  const researchName = () => page.locator('#research-label').textContent()
    .then(t => { const m = (t.split('·')[0] || '').match(/[A-Za-z][A-Za-z ]*[A-Za-z]/); return m ? m[0] : ''; });
  await page.locator('#tech-tree-close').click();
  await expect(page.locator('#tech-tree')).toBeHidden();
  const firstName = await researchName();

  // end turns until a tech completes; the onChange handler must then push the
  // NEXT beeline step — the research readout moves to a different tech
  let advanced = false;
  for (let i = 0; i < 25 && !advanced; i++) {
    await page.locator('#end-turn').click();
    await page.waitForTimeout(250);
    const name = await researchName();
    if (name && name !== firstName) advanced = true;
  }
  expect(advanced).toBe(true);

  // reopen: the first step is now known, the goal is still tracked
  await page.keyboard.press('Shift+T'); // #open-tech-tree now lives inside the research panel (XIV §21); Shift+T opens the overlay directly
  await expect(page.locator('#tech-tree')).toBeVisible();
  await expect(page.locator(`.tt-node[data-id="${firstStep}"]`)).toHaveClass(/known/);
  await expect(page.locator('.tt-node.goal')).toHaveAttribute('data-id', 'automobile');
});
