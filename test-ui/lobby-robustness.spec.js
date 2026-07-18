// L8 (reviewer #1328 / architect #1329): waiting-room robustness — the
// lobby never lies silently. Covered here: (1) a dead socket surfaces the
// lost-lobby line instead of a stale room (the Android sleep story's
// client-visible half, driven via setOffline), (2) chat refusals land as ⚠
// lines IN the chat log (the chatting-alone illusion). The
// started-without-joined missed-seat screen is central in the socket pump
// (6 lines) — its trigger needs a half-open socket no test harness can
// synthesize cleanly; the ws-level release path is covered by server-lan4.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 11, civs: 2, humans: 2, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('a dropped lobby socket shows the lost-connection line, not a stale room', async ({ browser }) => {
  // own server: killing it IS the socket death (setOffline leaves the ws
  // HALF-OPEN with no close event — measured here; that half-open shape is
  // the Android story itself, and only a real close reaches the client)
  const own = await startServer({ seed: 12, civs: 2, humans: 2, size: 'xsmall', autosave: false, host: '127.0.0.1' });
  const hostCtx = await browser.newContext();
  const joinCtx = await browser.newContext();
  try {
    const host = await hostCtx.newPage();
    await host.goto(`http://127.0.0.1:${own.port}/client/?e2ehost=1&e2ecivs=2&e2ehumans=2&e2ehold=1`);
    await expect(host.locator('#lobby-code')).toBeVisible();
    const code = (await host.locator('#lobby-code').textContent()).trim();

    const join = await joinCtx.newPage();
    await join.goto(`http://127.0.0.1:${own.port}/client/?e2ejoin=${code}`);
    await expect(join.locator('#lobby-code')).toHaveText(code);

    await own.close(); // every lobby socket dies
    await expect(join.locator('#lobby-status')).toContainText('lobby connection lost', { timeout: 15000 });
  } finally {
    await joinCtx.close();
    await hostCtx.close();
  }
});

test('a chat refusal lands as a warning line in the chat log', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  try {
    const host = await hostCtx.newPage();
    await host.goto(`http://127.0.0.1:${server.port}/client/?e2ehost=1&e2ecivs=2&e2ehumans=2&e2ehold=1`);
    await expect(host.locator('#lobby-code')).toBeVisible();
    // two sends inside the 1/sec per-connection window: the second refuses
    await host.locator('#lobby-chat-text').fill('one');
    await host.locator('#lobby-chat-send').click();
    await host.locator('#lobby-chat-text').fill('two');
    await host.locator('#lobby-chat-send').click();
    await expect(host.locator('#lobby-chat-log .lobby-notice')).toContainText('rate limit', { timeout: 10000 });
    // the room itself survives (no fail-screen nuke)
    await expect(host.locator('#lobby-roster')).toBeVisible();
  } finally {
    await hostCtx.close();
  }
});
