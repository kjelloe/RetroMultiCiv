// Part C (mobile-resilience.md) — LOBBY wake-reconnect: a seated joiner whose
// socket dies (the sleeping-phone half-open shape) re-establishes and reclaims
// its grace-held seat with the stored reconnectId (Part B). The live half-open
// shape can't be synthesized in the harness, so this drives the DETECTABLE
// drop: force-close the lobby socket, then assert a NEW socket is opened and
// the seat is retained. The lobby is booked FULL (2 humans, both seated) so a
// fresh reservation would hit gameFull — retention proves the reconnectId was
// presented and the reclaim path ran end-to-end (not a lucky re-reserve).
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 1, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('lobby reconnect: a dropped joiner reclaims its full-lobby seat on wake', async ({ browser }) => {
  const base = `http://127.0.0.1:${server.port}/client/`;
  const hostCtx = await browser.newContext();
  const joinCtx = await browser.newContext();
  // count the joiner's WebSocket instances so a reconnect is observable
  await joinCtx.addInitScript(() => {
    window.__wsCount = 0;
    window.__wsList = [];
    const Native = window.WebSocket;
    const Wrapped = function (...args) {
      const s = new Native(...args);
      window.__wsCount += 1;
      window.__wsList.push(s);
      return s;
    };
    Wrapped.prototype = Native.prototype;
    for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) Wrapped[k] = Native[k];
    window.WebSocket = Wrapped;
  });
  try {
    // Host a 2-human lobby and hold it in the waiting room (p1 = host).
    const host = await hostCtx.newPage();
    await host.goto(`${base}?e2ehost=1&e2ecivs=2&e2ehumans=2&e2ehold=1`);
    await expect(host.locator('#lobby-code')).toBeVisible();
    const code = (await host.locator('#lobby-code').textContent()).trim();

    // Joiner takes p2 → the lobby is now FULL (no free human seat).
    const join = await joinCtx.newPage();
    await join.goto(`${base}?e2ejoin=${code}`);
    await expect(join.locator('#lobby-code')).toHaveText(code);
    await expect(join.locator('#lobby-roster')).toContainText('(you)');

    const before = await join.evaluate(() => window.__wsCount);

    // Sever the lobby socket (the OS-killed shape the wake-probe catches).
    await join.evaluate(() => window.__wsList.slice().forEach(s => { try { s.close(); } catch (e) {} }));

    // The client re-establishes (a NEW socket) and reclaims the seat.
    await expect.poll(() => join.evaluate(() => window.__wsCount), { timeout: 15000 })
      .toBeGreaterThan(before);
    await expect(join.locator('#lobby-roster')).toContainText('(you)', { timeout: 15000 });

    // Not the truth screen, not a gameFull rejection — the reclaim held the seat.
    await expect(join.locator('body')).not.toContainText('started WITHOUT your seat');
    await expect(join.locator('body')).not.toContainText('that game is full');
    await expect(join.locator('body')).not.toContainText('connection lost');
  } finally {
    await hostCtx.close();
    await joinCtx.close();
  }
});
