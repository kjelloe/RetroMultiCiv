// A49 spec (a): host + joiner lobby CHAT, both directions — a real two-context
// flow against one live server. This is the exchange raw CDP lost twice: two
// independent browser contexts on one ws-backed lobby, each asserting it SEES
// the other's message. Drives the client's own e2e auto-hooks (?e2ehost /
// ?e2ejoin) so there are no native prompt() dialogs to wrestle.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  server = await startServer({ seed: 1, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('lobby chat: host and joiner each see the other\'s message', async ({ browser }) => {
  const base = `http://127.0.0.1:${server.port}/client/`;
  const hostCtx = await browser.newContext();
  const joinCtx = await browser.newContext();
  try {
    // Host: auto-host a 2-human lobby and hold in the waiting room.
    const host = await hostCtx.newPage();
    await host.goto(`${base}?e2ehost=1&e2ecivs=2&e2ehumans=2&e2ehold=1`);
    await expect(host.locator('#lobby-code')).toBeVisible();
    const code = (await host.locator('#lobby-code').textContent()).trim();
    expect(code).toMatch(/^[0-9A-Z]{5}$/);

    // Joiner: auto-join by that code — lands in the same lobby.
    const join = await joinCtx.newPage();
    await join.goto(`${base}?e2ejoin=${code}`);
    await expect(join.locator('#lobby-code')).toHaveText(code);

    // Chat is on by default → the panel is live on both sides.
    await expect(host.locator('#lobby-chat-text')).toBeVisible();
    await expect(join.locator('#lobby-chat-text')).toBeVisible();

    // Host → joiner.
    await host.locator('#lobby-chat-text').fill('hello from the host');
    await host.locator('#lobby-chat-send').click();
    await expect(join.locator('#lobby-chat-log')).toContainText('hello from the host');

    // Joiner → host.
    await join.locator('#lobby-chat-text').fill('and hi back from Ada');
    await join.locator('#lobby-chat-send').click();
    await expect(host.locator('#lobby-chat-log')).toContainText('and hi back from Ada');
  } finally {
    await hostCtx.close();
    await joinCtx.close();
  }
});

test('lobby moderation: host toggles chat off, then kicks the joiner', async ({ browser }) => {
  const base = `http://127.0.0.1:${server.port}/client/`;
  const hostCtx = await browser.newContext();
  const joinCtx = await browser.newContext();
  try {
    const host = await hostCtx.newPage();
    await host.goto(`${base}?e2ehost=1&e2ecivs=2&e2ehumans=2&e2ehold=1`);
    await expect(host.locator('#lobby-code')).toBeVisible();
    const code = (await host.locator('#lobby-code').textContent()).trim();

    const join = await joinCtx.newPage();
    await join.goto(`${base}?e2ejoin=${code}`);
    await expect(join.locator('#lobby-code')).toHaveText(code);
    await expect(join.locator('#lobby-chat')).toBeVisible(); // chat on by default

    // Host toggles chat OFF → the joiner's chat panel follows the host's toggle.
    await host.locator('#lobby-chat-on').uncheck();
    await expect(join.locator('#lobby-chat')).toBeHidden();

    // Host kicks the joiner (explicit two-step: arm ⛔, then confirm).
    await host.locator('.lobby-kick', { hasText: '⛔' }).click();
    await host.locator('button', { hasText: 'kick Ada' }).click();
    await expect(join.locator('body')).toContainText('removed you from the lobby');
  } finally {
    await hostCtx.close();
    await joinCtx.close();
  }
});
