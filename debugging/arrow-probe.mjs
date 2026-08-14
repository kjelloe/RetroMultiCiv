import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8973'], { cwd: '/home/kjelloe/GIT/multiciv' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
for (const level of ['medium', 'low']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    const orig = window.matchMedia.bind(window);
    window.matchMedia = q => /pointer:\s*coarse/.test(q)
      ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
      : orig(q);
  });
  await page.goto('http://127.0.0.1:8973/client/host-guide.html');
  await page.evaluate(l => localStorage.setItem('retromulticiv-options', JSON.stringify({ graphics: l })), level);
  await page.goto('http://127.0.0.1:8973/client/?seed=11&civs=2&size=xsmall&zoom=6');
  await page.waitForFunction(() => (document.getElementById('hud-status') || {}).textContent?.includes('turn'), null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.mouse.move(500, 300); await page.mouse.move(520, 320); await page.waitForTimeout(400);
  const hov = await page.evaluate(() => (document.getElementById('hud-status') || {}).textContent || 'none');
  console.log(level, 'HOVER READOUT:', JSON.stringify(hov.slice(0, 120)));
  await page.mouse.click(640, 400); // the boot camera centers the starting units
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const bar = document.querySelector('#action-bar') || document.querySelector('#unit-dock');
    const coarse = matchMedia('(pointer: coarse)').matches;
    return { coarse, bar: bar ? bar.textContent.slice(0, 30) : 'none' };
  });
  console.log(level, JSON.stringify(info));
  await page.screenshot({ path: `debugging/arrow-${level}.png` });
  await page.close();
}
await browser.close(); srv.kill();
