// #5 play-on-roblox: the setup-screen "Play on Roblox" entry point is
// hidden-until-configured — the URL constant ships EMPTY, so the button is
// absent, and only a plain https URL ever reaches an href. Pure predicate; no DOM.
const { test } = require('node:test');
const assert = require('node:assert');

test('roblox-link: hidden until an https experience URL is configured', async () => {
  const { robloxLinkHtml, ROBLOX_EXPERIENCE_URL } = await import('../client/ui/roblox-link.js');

  // ships empty → the button is absent until the publish session fills it in
  assert.strictEqual(ROBLOX_EXPERIENCE_URL, '', 'URL constant ships empty');
  assert.strictEqual(robloxLinkHtml(), '', 'default (empty const) renders no button');
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
