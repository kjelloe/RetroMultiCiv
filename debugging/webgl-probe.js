// Verify what GL context the headless chromium actually yields with and
// without --disable-es3-gl-context (the shoot.sh --webgl1 flag).
const { chromium } = require('@playwright/test');

async function probe(flags) {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', ...flags]
  });
  const page = await browser.newPage();
  const r = await page.evaluate(() => ({
    webgl2: !!document.createElement('canvas').getContext('webgl2'),
    webgl1: !!document.createElement('canvas').getContext('webgl')
  }));
  await browser.close();
  return r;
}

(async () => {
  console.log('plain      :', JSON.stringify(await probe([])));
  console.log('es3-disable:', JSON.stringify(await probe(['--disable-es3-gl-context'])));
  console.log('webgl2-off :', JSON.stringify(await probe(['--disable-webgl2'])));
})();
