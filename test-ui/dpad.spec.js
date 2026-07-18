// XII.1 (user, mobile playtest): the touch d-pad must NOT overlap End Turn, and
// a compass toggle shows/hides it (persisted). Emulated on a phone-sized coarse
// viewport — the field-report shape. Golden-neutral (pure client UI).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 9, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

const boxes = page => page.evaluate(() => {
  const r = id => { const el = document.getElementById(id); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, disp: getComputedStyle(el).display }; };
  return { dp: r('dpad'), et: r('end-turn'), tg: r('dpad-toggle') };
});
const overlaps = (a, b) => !(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y);

for (const view of [{ name: 'portrait', width: 412, height: 915 }, { name: 'landscape', width: 915, height: 412 }]) {
  test(`d-pad clears End Turn on a ${view.name} phone, and the compass toggle hides it`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, hasTouch: true, isMobile: true });
    try {
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${server.port}/client/?seed=2&civs=2&zoom=5`);
      await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

      // the pad and the toggle render on a coarse (touch) viewport
      await expect(page.locator('#dpad')).toBeVisible();
      await expect(page.locator('#dpad-toggle')).toBeVisible();

      // the pad must NOT overlap the End Turn button (the field bug)
      const b1 = await boxes(page);
      expect(b1.dp.disp).not.toBe('none');
      expect(overlaps(b1.dp, b1.et), 'd-pad overlaps End Turn').toBe(false);

      // the compass toggle hides the pad …
      await page.locator('#dpad-toggle').click();
      await expect(page.locator('#dpad')).toBeHidden();

      // … and the choice persists across a reload
      await page.reload();
      await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });
      await expect(page.locator('#dpad')).toBeHidden();
      await expect(page.locator('#dpad-toggle')).toBeVisible(); // still there to bring it back
    } finally {
      await ctx.close();
    }
  });
}
