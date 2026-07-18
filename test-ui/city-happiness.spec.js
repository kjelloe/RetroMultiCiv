// B2 (#1711, Oracle×4 legibility): the city happiness breakdown shows each
// calming building's REAL contribution for this civ. With a Temple + Mysticism
// (doubles it) + an owned Oracle (doubles it again), the Temple makes 4 content
// — the breakdown must read "Temple +4" so the ×4 is legible (mechanic
// unchanged; client display only). Golden-neutral.
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

test('city happiness breakdown: Temple +4 with Mysticism + owned Oracle', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  await page.setInputFiles('input[type=file][accept*="json"]', FIXTURE);
  await page.waitForTimeout(1000);

  // open the (recentered) city panel
  const canvas = page.locator('#app canvas');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.click(cx, cy);
  if (await page.locator('#city-panel').isHidden()) await page.mouse.dblclick(cx, cy);
  await expect(page.locator('#city-panel')).toBeVisible({ timeout: 5000 });

  // the mood breakdown (the row's tooltip) names the Temple's real contribution
  const moodTitle = await page.locator('#city-mood-row').getAttribute('title');
  expect(moodTitle).toContain('Temple +4');
  await page.screenshot({ path: test.info().outputPath('city-happiness.png') });
});
