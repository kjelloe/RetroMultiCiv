// #18 coverage (architect pass): mapdata regen-idempotence guard.
// tools/mapdata.js maps the wiki extract (data/wiki-extract/, gitignored + regenerable)
// to the committed ruleset data/*.json. Two hazards this guards:
//   (1) NONDETERMINISM — a builder that iterates a Map/Set or otherwise produces
//       order-dependent output would make regen churn spurious diffs.
//   (2) HAND-EDIT DRIFT — the standing footgun (CLAUDE.md): editing a generated
//       data/*.json by hand is silently reverted by the next regen. Effects belong
//       in the OVERLAY tables in tools/mapdata.js, not the JSON. This asserts the
//       committed JSON IS the canonical regen output, so drift fails loudly.
// Self-skips when the extract is absent (CI has no dump), mirroring the dump test.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const EXTRACT = path.join(REPO, 'data', 'wiki-extract');
const GENERATED = ['terrain.json', 'techs.json', 'units.json', 'buildings.json', 'wonders.json'];

function extractPresent() {
  // the specific source pages the builders read (mapdata.js EXTRACT reads)
  return fs.existsSync(path.join(EXTRACT, 'terrain-civ1.json'))
    && fs.existsSync(path.join(EXTRACT, 'list-of-advances-in-civ1.json'));
}

// build all five in one pass (units/buildings/wonders take the techs table).
function regenAll() {
  const md = require('../tools/mapdata.js');
  const techs = md.buildTechs();
  return {
    'terrain.json': md.buildTerrain(),
    'techs.json': techs,
    'units.json': md.buildUnits(techs),
    'buildings.json': md.buildBuildings(techs),
    'wonders.json': md.buildWonders(techs)
  };
}

test('mapdata builders are deterministic: two independent regens are byte-identical', (t) => {
  if (!extractPresent()) { t.skip('data/wiki-extract absent (regenerable dump not present)'); return; }
  const a = regenAll();
  const b = regenAll();
  for (const f of GENERATED) {
    assert.strictEqual(
      JSON.stringify(a[f], null, 2), JSON.stringify(b[f], null, 2),
      `${f}: two regens diverged — a builder has nondeterministic output (Map/Set iteration?)`);
  }
});

test('mapdata regen matches the committed data/*.json (hand-edits get wiped — edit the OVERLAY tables)', (t) => {
  if (!extractPresent()) { t.skip('data/wiki-extract absent (regenerable dump not present)'); return; }
  const built = regenAll();
  for (const f of GENERATED) {
    const regen = JSON.stringify(built[f], null, 2) + '\n';
    const committed = fs.readFileSync(path.join(REPO, 'data', f), 'utf8');
    assert.strictEqual(
      regen, committed,
      `data/${f}: committed JSON drifted from a fresh mapdata regen. A hand-edit here is silently `
      + `reverted by the next regen — put the effect in the BUILDING_OVERLAY/WONDER_OVERLAY/TECH_ERAS `
      + `tables in tools/mapdata.js and regenerate, don't hand-edit the generated JSON.`);
  }
});
