// A58b: the Civilopedia opens, lists data-driven entries, and cross-links work.
// Rides the A49 lane. Local-engine client (no ?server=1) — the pedia reads the
// ruleset, so no game server logic is needed beyond the static client host.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 12345, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('civilopedia: opens, lists entries from the rulesets, cross-links navigate', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=12345&civ=romans`);
  // the 📖 button appears once the client boots
  const book = page.locator('#open-pedia');
  await expect(book).toBeVisible({ timeout: 20000 });
  await book.click();

  const pedia = page.locator('#pedia');
  await expect(pedia).toBeVisible();
  // Units category is default; entries are listed and one renders its stats
  await expect(page.locator('.pedia-cat.active')).toHaveText('Units');
  await page.locator('.pedia-item', { hasText: 'Legion' }).first().click();
  await expect(page.locator('#pedia-entry')).toContainText('Attack');
  await expect(page.locator('#pedia-entry')).toContainText('Requires'); // its tech cross-link

  // switching category lists that table
  await page.locator('.pedia-cat', { hasText: 'Advances' }).click();
  await expect(page.locator('.pedia-cat.active')).toHaveText('Advances');
  const firstTech = page.locator('.pedia-item').first();
  await firstTech.click();
  await expect(page.locator('#pedia-entry h3')).toBeVisible();

  // Concepts category (A58c) lists prose entries
  await page.locator('.pedia-cat', { hasText: 'Concepts' }).click();
  await expect(page.locator('.pedia-item', { hasText: 'Zones of control' })).toBeVisible();
  await page.locator('.pedia-item', { hasText: 'Zones of control' }).click();
  await expect(page.locator('#pedia-entry')).toContainText('zone of control');

  // Esc closes
  await page.keyboard.press('Escape');
  await expect(pedia).toBeHidden();
});

test('civilopedia: the ❓ quick-help deep-links into a concept (A58c coexist)', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=12345&civ=romans`);
  await expect(page.locator('#open-help')).toBeVisible({ timeout: 20000 });
  await page.locator('#open-help').click();
  // the disorder tip carries a "📖 more in the pedia" deep-link → jumps to the concept
  await page.locator('.pedia-deeplink[data-concept="disorder"]').click();
  await expect(page.locator('#pedia')).toBeVisible();
  await expect(page.locator('.pedia-cat.active')).toHaveText('Concepts');
  await expect(page.locator('#pedia-entry h3')).toHaveText('Civil disorder');
});
