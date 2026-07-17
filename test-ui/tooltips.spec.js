// C2 (specs/civ24-features-proposal.md §2): breakdown tooltips — the yields
// tooltip's total line must EQUAL the displayed yields row (same engine
// calls, so equal by construction; this pins that it stays so), the mood
// row carries the factor ledger, and the HUD chip carries the income
// breakdown with the engine's own totals.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 7, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('tooltips: yields title sums to the displayed row; mood + income ledgers present', async ({ browser }) => {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    // ?e2e=1 founds a city and opens the panels
    await page.goto(`http://127.0.0.1:${server.port}/client/?seed=1&civs=2&e2e=1`);
    await expect(page.locator('#city-yields-row')).toBeVisible({ timeout: 30000 });

    const row = page.locator('#city-yields-row');
    const shown = (await row.innerText()).match(/yields (\d+)\/(\d+)\/(\d+)/);
    expect(shown).not.toBeNull();
    const tip = await row.getAttribute('title');
    expect(tip).toContain('worked tiles');
    const total = tip.match(/total (\d+)\/(\d+)\/(\d+)/);
    expect(total).not.toBeNull();
    expect(total.slice(1, 4)).toEqual(shown.slice(1, 4));
    // one line per worked tile, each with a coordinate and an f/s/t triple
    const tileLines = tip.split('\n').filter(l => /^\(\d+,\d+\)/.test(l));
    expect(tileLines.length).toBeGreaterThan(0);

    const moodTip = await page.locator('#city-mood-row').getAttribute('title');
    expect(moodTip).toContain('mood factors');
    expect(moodTip).toContain('luxuries');

    const hudTip = await page.locator('#research-label').getAttribute('title');
    expect(hudTip).toContain('income breakdown');
    expect(hudTip).toMatch(/taxes \+\d+ · upkeep −\d+ · research \+\d+ bulbs/);
  } finally {
    await ctx.close();
  }
});
