// A49-ext spec 1 (#990): RESUME FROM LOBBY BY GAME CODE, two-client — the
// A98 flow end-to-end through the real UI. A hosted 2-human lobby plays and
// autosaves on server A; server A dies; a fresh host on server B resumes the
// game by its docs/07 game code (typed into the host form); a second client
// rejoins the resumed game. The pre-save city and turn must survive.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('resume by game code: the pre-save city survives a server swap; a joiner rejoins', async ({ browser }) => {
  test.setTimeout(180000); // two server boots + a played turn
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'multiciv-resume-'));
  let server = await startServer({ seed: 21, civs: 2, humans: 1, size: 'xsmall', savesDir: dir, host: '127.0.0.1' });
  const hostCtx = await browser.newContext();
  const joinCtx = await browser.newContext();
  const resumeCtx = await browser.newContext();
  const rejoinCtx = await browser.newContext();
  try {
    // --- phase 1: host a 2-human lobby, joiner joins, host starts ---
    const host = await hostCtx.newPage();
    await host.goto(`http://127.0.0.1:${server.port}/client/?e2ehost=1&e2ecivs=2&e2ehumans=2&e2ehold=1`);
    await expect(host.locator('#lobby-code')).toBeVisible();
    const joinCode = (await host.locator('#lobby-code').textContent()).trim();

    const join = await joinCtx.newPage();
    await join.goto(`http://127.0.0.1:${server.port}/client/?e2ejoin=${joinCode}`);
    await expect(join.locator('#lobby-code')).toHaveText(joinCode);

    await host.locator('#setup-start').click();
    await expect(host.locator('#hud-status')).toContainText('turn 1', { timeout: 30000 });

    // --- play: found a city, end the turn (autosave follows every command) ---
    await host.keyboard.press('b');
    await expect(host.locator('#name-dialog')).toBeVisible();
    await host.locator('#name-input').fill('Resumeton');
    await host.locator('#name-ok').click();
    // the city name lives on canvas, not in the DOM — the autosave file
    // below is the assertion medium (the server saves after every command)
    await host.keyboard.press('Escape'); // close the city panel if it opened
    await host.keyboard.press('e');      // end turn

    // the autosave lands as saves/<gameId>.json in our temp dir
    let saveFile = null, saved = null;
    await expect.poll(() => {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
      for (const f of files) {
        const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        const cities = Object.values((s.state || {}).cities || {});
        if (cities.some(c => c.name === 'Resumeton')) { saveFile = f; saved = s; return true; }
      }
      return false;
    }, { timeout: 20000 }).toBe(true);
    expect(saved.code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{5}$/);
    const gameId = path.basename(saveFile, '.json');

    // --- the server dies with the game in the save ---
    await hostCtx.close();
    await joinCtx.close();
    await server.close();

    // --- phase 2: a fresh server on the same saves dir; resume BY CODE ---
    // no explicit gameId needed: the default game's id is namespaced
    // ('default-g<seed>') since the collision fix this spec's first honest
    // failure motivated — server.test.js pins the ws-level red case
    server = await startServer({ seed: 1, civs: 2, humans: 1, size: 'xsmall', savesDir: dir, host: '127.0.0.1' });
    const resume = await resumeCtx.newPage();
    await resume.goto(`http://127.0.0.1:${server.port}/client/`);
    await resume.locator('#setup-host').click();
    await expect(resume.locator('#lobby-code-btn')).toBeVisible();
    await resume.locator('#lobby-code').fill(saved.code);
    await resume.locator('#lobby-code-btn').click();
    // the resumed join boots the game at the saved position
    await expect(resume.locator('#hud-status')).toContainText(`turn ${saved.state.turn}`, { timeout: 30000 });
    // find the city's tile on screen (the hud readout names the hovered
    // tile), then double-click it — that opens the city view even with units
    const city = Object.values(saved.state.cities).find(c => c.name === 'Resumeton');
    // the resumer holds the CIVILIZED seat from the save (a bare 'Player 1'
    // would mean the join resolved to a fresh default game — the g1 id
    // collision this spec's server-B gameId works around)
    await expect(resume.locator('#hud-status')).not.toContainText('Player 1');
    await resume.keyboard.press('c'); // A16: fly the camera to the capital
    await resume.waitForTimeout(2500); // the camera glide needs frames under SwiftShader
    // in-page synthetic pointermove scan (fast): the hud readout names the
    // hovered tile — return the screen point where it matches the city
    const cityPoint = await resume.evaluate(([cx, cy]) => {
      const canvas = document.querySelector('#app canvas');
      const r = canvas.getBoundingClientRect();
      const seen = new Set();
      for (let y = 40; y < r.height - 30; y += 10) {
        for (let x = 30; x < r.width - 30; x += 10) {
          canvas.dispatchEvent(new PointerEvent('pointermove', {
            clientX: r.left + x, clientY: r.top + y, bubbles: true
          }));
          const t = document.getElementById('hud-tile').textContent;
          const m = t.match(/^\((\d+),(\d+)\)/);
          if (m) seen.add(`${m[1]},${m[2]}`);
          if (t.startsWith(`(${cx},${cy})`)) {
            return { x: r.left + x, y: r.top + y };
          }
        }
      }
      return { debug: [...seen].sort().join(' ') || 'NO TILES AT ALL' };
    }, [city.x, city.y]);
    expect(typeof (cityPoint && cityPoint.x), `the city tile (${city.x},${city.y}) is on screen`).toBe('number');
    await resume.mouse.dblclick(cityPoint.x, cityPoint.y);
    await expect(resume.locator('body')).toContainText('Resumeton', { timeout: 10000 });

    // --- a second client rejoins the resumed game (by its id as join code) ---
    const rejoin = await rejoinCtx.newPage();
    await rejoin.goto(`http://127.0.0.1:${server.port}/client/?e2ejoin=${gameId}`);
    // seats were reset on resume: the rejoiner reaches the live game's seat
    // surface (name/seat list or straight into the game view)
    await expect(rejoin.locator('body')).toContainText(/seat|turn/i, { timeout: 30000 });
  } finally {
    await resumeCtx.close();
    await rejoinCtx.close();
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
