// #5 play-on-roblox: the setup-screen "Play on Roblox" entry point.
// PUBLISHED 2026-08-05 — the constant now carries the real experience URL, so
// this pins the CONFIGURED state instead of the empty one. The hidden-until-
// configured behaviour is still pinned, via the explicit-argument cases: it is
// what protects a fork or a future re-publish, and it was the whole point of
// the predicate. Only a plain https URL may ever reach an href.
const { test } = require('node:test');
const assert = require('node:assert');

test('roblox-link: the published URL renders a button; anything unsafe never does', async () => {
  const { robloxLinkHtml, ROBLOX_EXPERIENCE_URL } = await import('../client/ui/roblox-link.js');

  // published → the setup screen shows the button
  assert.match(ROBLOX_EXPERIENCE_URL, /^https:\/\/www\.roblox\.com\/games\/\d+\//,
    'the constant carries a real roblox.com experience URL');
  assert.match(robloxLinkHtml(), /id="setup-roblox"/, 'the default render is now a real button');

  // hidden-until-configured still holds for an unset constant (forks, re-publish)
  assert.strictEqual(robloxLinkHtml(''), '', 'empty url → no button');

  // configured → a new-tab anchor to the experience
  const html = robloxLinkHtml('https://www.roblox.com/games/123/A-World-Begun');
  assert.match(html, /id="setup-roblox"/, 'has the button id');
  assert.match(html, /href="https:\/\/www\.roblox\.com\/games\/123\/A-World-Begun"/, 'href is the url');
  assert.match(html, /target="_blank"/, 'opens in a new tab');
  assert.match(html, /rel="noopener"/, 'noopener');

  // guard: anything that is not a plain https URL is refused (never reaches href)
  assert.strictEqual(robloxLinkHtml('http://insecure.example'), '', 'http rejected (https only)');
  assert.strictEqual(robloxLinkHtml('javascript:alert(1)'), '', 'javascript: rejected');
  assert.strictEqual(robloxLinkHtml('https://ok" onmouseover="x'), '', 'attribute-breaking chars rejected');
});
