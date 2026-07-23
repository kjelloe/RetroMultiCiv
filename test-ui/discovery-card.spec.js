// The tech-discovery card (specs/tech-discovery-card.md): a real game
// researches an advance to completion; the card appears with the tech name +
// era + unlock links, a link deep-links into the pedia, and the ⚙ mute stops
// further cards. Golden-neutral (render-only).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 2, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('discovering an advance shows the card; an unlock link opens the pedia', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&size=xsmall&civs=2`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  // pick a research target through the real panel (T → first available tech)
  // a CITY first — no city means no trade, no bulbs, no discovery ever
  await page.keyboard.press('b');
  await expect(page.locator('#name-dialog')).toBeVisible();
  await page.locator('#name-input').fill('Lab');
  await page.locator('#name-ok').click();
  await page.keyboard.press('Escape'); // the city panel may have opened

  await page.keyboard.press('t');
  await expect(page.locator('#research-panel')).toBeVisible();
  // double-click = pick research instantly (the isDoubleClick house pattern)
  await page.locator('#research-list .option').first().dblclick();
  await page.keyboard.press('Escape'); // ensure the panel is gone

  // end turns until the discovery card appears (bulbs accrue per turn)
  for (let i = 0; i < 30; i++) {
    if (await page.locator('#discovery-card').count() > 0) break;
    await page.keyboard.press('Escape'); // clear any confirm/panel first
    await page.keyboard.press('e');
    await page.waitForTimeout(600);
  }
  const card = page.locator('#discovery-card');
  await expect(card).toBeVisible({ timeout: 5000 });
  await expect(card.locator('.dc-name')).toContainText(/\w/); // the tech name renders (card structure: .dc-kicker + .dc-name, no .dc-head)
  await expect(card.locator('.dc-era')).toBeVisible();
  await expect(card.locator('.dc-glyph .tech-glyph')).toBeVisible(); // Part C glyph (glyphImg appended into .dc-glyph)
  await page.screenshot({ path: test.info().outputPath('discovery-card.png') });

  // an unlock link (when present) deep-links into the pedia
  if (await card.locator('.dc-link').count() > 0) {
    const linkText = await card.locator('.dc-link').first().textContent();
    await card.locator('.dc-link').first().click();
    await expect(page.locator('#pedia')).toBeVisible();
    await expect(page.locator('#pedia-entry')).toContainText(linkText.trim());
    await page.keyboard.press('Escape');
  } else {
    await card.locator('.dc-continue').click(); // NO auto-close: Continue is the deliberate exit
    await expect(card).toHaveCount(0);
  }
});
