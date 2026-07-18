// N13/A4 goody-hut unit tests: the eligibility gates, the single weighted roll,
// the mapgen sprinkle exclusion, the closest-home-city rule, and the R5 zero-
// cities merc case. The cross-language OUTCOME pins live in scenarios 041-044;
// these exercise the gate logic directly (JS-only, engine-internal).
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');

let rollHut, createGame;
test('load engine modules', async () => {
  ({ rollHut } = await import('../engine/huts.js'));
  ({ createGame } = await import('../engine/mapgen.js'));
});

function tiles(n, t) { const a = []; for (let i = 0; i < n; i++) a.push({ t: t || 'grassland' }); return a; }
function base(rng, over) {
  return Object.assign({
    version: 1, turn: 20, year: -2000, activePlayer: 'p1', playerOrder: ['p1'],
    map: { width: 9, height: 5, wrapX: false, tiles: tiles(45) },
    units: {}, cities: {}, cityOrder: [], wonders: {}, nextUnitId: 9, nextCityId: 9,
    players: { p1: { id: 'p1', name: 'X', color: '#fff', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } },
    rngState: rng
  }, over || {});
}
function unit(over) {
  return Object.assign({ id: 'm', type: 'militia', owner: 'p1', x: 4, y: 2, moves: 2, fortified: false, veteran: false }, over || {});
}
// enumerate the outcome distribution over rngState 1..N to prove which outcomes
// are reachable (the eligibility gate decides the outcome SET, the roll picks)
function outcomes(mkState, mkUnit, n) {
  const seen = {};
  for (let rng = 1; rng <= n; rng++) {
    const s = mkState(rng); const events = [];
    rollHut(s, mkUnit(s), RULESET, events);
    const ev = events.find(e => e.type === 'hutEntered');
    seen[ev.result] = (seen[ev.result] || 0) + 1;
  }
  return seen;
}

test('N13 gate: advance is suppressed on turn 1, past year 1000, and with no techs left', () => {
  // turn 1: advance never fires (early-game protection)
  const t1 = outcomes(r => base(r, { turn: 1 }), () => unit(), 200);
  assert.strictEqual(t1.advance, undefined, `advance must not fire on turn 1, saw: ${JSON.stringify(t1)}`);
  // year > 1000: the "modern era, no free tech" gate
  const late = outcomes(r => base(r, { year: 1500 }), () => unit(), 200);
  assert.strictEqual(late.advance, undefined, `advance must not fire past year 1000, saw: ${JSON.stringify(late)}`);
  // all techs known -> availableTechs empty -> no advance
  const allTech = Object.keys(RULESET.techs);
  const full = outcomes(r => base(r, { players: { p1: Object.assign({}, base(0).players.p1, { techs: allTech }) } }), () => unit(), 200);
  assert.strictEqual(full.advance, undefined, `advance must not fire with no techs left, saw: ${JSON.stringify(full)}`);
  // a normal mid-game state DOES reach advance (proves the gate isn't stuck closed)
  const ok = outcomes(r => base(r), () => unit(), 200);
  assert.ok(ok.advance > 0, `advance must be reachable mid-game, saw: ${JSON.stringify(ok)}`);
});

