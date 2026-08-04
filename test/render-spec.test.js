// A43 drift guard: specs/render-spec.json is GENERATED from the renderer's
// declarative tables — when a table changes, the committed export must be
// regenerated in the same change (the sync-check pattern, mechanical).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..');

test('specs/render-spec.json matches the renderer tables (regenerate-and-compare)', () => {
  const committed = fs.readFileSync(path.join(REPO, 'specs', 'render-spec.json'), 'utf8');
  const fresh = execFileSync(process.execPath,
    [path.join(REPO, 'tools', 'render-spec.js'), '--stdout'], { encoding: 'utf8' });
  assert.strictEqual(fresh, committed,
    'the render spec drifted from the renderer tables — run: node tools/render-spec.js (and commit specs/render-spec.json)');
});

test('render spec shape: every section the ally parses is present and sane', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(REPO, 'specs', 'render-spec.json'), 'utf8'));
  assert.strictEqual(spec.schema.version, 1);
  const terrains = Object.keys(require('../data/terrain.json').terrains);
  for (const t of terrains) {
    assert.ok(spec.terrain.tiles[t], `terrain ${t} missing from the spec`);
    assert.strictEqual(spec.terrain.tiles[t].palette.length, 3, `${t} palette has three shades`);
  }
  assert.ok(spec.terrain.tiles.unknown, 'fogged tiles are styled too');
  const civs = Object.keys(require('../data/civs.json'));
  for (const c of civs) assert.ok(spec.factions.civs[c], `civ ${c} missing`);
  assert.strictEqual(spec.factions.emblems.length, 14, 'all 14 emblem drawings listed');
  assert.strictEqual(spec.models.cityTiers.length, 5, 'the A36 growth tiers');
  assert.ok(Object.keys(spec.models.geometries).length >= 15, 'the shared GEO table');
  for (const b of Object.values(spec.models.builders)) {
    assert.strictEqual(b.procedural, true, 'builders are honestly procedural');
    assert.ok(b.description.length > 10, 'with a real description');
  }
  assert.strictEqual(spec.anim.glideMs, 200, 'A28 glide constant');
});

test('the unitSilhouette key replaced typeClasses (loud break for stale readers)', () => {
  const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'specs', 'render-spec.json'), 'utf8'));
  assert.strictEqual(spec.models.typeClasses, undefined,
    'typeClasses must be GONE — its shape changed during A88b, stale readers must break loudly');
  const recipes = require('../data/assets/asset-recipes.json');
  assert.deepStrictEqual(spec.models.unitSilhouette, recipes.unitSilhouette,
    'unitSilhouette mirrors the generated recipe mapping');
});

// A player on the live site hit "WebGL unavailable" in Firefox and was shown
// help telling them to open chrome://settings/system — a URL that does not
// exist in their browser. The one message a blocked player ever sees has to
// address the browser they are actually using.
test('webglHelp addresses the browser the player is actually using', async () => {
  const { webglHelp } = await import('../client/diagnostics.js');
  const FF = 'Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0';
  const CR = 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
  const SF = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  const ED = CR + ' Edg/126.0';

  const ff = webglHelp(FF);
  assert.match(ff, /about:support/, 'Firefox users get the Firefox diagnostics page');
  assert.doesNotMatch(ff, /chrome:\/\//, 'Firefox users must NOT be sent to chrome:// URLs');

  const sf = webglHelp(SF);
  assert.doesNotMatch(sf, /chrome:\/\/|about:config/, 'Safari users get neither Chrome nor Firefox advice');

  for (const [name, ua] of [['chrome', CR], ['edge', ED]]) {
    const t = webglHelp(ua);
    assert.match(t, /chrome:\/\/gpu/, `${name} keeps the chrome:// diagnostics`);
    assert.doesNotMatch(t, /about:config/, `${name} does not get Firefox advice`);
  }

  // Edge's UA contains "Chrome" and Chrome's contains "Safari" — the branches
  // must not be fooled by either, which is what the two negative asserts above
  // and this one pin.
  assert.doesNotMatch(webglHelp(CR), /Lockdown Mode/, 'Chrome UA contains "Safari" but is not Safari');
});
