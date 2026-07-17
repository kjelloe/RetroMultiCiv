// A51c: the GLOBAL tab — a client configured with a master URL lists an
// announced server, and picking it re-points the whole join flow at that
// host's origin (the A41 browse then shows ITS public lobby). Local master
// (allowPrivate) + two real game servers.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';
import { createMaster } from '../tools/master.js';
import WebSocket from 'ws';

let master, masterPort, serverA, serverB, hostWs;
test.beforeAll(async () => {
  master = createMaster({ allowPrivate: true, probe: async () => true });
  masterPort = await master.listen(0);
  // server B announces itself and carries one PUBLIC lobby
  serverB = await startServer({
    seed: 8, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1',
    announce: `http://127.0.0.1:${masterPort}`, publicAddr: '127.0.0.1',
    publicName: 'Global B', announceIntervalMs: 300
  });
  await new Promise((resolve, reject) => {
    hostWs = new WebSocket(`ws://127.0.0.1:${serverB.port}/ws`);
    hostWs.on('open', () => hostWs.send(JSON.stringify({
      t: 'create', name: 'GlobalHost',
      options: { civs: 2, humans: 2, size: 'xsmall', public: true }
    })));
    hostWs.on('message', raw => {
      if (JSON.parse(raw.toString()).t === 'created') resolve();
    });
    hostWs.on('error', reject);
  });
  // server A just serves the client page (the "local" host the player is on)
  serverA = await startServer({ seed: 9, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => {
  if (hostWs) hostWs.close();
  await serverA.close();
  await serverB.close();
  await master.close();
});

test('global tab lists the announced server; picking it browses ITS public lobby', async ({ page }) => {
  // the master's 5s per-IP rate floor paces the heartbeats — wait until the
  // index reflects the public lobby before the page takes its one snapshot
  await expect.poll(async () => {
    const r = await fetch(`http://127.0.0.1:${masterPort}/servers`).then(x => x.json());
    return r.servers.length === 1 ? r.servers[0].openGames : -1;
  }, { timeout: 20000 }).toBe(1);

  await page.goto(`http://127.0.0.1:${serverA.port}/client/?master=http://127.0.0.1:${masterPort}`);
  await page.locator('#setup-join').click();

  // the global section appears (a master URL is configured) and lists B
  const globalList = page.locator('#lobby-global-list');
  await expect(page.locator('#lobby-global')).toBeVisible();
  const row = page.locator('.lobby-global-row', { hasText: 'Global B' });
  await expect(row).toBeVisible({ timeout: 15000 });
  // same repo, same rules: the row is NOT greyed as a mismatch
  await expect(row).not.toHaveClass(/lobby-global-mismatch/);
  await expect(row).toContainText('1 open');

  // pick it: the join flow re-renders against B's origin — its PUBLIC lobby
  // shows up in the A41 browse list, and the active-origin note offers a way back
  await row.locator('button', { hasText: 'browse' }).click();
  await expect(page.locator('#lobby-browse-list')).toContainText('GlobalHost', { timeout: 15000 });
  await expect(page.locator('#lobby-global-active')).toBeVisible();

  // back to the local server: the note goes away, the browse list is A's (empty)
  await page.locator('#lobby-global-active button').click();
  await expect(page.locator('#lobby-global-active')).toHaveCount(0);
  await expect(page.locator('#lobby-browse-list')).not.toContainText('GlobalHost');
});