test('N13 gate: ambush needs a home city and is suppressed near one', () => {
  // no city at all -> ambush impossible (and advancedTribe possible instead)
  const noCity = outcomes(r => base(r), () => unit(), 300);
  assert.strictEqual(noCity.ambush, undefined, `ambush needs a city, saw: ${JSON.stringify(noCity)}`);
  // a city far away (Chebyshev > ambushCityRadius from the hut at 4,2) -> ambush reachable
  const far = outcomes(r => base(r, {
    cities: { c: { id: 'c', name: 'A', owner: 'p1', x: 0, y: 0, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c']
  }), () => unit(), 300);
  assert.ok(far.ambush > 0, `ambush must be reachable with a distant city, saw: ${JSON.stringify(far)}`);
  // a city ON the hut tile's radius -> suppressed
  const near = outcomes(r => base(r, {
    cities: { c: { id: 'c', name: 'A', owner: 'p1', x: 5, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    cityOrder: ['c']
  }), () => unit(), 300);
  assert.strictEqual(near.ambush, undefined, `ambush suppressed within radius, saw: ${JSON.stringify(near)}`);
});

test('N13: gold and mercs are always eligible; the roll consumes the hut every time', () => {
  const seen = outcomes(r => base(r), () => unit(), 300);
  assert.ok(seen.gold > 0 && seen.mercs > 0, `gold+mercs always eligible, saw: ${JSON.stringify(seen)}`);
  // the village is always removed regardless of outcome
  for (let rng = 1; rng <= 40; rng++) {
    const s = base(rng); s.map.tiles[2 * 9 + 4].hut = true;
    rollHut(s, unit(), RULESET, []);
    assert.strictEqual(s.map.tiles[2 * 9 + 4].hut, undefined, `hut must be consumed (rng ${rng})`);
  }
});

test('N13: a merc unit homes to the CLOSEST owned city, foreign-closest -> no home', () => {
  // two owned cities: c2 at (5,2) is closer to the hut (4,2) than c1 at (0,0)
  const s = base(7, {
    cities: {
      c1: { id: 'c1', name: 'A', owner: 'p1', x: 0, y: 0, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } },
      c2: { id: 'c2', name: 'B', owner: 'p1', x: 5, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
    }, cityOrder: ['c1', 'c2']
  });
  // force mercs by scanning for the mercs outcome, then assert the home
  let mercUnit = null;
  for (let rng = 1; rng <= 400 && !mercUnit; rng++) {
    const st = base(rng, { cities: JSON.parse(JSON.stringify(s.cities)), cityOrder: ['c1', 'c2'] });
    const before = Object.keys(st.units).length; const events = [];
    rollHut(st, unit(), RULESET, events);
    if (events.find(e => e.type === 'hutEntered').result === 'mercs') {
      mercUnit = Object.values(st.units).find(u => Object.keys(st.units).length > before && u.id !== 'm');
    }
  }
  assert.ok(mercUnit, 'a mercs outcome must be reachable with two owned cities');
  assert.strictEqual(mercUnit.home, 'c2', 'the merc homes to the CLOSEST owned city (c2)');

  // foreign-closest: c2 belongs to p2 -> the merc gets NO home (foreign closest)
  let foreignMerc = null;
  for (let rng = 1; rng <= 400 && !foreignMerc; rng++) {
    const st = base(rng, {
      playerOrder: ['p1', 'p2'],
      cities: {
        c1: { id: 'c1', name: 'A', owner: 'p1', x: 0, y: 0, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } },
        c2: { id: 'c2', name: 'B', owner: 'p2', x: 5, y: 2, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
      }, cityOrder: ['c1', 'c2'],
      players: { p1: base(0).players.p1, p2: { id: 'p2', name: 'Y', color: '#000', human: false, gold: 0, techs: [], researching: '' } }
    });
    const events = [];
    rollHut(st, unit(), RULESET, events);
    if (events.find(e => e.type === 'hutEntered').result === 'mercs') {
      foreignMerc = Object.values(st.units).find(u => u.id !== 'm');
    }
  }
  assert.ok(foreignMerc, 'a mercs outcome must be reachable with a foreign closest city');
  assert.strictEqual(foreignMerc.home, undefined, 'no home when the closest city is foreign');
});

test('N13 R5: a merc grant with zero cities still spawns (no home) and never crashes', () => {
  let mercUnit = null;
  for (let rng = 1; rng <= 400 && !mercUnit; rng++) {
    const st = base(rng); const events = [];
    rollHut(st, unit(), RULESET, events);
    if (events.find(e => e.type === 'hutEntered').result === 'mercs') {
      mercUnit = Object.values(st.units).find(u => u.id !== 'm');
    }
  }
  assert.ok(mercUnit, 'mercs must be reachable with zero cities');
  assert.strictEqual(mercUnit.home, undefined, 'a homeless merc has no home field');
});

test('N13 mapgen sprinkle: villages never spawn on a start tile or its 8 neighbours', () => {
  const players = [
    { id: 'p1', name: 'Romans', color: '#3b7dd8', human: true },
    { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
  ];
  const state = createGame({ seed: 42, options: { width: 80, height: 50, players } }, RULESET);
  const W = state.map.width, H = state.map.height;
  const starts = [];
  for (const u of Object.values(state.units)) starts.push([u.x, u.y]);
  for (const c of Object.values(state.cities)) starts.push([c.x, c.y]);
  let huts = 0;
  for (let i = 0; i < state.map.tiles.length; i++) {
    if (state.map.tiles[i].hut !== true) continue;
    huts++;
    const x = i % W, y = Math.floor(i / W);
    for (const [sx, sy] of starts) {
      assert.ok(Math.max(Math.abs(x - sx), Math.abs(y - sy)) > 1,
        `village at (${x},${y}) is within 1 of a start (${sx},${sy}) — exclusion zone breached`);
    }
  }
  assert.ok(huts > 0, 'the sprinkle must place at least one village on a standard world');
});
