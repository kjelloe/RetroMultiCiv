// Harness smoke: prove the lane can launch chromium (SwiftShader) and reach a
// live server's client under two contexts. The real multi-client flows live in
// the other specs; this just guards the lane's own plumbing.
import { test, expect } from '@playwright/test';
import { startServer } from '../server/index.js';

let server;
test.beforeAll(async () => {
  // no ruleset opt → startServer loads it from data/ (loadRuleset)
  server = await startServer({ seed: 1, civs: 2, humans: 1, size: 'xsmall', autosave: false, host: '127.0.0.1' });
});
test.afterAll(async () => { await server.close(); });

test('the client loads over a live server in two contexts', async ({ browser }) => {
  const base = `http://127.0.0.1:${server.port}/client/`;
  const a = await browser.newContext();
  const b = await browser.newContext();
  try {
    const pa = await a.newPage();
    const pb = await b.newPage();
    await pa.goto(base);
    await pb.goto(base);
    // the setup screen's LAN buttons are the stable landmark
    await expect(pa.locator('#setup-host')).toBeVisible();
    await expect(pb.locator('#setup-join')).toBeVisible();
  } finally {
    await a.close();
    await b.close();
  }
});
