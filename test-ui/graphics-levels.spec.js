// G5 (specs/graphics-levels.md): the graphics-level system's UI contract +
// the per-tier triangle budget. Covers: the setup picker persists its choice;
// each tier boots a real game; the ⚙ live switch rebuilds the scene at the
// new tier; triangle counts rank low < medium < high and stay under the
// runaway ceiling. Headless chromium is SwiftShader (WebGL2), so 'high' is
// NOT degraded here — the WebGL1 degrade path is covered by
// debugging/webgl-probe.js + the shoot.sh --webgl1 lane.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 11, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

const clientUrl = (params) => `http://127.0.0.1:${server.port}/client/${params}`;

test('the setup picker persists the graphics choice in the options key', async ({ page }) => {
  await page.goto(clientUrl(''));
  await expect(page.locator('#setup-graphics')).toBeVisible();
  // the hint names what auto-detect resolved to (SwiftShader → low here)
  await expect(page.locator('#setup-graphics-hint')).toContainText(/detected for this machine: (low|medium|high)/);
  await page.selectOption('#setup-graphics', 'medium');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('retromulticiv-options') || '{}').graphics);
  expect(stored).toBe('medium');
  // an explicit pick swaps the hint to the change-anytime note
  await expect(page.locator('#setup-graphics-hint')).toContainText('⚙ Options');
});

test('each tier boots and the triangle budget ranks low < medium < high', async ({ page }) => {
  const tris = {};
  for (const level of ['low', 'medium', 'high']) {
    // Set the option from a NON-BOOTING same-origin page: the game page's own
    // options.set() rewrites the whole localStorage object, so writing while a
    // booted page is alive races it and loses (the first ui-dev-night run
    // caught exactly that: medium request, low boot).
    await page.goto(clientUrl('host-guide.html'));
    await page.evaluate(l => {
      const o = JSON.parse(localStorage.getItem('retromulticiv-options') || '{}');
      o.graphics = l;
      localStorage.setItem('retromulticiv-options', JSON.stringify(o));
    }, level);
    await page.goto(clientUrl('?e2e=1&seed=11&civs=2&size=xsmall'));
    await expect(page.locator('#hud-status')).toContainText('turn', { timeout: 30000 });
    await page.waitForFunction(() => window.__gfxInfo && window.__gfxInfo().triangles > 0);
    const info = await page.evaluate(() => window.__gfxInfo());
    // high on a WebGL1-only stack DEGRADES to medium by design — expect the
    // degrade rather than fail on it (runner GL stacks vary)
    const webgl2 = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
    expect(info.level).toBe(level === 'high' && !webgl2 ? 'medium' : level);
    tris[level] = { n: info.triangles, degraded: level === 'high' && !webgl2 };
  }
  expect(tris.medium.n).toBeGreaterThan(tris.low.n);
  if (tris.high.degraded) expect(tris.high.n).toBe(tris.medium.n); // degraded high IS medium
  else expect(tris.high.n).toBeGreaterThan(tris.medium.n);
  // runaway ceiling: an xsmall map at high must stay far under discrete-GPU
  // budgets; a blowout here means a level multiplied something it shouldn't
  expect(tris.high.n).toBeLessThan(3_000_000);
});

test('the ⚙ live switch rebuilds the scene at the new tier', async ({ page }) => {
  await page.goto(clientUrl('?e2e=1&seed=11&civs=2&size=xsmall'));
  await expect(page.locator('#hud-status')).toContainText('turn', { timeout: 30000 });
  await page.waitForFunction(() => window.__gfxInfo && window.__gfxInfo().triangles > 0);
  const before = await page.evaluate(() => window.__gfxInfo());
  await page.click('#open-options');
  await page.selectOption('#options-panel select[data-opt="graphics"]', 'medium');
  await page.waitForFunction(prev => window.__gfxInfo().triangles !== prev, before.triangles);
  const after = await page.evaluate(() => window.__gfxInfo());
  expect(after.level).toBe('medium');
  expect(after.triangles).toBeGreaterThan(before.triangles); // low → medium densifies
  // and the resolved-tier note follows the change
  await expect(page.locator('#gfx-level-note')).toContainText('selected: medium');
});
