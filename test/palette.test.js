// Palette pass P2 (specs/palette-pass.md): the deuteranopia-safe table covers
// BOTH identity spaces — the 14 data/civs.json `color` values AND the 14
// `visual.primary` values (the unit-disc art set) — and the load-bearing
// gate recomputes the Viénot deuteranopia simulation + Lab deltaE so each
// space's pairwise distances stay above the floor: the table can only ever
// be edited into something a deuteranope can still tell apart. The identity
// default (goldens) is pinned too.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

async function load() { return import('../client/ui/palette.js'); }

// sRGB -> linear -> Viénot deuteranopia -> Lab (D65); deltaE76
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
function simDeut(rgb) {
  const [r, g, b] = rgb.map(lin);
  return [
    0.625 * r + 0.375 * g,
    0.7 * r + 0.3 * g,
    0.3 * g + 0.7 * b
  ].map(c => Math.min(1, Math.max(0, c)));
}
function lab([r, g, b]) {
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const FLOOR = 15; // curated: civ colors 17.4, visual primaries 16.2

const civColors = () => Object.values(RULESET.civs).map(c => c.color);
const visualPrimaries = () => Object.values(RULESET.civs).map(c => c.visual.primary);

test('deuteranopia-safe: covers BOTH identity spaces, valid, duplicate-free per space', async () => {
  const { PALETTES } = await load();
  const table = PALETTES['deuteranopia-safe'];
  const wanted = [...civColors(), ...visualPrimaries()].sort();
  assert.deepStrictEqual(Object.keys(table).sort(), wanted,
    'the table keys are exactly the civ colors + visual primaries');
  for (const c of Object.values(table)) assert.match(c, /^#[0-9a-fA-F]{6}$/, `bad hex ${c}`);
  // uniqueness holds WITHIN each space (russians deliberately share one
  // crimson across their map color and disc — one civ, one hue)
  for (const space of [civColors(), visualPrimaries()]) {
    const displayed = space.map(k => table[k]);
    assert.strictEqual(new Set(displayed).size, displayed.length,
      'no duplicate displayed colors within a space');
  }
});

test('deuteranopia-safe: every simulated pair clears the floor, in BOTH spaces', async () => {
  const { PALETTES } = await load();
  const table = PALETTES['deuteranopia-safe'];
  for (const [label, keys] of [['civ colors', civColors()], ['visual primaries', visualPrimaries()]]) {
    const labs = keys.map(k => lab(simDeut(hex2rgb(table[k]))));
    let min = Infinity;
    let worst = '';
    for (let i = 0; i < labs.length; i++) {
      for (let j = i + 1; j < labs.length; j++) {
        const d = dE(labs[i], labs[j]);
        if (d < min) { min = d; worst = `${table[keys[i]]} <> ${table[keys[j]]}`; }
      }
    }
    assert.ok(min >= FLOOR,
      `${label}: simulated min deltaE ${min.toFixed(1)} (${worst}) below the ${FLOOR} floor`);
  }
});

test('the identity default passes colors through untouched (the golden guarantee)', async () => {
  const { displayColor, displayVisual } = await load();
  // node has no localStorage/location: paletteMode falls to 'default'
  for (const c of [...civColors(), ...visualPrimaries()]) {
    assert.strictEqual(displayColor(c), c);
  }
  assert.strictEqual(displayColor('#123456'), '#123456', 'unknown colors pass through');
  const v = { primary: '#B83C3C', secondary: '#F2C66D', emblem: 'laurel' };
  assert.deepStrictEqual(displayVisual(v), v, 'visuals identity-map by default');
});

test('the displayed sets keep a lightness spread (moved-out dimming stays legible)', async () => {
  const { PALETTES } = await load();
  const table = PALETTES['deuteranopia-safe'];
  const Y = h => {
    const [r, g, b] = hex2rgb(h).map(lin);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const keys of [civColors(), visualPrimaries()]) {
    const ys = keys.map(k => Y(table[k]));
    assert.ok(Math.min(...ys) < 0.1, 'dark anchors exist');
    assert.ok(Math.max(...ys) > 0.5, 'bright anchors exist');
  }
});
