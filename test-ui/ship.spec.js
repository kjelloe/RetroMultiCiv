// H8 (A76): the graphical spaceship screen — mock-preview path (?ship=1),
// engine-independent: the 🚀 button, the assembly diagram slot states, the
// characteristics table (the mirror's math pinned against the spec §3
// hand-checks), and the launch row staying OFF on mock data.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('ship screen: mock preview renders the diagram, table, and red-box states', async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    // a LOCAL-engine page (no ?server=1) with the preview hook
    await page.goto(`http://127.0.0.1:${server.port}/client/?seed=1&civs=2&ship=1`);
    await expect(page.locator('#open-ship')).toBeVisible({ timeout: 30000 });
    await page.locator('#open-ship').click();
    await expect(page.locator('#ship-frame')).toBeVisible();
    await expect(page.locator('#ship-mock-note')).toBeVisible();

    // the partial mock: 16 structural supports 11 slots — propulsion+fuel
    // functional, every module unsupported (spec §3 hand-check: mass 14,800,
    // flight 18 years, not viable → success 0)
    await expect(page.locator('#ship-stats')).toContainText('14,800 tons');
    await expect(page.locator('#ship-stats')).toContainText('18 years');
    await expect(page.locator('#ship-stats')).toContainText('0%');
    await expect(page.locator('#ship-parts')).toContainText('3 unsupported');
    await expect(page.locator('#ship-status')).toContainText('Not yet viable');
    // mock data never exposes the launch button
    await expect(page.locator('#ship-launch-row')).toBeHidden();
    // diagram: dead (unsupported) parts carry the red-box class
    expect(await page.locator('#ship-svg .ss-dead').count()).toBeGreaterThan(0);

    // the full-ship preset: 39/8/8/4/4/4 (wiki table case) → 40,000 colonists,
    // 24,700 tons, 19 years, success 98
    await page.locator('#ship-preset button[data-mock="full"]').click();
    await expect(page.locator('#ship-stats')).toContainText('40,000 colonists');
    await expect(page.locator('#ship-stats')).toContainText('24,700 tons');
    await expect(page.locator('#ship-stats')).toContainText('98%');
    await expect(page.locator('#ship-status')).toContainText('viable and ready');
    expect(await page.locator('#ship-svg .ss-dead').count()).toBe(0);
    expect(await page.locator('#ship-svg .ss-empty').count()).toBe(0);

    await page.locator('#ship-close').click();
    await expect(page.locator('#ship-frame')).toBeHidden();
  } finally {
    await ctx.close();
  }
});
