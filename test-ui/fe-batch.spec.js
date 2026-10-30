// fastengine requests R9-R12 (specs/fastengine-requests.md, B29/B30/A111):
// the browser fixes that have no home in an existing area spec. Computed
// styles and rects, never PNG compares (NOTES.md: live scenes are noisy).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 2, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

const boot = async (page, extra = '') => {
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&size=xsmall&civs=2${extra}`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
};
const bg = loc => loc.evaluate(el => getComputedStyle(el).backgroundColor);

test('R10: options Save is green; ✋ take-back is hidden while no regent plays', async ({ page }) => {
  await boot(page);
  await page.locator('#open-options').click();
  expect(await bg(page.locator('#opt-save'))).toBe('rgb(46, 107, 64)');
  await page.locator('#open-options').click();
  await page.locator('#regent-btn').click();
  await expect(page.locator('#regent-dialog')).toBeVisible();
  await expect(page.locator('#regent-off')).toBeHidden();
});

test('R9.4: at 800 px the HUD stays left of the research bar', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await boot(page);
  const hud = await page.locator('#hud').boundingBox();
  const bar = await page.locator('#research-bar').boundingBox();
  expect(hud.x + hud.width).toBeLessThanOrEqual(bar.x);
});

test('R11.5/7: an open overview sits below its buttons and Esc closes it', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 760 });
  await boot(page);
  await page.locator('#open-econ-overview').click();
  const panel = page.locator('#econ-overview-panel');
  await expect(panel).toBeVisible();
  const btn = await page.locator('#open-econ-overview').boundingBox();
  const box = await panel.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(btn.y + btn.height);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('R11.8: pedia terrain lists real terrains and opens an entry', async ({ page }) => {
  await boot(page);
  await page.locator('#open-pedia').click();
  await page.locator('.pedia-cat[data-cat="terrain"]').click();
  await expect(page.locator('.pedia-item', { hasText: 'Grassland' })).toHaveCount(1);
  const names = await page.locator('.pedia-item').allTextContents();
  expect(names.every(n => n.trim().length > 0)).toBe(true);
  await page.locator('.pedia-item', { hasText: 'Grassland' }).click();
  await expect(page.locator('#pedia-entry')).toContainText('Yields');
});

test('R11.9/10: hover card above the tree; tree Back returns to the research list', async ({ page }) => {
  await boot(page);
  await page.keyboard.press('t');
  await expect(page.locator('#research-panel')).toBeVisible();
  await page.locator('#open-tech-tree').click();
  await expect(page.locator('#tech-tree')).toBeVisible();
  await expect(page.locator('#research-panel')).toBeHidden();
  await page.locator('.tt-node').first().hover(); // the shared card is created on first use
  await expect(page.locator('#hover-card')).toHaveCount(1);
  expect(await page.locator('#hover-card').evaluate(el => Number(getComputedStyle(el).zIndex))).toBeGreaterThan(60);
  await page.locator('#tt-back').click();
  await expect(page.locator('#tech-tree')).toBeHidden();
  await expect(page.locator('#research-panel')).toBeVisible();
});

test('R11.23/24: discovery Continue is green', async ({ page }) => {
  await boot(page, '&discoverydemo=1');
  const cont = page.locator('#discovery-card .dc-continue');
  await expect(cont).toBeVisible();
  expect(await bg(cont)).toBe('rgb(46, 107, 64)');
});

test('R11.1: accepting an envoy offer lands once; no second modal', async ({ page }) => {
  await boot(page, '&envoydemo=1');
  await expect(page.locator('#envoy-accept')).toBeVisible();
  await page.locator('#envoy-accept').click();
  await page.waitForTimeout(500);
  await expect(page.locator('#envoy-accept')).toHaveCount(0);
});

test('R12: Enter on the historian closes it and does not end the turn', async ({ page }) => {
  await boot(page, '&historiandemo=1');
  const panel = page.locator('#historian');
  await expect(panel).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
  await page.waitForTimeout(500);
  await expect(page.locator('#hud-status')).toContainText('turn 1');
});
