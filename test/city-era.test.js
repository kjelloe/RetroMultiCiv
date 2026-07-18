// City look by ERA (specs/city-era-looks.md): the band derivation is pure and
// the band→style table must be complete (a new band can't render blank), and
// the renderer must map every style key — mirroring mock-state's terrain
// coverage assert. Render-only / golden-neutral: no engine or state touch.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let CE;
test.before(async () => { CE = await import('../shared/city-era.js'); });

test('cityEraBand: highest owner tech era wins; fog default is ancient', () => {
  const techs = { a: { era: 'ancient' }, r: { era: 'renaissance' }, i: { era: 'industrial' }, m: { era: 'modern' } };
  assert.strictEqual(CE.cityEraBand(null, techs), 'ancient', 'no owner → ancient');
  assert.strictEqual(CE.cityEraBand({ techs: [] }, techs), 'ancient', 'no techs → ancient');
  assert.strictEqual(CE.cityEraBand({ techs: ['a'] }, techs), 'ancient');
  assert.strictEqual(CE.cityEraBand({ techs: ['r'] }, techs), 'classicalMedieval', 'renaissance folds to classicalMedieval');
  assert.strictEqual(CE.cityEraBand({ techs: ['i'] }, techs), 'industrial');
  assert.strictEqual(CE.cityEraBand({ techs: ['m'] }, techs), 'modernSpace');
  assert.strictEqual(CE.cityEraBand({ techs: ['a', 'm', 'r'] }, techs), 'modernSpace', 'highest wins');
  assert.strictEqual(CE.cityEraBand({ techs: ['a'] }, null), 'ancient', 'no table → ancient');
});

test('annotateCityEra stamps a band on every viewed city', () => {
  const view = {
    players: { p1: { techs: ['m'] }, p2: { techs: ['a'] } },
    cities: { c1: { owner: 'p1' }, c2: { owner: 'p2' }, c3: { owner: 'p3' } }
  };
  CE.annotateCityEra(view, { a: { era: 'ancient' }, m: { era: 'modern' } });
  assert.strictEqual(view.cities.c1.eraBand, 'modernSpace');
  assert.strictEqual(view.cities.c2.eraBand, 'ancient');
  assert.strictEqual(view.cities.c3.eraBand, 'ancient', 'unknown owner → ancient');
});

test('every band has a style with roofShape + roofMat + body', () => {
  for (const band of CE.CITY_ERA_BANDS) {
    const s = CE.CITY_ERA_STYLES[band];
    assert.ok(s, `band "${band}" has no style`);
    assert.ok(typeof s.roofShape === 'string' && s.roofShape, `band "${band}" missing roofShape`);
    assert.ok(typeof s.roofMat === 'string' && s.roofMat, `band "${band}" missing roofMat`);
    assert.ok(typeof s.body === 'string' && s.body, `band "${band}" missing body`);
    assert.ok(typeof s.prop === 'string', `band "${band}" prop must be a string ('' = none)`);
  }
});

test('every real tech era maps to a known band', () => {
  const techs = require('../data/techs.json');
  const eras = new Set(Object.values(techs).map(t => t.era));
  for (const era of eras) {
    const band = CE.cityEraBand({ techs: ['x'] }, { x: { era } });
    assert.ok(CE.CITY_ERA_BANDS.includes(band), `era "${era}" → unknown band "${band}"`);
  }
});

// assets.js is browser ESM (imports 'three'), so — like the terrain test — read
// its era tables from source and assert they map every style key.
test('the renderer (assets.js) maps every era style key', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'client', 'renderer', 'three', 'assets.js'), 'utf8');
  const keysOf = (name) => {
    const m = src.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\};`));
    assert.ok(m, `${name} table not found in assets.js`);
    return m[1].match(/(\w+)\s*:/g).map(s => s.replace(/\s*:$/, ''));
  };
  const roofs = keysOf('ROOF_GEO');
  const mats = keysOf('ERA_MAT');
  const props = ['keep', 'smokestack', 'spire']; // handled in addEraSignature
  for (const band of CE.CITY_ERA_BANDS) {
    const s = CE.CITY_ERA_STYLES[band];
    assert.ok(roofs.includes(s.roofShape), `roofShape "${s.roofShape}" (${band}) not in ROOF_GEO`);
    assert.ok(mats.includes(s.body), `body "${s.body}" (${band}) not in ERA_MAT`);
    assert.ok(mats.includes(s.roofMat), `roofMat "${s.roofMat}" (${band}) not in ERA_MAT`);
    assert.ok(s.prop === '' || props.includes(s.prop), `prop "${s.prop}" (${band}) unhandled`);
  }
});
