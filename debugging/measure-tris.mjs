// H5: per-tier triangle/draw-call measurement on the reference xsmall boot.
import { chromium } from '@playwright/test';
import { startServer } from '../server/index.js';

const server = await startServer({ seed: 11, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage();
for (const level of ['low', 'medium', 'high']) {
  await page.goto(`http://127.0.0.1:${server.port}/client/host-guide.html`);
  await page.evaluate(l => {
    const o = JSON.parse(localStorage.getItem('retromulticiv-options') || '{}');
    o.graphics = l; localStorage.setItem('retromulticiv-options', JSON.stringify(o));
  }, level);
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=11&civs=2&size=xsmall&zoom=7`);
  // PLAIN boot (never ?e2e=1 — its probe flow parks the scene in artificial
  // mid-probe states; measured 2026-08-13) + settled frame
  await page.waitForFunction(() => (document.getElementById('hud-status') || {}).textContent?.includes('turn'), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => window.__gfxInfo());
  console.log(`${level}\ttris=${info.triangles}\tcalls=${info.calls}`);
}
await browser.close();
await server.close();
