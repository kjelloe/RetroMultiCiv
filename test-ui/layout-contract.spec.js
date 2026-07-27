// GUARD 4 (regression-guards): layout contracts a top-bar / panel rework can silently
// break. Three declared invariants, each tied to a real regression:
//   - CONTAINMENT: the "View technology tree" button stays INSIDE the research panel
//     (XIX-8: a leftover absolute rule floated it to the upper-right, outside the panel).
//   - NO-TRUNCATION: the top-bar government name is never clipped (XIX-2/8: real-emoji
//     rate icons are wider than headless boxes; the bar had to widen so "Despotism" fits).
//   - FIRST-CLICK-LANDS: a click on a control right after boot performs its action, i.e.
//     no z-layer steals it (the overlay-interception family — moment / stray-panel z9000).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

const boot = async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); // a normal desktop
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=1&civs=2&e2e=1&e2eclose=1`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
  return { ctx, page };
};

test('layout-contract: the tech-tree button is contained by the research panel', async ({ browser }) => {
  const { ctx, page } = await boot(browser);
  try {
    await page.locator('#research-bar').click(); // opens #research-panel (panels.js)
    await expect(page.locator('#research-panel')).toBeVisible();
    const panel = await page.locator('#research-panel').boundingBox();
    const btn = await page.locator('#open-tech-tree').boundingBox();
    expect(btn, 'the tech-tree button renders').not.toBeNull();
    // containment (±2px slop for borders): the button box sits within the panel box
    expect(btn.x).toBeGreaterThanOrEqual(panel.x - 2);
    expect(btn.y).toBeGreaterThanOrEqual(panel.y - 2);
    expect(btn.x + btn.width).toBeLessThanOrEqual(panel.x + panel.width + 2);
    expect(btn.y + btn.height).toBeLessThanOrEqual(panel.y + panel.height + 2);
  } finally { await ctx.close(); }
});

test('layout-contract: the top-bar government name is not truncated', async ({ browser }) => {
  const { ctx, page } = await boot(browser);
  try {
    await expect(page.locator('#research-label')).toContainText('Despotism');
    await page.waitForTimeout(500); // let the bar settle (its content updates as the game loads)
    // the label must fully fit its bar — no overflow-hidden clipping of the gov name
    const overflow = await page.locator('#research-label').evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow, 'research label overflows its bar (gov name truncated)').toBeLessThanOrEqual(1);
  } finally { await ctx.close(); }
});

test('layout-contract: a first click after boot lands on its control', async ({ browser }) => {
  const { ctx, page } = await boot(browser);
  try {
    // clicking an overview button must OPEN its panel — not be swallowed by a z-layer
    await page.locator('#open-city-overview').click();
    await expect(page.locator('#city-overview-panel')).toBeVisible();
  } finally { await ctx.close(); }
});
