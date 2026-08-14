import { chromium } from '@playwright/test';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8972'], { cwd: '/home/kjelloe/GIT/multiciv' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1366, height: 728 } }); // laptop minus chrome
await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
await page.goto('http://127.0.0.1:8972/client/');
await page.waitForTimeout(2500);
const initial = await page.evaluate(() =>
  [...document.querySelectorAll('#onboarding-svg foreignObject div')].map(d => d.textContent.slice(0, 24)));
console.log('INITIAL arrows:', JSON.stringify(initial));
await page.evaluate(() => { const b = document.getElementById('setup-box'); if (b) b.scrollTop = b.scrollHeight; });
await page.waitForTimeout(600);
const scrolled = await page.evaluate(() =>
  [...document.querySelectorAll('#onboarding-svg foreignObject div')].map(d => d.textContent.slice(0, 24)));
console.log('AFTER SCROLL arrows:', JSON.stringify(scrolled));
await browser.close(); srv.kill();
