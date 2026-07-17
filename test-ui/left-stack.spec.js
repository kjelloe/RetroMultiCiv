// A57: the left-stack panels (Controls, Map overlays, Turn log) are mutually
// exclusive and REFLOW — an expanded panel pushes its neighbors, so no two
// panels' boxes ever overlap, and the Turn log keeps the lower-left anchor.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 5, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

const IDS = ['help', 'map-overlays', 'turn-log'];

function intersects(a, b) {
  // >1px tolerance so touching borders don't count as overlap
  return a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1
    && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;
}

test('one open panel at a time, boxes never overlap, turn-log keeps the anchor', async ({ page }) => {
  await page.goto(`http://127.0.0.1:${server.port}/client/?seed=5&civ=romans`);
  await expect(page.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

  const anchor = await page.locator('#turn-log').boundingBox();

  for (const id of IDS) {
    await page.locator(`#${id} > summary`).click();
    // the details 'toggle' event dispatches async — poll for the settled state
    await expect
      .poll(() => page.evaluate(ids => ids.filter(i => document.getElementById(i).open), IDS),
        { message: `after opening ${id}` })
      .toEqual([id]);

    const boxes = [];
    for (const other of IDS) boxes.push(await page.locator(`#${other}`).boundingBox());
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(intersects(boxes[i], boxes[j]),
          `${IDS[i]} overlaps ${IDS[j]} while ${id} is open`).toBe(false);
      }
    }

    // the A45 lower-left anchor: the Turn log's bottom edge never moves
    const tl = boxes[2];
    expect(Math.abs((tl.y + tl.height) - (anchor.y + anchor.height))).toBeLessThan(2);
    expect(Math.abs(tl.x - anchor.x)).toBeLessThan(2);
  }

  // closing the last one leaves everything collapsed (no reopen side-effects)
  await page.locator('#turn-log > summary').click();
  const open = await page.evaluate(ids => ids.filter(i => document.getElementById(i).open), IDS);
  expect(open).toEqual([]);
});
