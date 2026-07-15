const test = require('node:test');
const assert = require('node:assert');

const RULESET = require('./ruleset.js');

const PLAYERS = [
  { id: 'p1', name: 'Romans', color: '#3b7dd8', human: false },
  { id: 'p2', name: 'Zulus', color: '#d84a3b', human: false }
];

async function load() {
  const ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  const { hashState } = await import('../shared/statehash.js');
  return { ai, engine: createEngine(RULESET), hashState };
}

function grassState(width, height, units, cities, extra) {
  const tiles = [];
  for (let i = 0; i < width * height; i++) tiles.push({ t: 'grassland' });
  return Object.assign({
    version: 1, turn: 1, year: -4000, activePlayer: 'p1', playerOrder: ['p1', 'p2'],
    map: { width, height, wrapX: false, tiles },
    units, cities: cities || {}, cityOrder: Object.keys(cities || {}),
    wonders: {}, nextUnitId: 50, nextCityId: 10,
    players: {
      p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 },
      p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }
    },
    rngState: 1
  }, extra || {});
}

test('AI founds a city with idle settlers on good land', async () => {
  const { ai, engine } = await load();
  const state = grassState(9, 9, {
    u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 4, y: 4, moves: 1, fortified: false, veteran: false }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(Object.keys(after.cities).length, 1, 'city founded');
  assert.strictEqual(after.units.u1, undefined, 'settlers consumed');
  assert.notStrictEqual(after.players.p1.researching, '', 'research chosen');
});

test('AI keeps a defender: undefended city switches production to a unit', async () => {
  const { ai, engine } = await load();
  const state = grassState(9, 9, {}, {
    c9: { id: 'c9', name: 'Capital', owner: 'p1', x: 4, y: 4, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c9.producing.id, 'militia', 'undefended: build a defender first');

  // once defended, it expands with settlers
  const defended = grassState(9, 9, {
    u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false }
  }, {
    c9: { id: 'c9', name: 'Capital', owner: 'p1', x: 4, y: 4, pop: 2, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  });
  const after2 = ai.runAiTurn(engine, defended, 'p1', RULESET);
  assert.strictEqual(after2.cities.c9.producing.id, 'settlers');
});

test('AI military marches toward a known enemy city', async () => {
  const { ai, engine } = await load();
  const state = grassState(12, 5, {
    u1: { id: 'u1', type: 'legion', owner: 'p1', x: 1, y: 2, moves: 1, fortified: false, veteran: false }
  }, {
    c9: { id: 'c9', name: 'Target', owner: 'p2', x: 9, y: 2, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.units.u1.x, 2, 'stepped east toward the enemy city');
});

// A40 slice 1: regency stances. The HARD invariant first — balanced (and the
// omitted default) is the IDENTITY: pickCommand returns the exact same command
// with stance 'balanced', undefined, or an unknown value across crafted states.
test('AI stances: balanced / undefined / unknown are the byte-identical default', async () => {
  const { ai, engine } = await load();
  const crafted = [
    grassState(9, 9, { u1: { id: 'u1', type: 'settlers', owner: 'p1', x: 4, y: 4, moves: 1, fortified: false, veteran: false } }),
    grassState(9, 9, {}, { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } } }),
    grassState(12, 5, { u1: { id: 'u1', type: 'legion', owner: 'p1', x: 1, y: 2, moves: 1, fortified: false, veteran: false } },
      { c9: { id: 'c9', name: 'T', owner: 'p2', x: 9, y: 2, pop: 1, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } })
  ];
  for (const st of crafted) {
    const base = ai.pickCommand(st, 'p1', RULESET, {});
    assert.deepStrictEqual(ai.pickCommand(st, 'p1', RULESET, {}, 'balanced'), base, 'balanced == default');
    assert.deepStrictEqual(ai.pickCommand(st, 'p1', RULESET, {}, undefined), base, 'undefined == default');
    assert.deepStrictEqual(ai.pickCommand(st, 'p1', RULESET, {}, 'nonsense'), base, 'unknown stance falls back to balanced');
  }
});

test('AI stance defensive: garrisons two + prioritizes city walls', async () => {
  const { ai, engine } = await load();
  // a city with ONE guard, producing settlers, no enemy near
  const mk = () => grassState(9, 9,
    { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false } },
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } } },
    { players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: ['masonry'], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }, p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  const balanced = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'balanced');
  const defensive = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'defensive');
  assert.strictEqual(balanced.cities.c9.producing.id, 'settlers', 'balanced (1 guard, no threat): keeps expanding');
  assert.strictEqual(defensive.cities.c9.producing.id, 'militia', 'defensive: wants a second guard');
});

test('AI stance growth: builds settlers past the balanced cap', async () => {
  const { ai, engine } = await load();
  // 1 city, 2 settlers already exist → balanced is AT its ratio (2 < 2 false);
  // growth (base 3, div 1) still wants more
  const mk = () => grassState(14, 9,
    { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
      u2: { id: 'u2', type: 'settlers', owner: 'p1', x: 6, y: 4, moves: 0, fortified: false, veteran: false },
      u3: { id: 'u3', type: 'settlers', owner: 'p1', x: 8, y: 4, moves: 0, fortified: false, veteran: false } },
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'building', id: 'granary' } } });
  const balanced = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'balanced');
  const growth = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'growth');
  assert.notStrictEqual(balanced.cities.c9.producing.id, 'settlers', 'balanced: enough settlers, builds otherwise');
  assert.strictEqual(growth.cities.c9.producing.id, 'settlers', 'growth: keeps expanding');
});

test('AI stance science: prefers science rates when disorder-free', async () => {
  const { ai, engine } = await load();
  const mk = () => grassState(9, 9,
    { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false } },
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'settlers' } } },
    { players: { p1: { id: 'p1', name: 'A', color: '#00f', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 }, p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: 'x', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  const balanced = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'balanced');
  const science = ai.runAiTurn(engine, mk(), 'p1', RULESET, [], 'science');
  assert.strictEqual(balanced.players.p1.sciRate, 50, 'balanced never touches rates');
  assert.ok(science.players.p1.sciRate > 50, `science raises the science rate (got ${science.players.p1.sciRate})`);
});

// B11: the regent path (client playSeatLogged) and the AI round share ONE
// policy — pickCommand — and it never reads players[pid].human. Pin that a
// human:true seat gets the identical full empire policy (research, production,
// improvements), so "the regent skips the empire" can never regress into
// truth: the whole command stream must match the AI seat's byte for byte.
test('B11: a human seat (regency) gets the identical empire policy stream', async () => {
  const { ai, engine } = await load();
  const mk = (human) => grassState(14, 9,
    { u1: { id: 'u1', type: 'militia', owner: 'p1', x: 4, y: 4, moves: 0, fortified: true, veteran: false },
      u2: { id: 'u2', type: 'settlers', owner: 'p1', x: 5, y: 4, moves: 1, fortified: false, veteran: false },
      // u3 = settler rank 1 (the homeland IMPROVER) parked ON a worked tile
      // of c9 — its road job is underfoot, so startWork lands immediately
      u3: { id: 'u3', type: 'settlers', owner: 'p1', x: 4, y: 2, moves: 1, fortified: false, veteran: false } },
    { c9: { id: 'c9', name: 'C', owner: 'p1', x: 4, y: 4, pop: 3, food: 0, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } } },
    { players: { p1: { id: 'p1', name: 'A', color: '#00f', human, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 }, p2: { id: 'p2', name: 'B', color: '#f00', human: false, gold: 0, techs: [], researching: '', bulbs: 0, taxRate: 50, sciRate: 50 } } });
  // three turns: the improver settler first WALKS to its job tile, then
  // startWork lands on a later turn — same shape either seat
  const stream = (human) => {
    let state = mk(human);
    const cmds = [];
    for (let round = 0; round < 3; round++) {
      const done = {};
      let guard = 100;
      while (guard-- > 0) {
        const cmd = ai.pickCommand(state, 'p1', RULESET, done);
        if (!cmd) break;
        const res = engine.applyCommand(state, cmd);
        if (res.ok) state = res.state;
        cmds.push(cmd);
      }
      let res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p1' });
      if (res.ok) state = res.state;
      res = engine.applyCommand(state, { type: 'endTurn', playerId: 'p2' });
      if (res.ok) state = res.state;
    }
    return cmds;
  };
  const aiSeat = stream(false);
  const regentSeat = stream(true);
  assert.deepStrictEqual(regentSeat, aiSeat, 'the seat flag must not change the policy');
  assert.ok(aiSeat.some(c => c.type === 'setResearch'), 'idle research gets a pick');
  assert.ok(aiSeat.some(c => c.type === 'startWork'), 'the improver settler starts work');
});

test('a full AI-vs-AI game is deterministic and reaches an end', async () => {
  const { ai, engine, hashState } = await load();
  const play = () => {
    let state = engine.createGame({ seed: 4242, options: { width: 30, height: 20, players: PLAYERS } });
    let guard = 400;
    while (!state.gameOver && guard-- > 0) {
      const pid = state.activePlayer;
      state = ai.runAiTurn(engine, state, pid, RULESET);
      const res = engine.applyCommand(state, { type: 'endTurn', playerId: pid });
      if (res.ok) state = res.state;
    }
    return state;
  };
  const a = play();
  const b = play();
  assert.strictEqual(hashState(a), hashState(b), 'identical AI games from the same seed');
  assert.ok(Object.keys(a.cities).length >= 1, 'AI civilizations founded cities');
  // the game either ended or is still legally in progress after the cap
  if (a.gameOver) assert.ok(a.players[a.winner], 'winner is a real player');
});


// --- Batch 4 iteration 3 (docs/04): entertainers-local disorder management --

test('batch 4: a disordered city converts its worst tile to an entertainer', async () => {
  const { ai, engine } = await load();
  // pop 6, no garrison, contentCitizens 4 => unhappy 2 > happy 0 = disorder
  const state = grassState(9, 9, {}, {
    c9: { id: 'c9', name: 'Riot', owner: 'p1', x: 4, y: 4, pop: 6, food: 20, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  });
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  const c = after.cities.c9;
  assert.ok(Array.isArray(c.workers), 'manual assignment set');
  assert.strictEqual(c.workers.length, 5, 'pop 6 works 5 tiles: one citizen entertains');
  assert.strictEqual(after.players.p1.luxRate, undefined, 'rates untouched — the cost stays local');
});

test('batch 4: no flap — the entertainer is NOT reverted while the auto layout would riot', async () => {
  const { ai, engine } = await load();
  const state = grassState(9, 9, {}, {
    c9: { id: 'c9', name: 'Riot', owner: 'p1', x: 4, y: 4, pop: 6, food: 20, shields: 0, buildings: [], producing: { kind: 'unit', id: 'militia' } }
  });
  const once = ai.runAiTurn(engine, state, 'p1', RULESET);
  // run a second AI turn on the result: the hypothetical auto layout still
  // riots (nothing else changed), so the assignment must SURVIVE
  const twice = ai.runAiTurn(engine, once, 'p1', RULESET);
  assert.ok(Array.isArray(twice.cities.c9.workers), 'assignment kept');
  assert.strictEqual(twice.cities.c9.workers.length, 5, 'still one entertainer — no oscillation');
});

test('batch 4: a temple calms the city and the tiles go back to auto', async () => {
  const { ai, engine } = await load();
  const state = grassState(9, 9, {}, {
    c9: { id: 'c9', name: 'Calmed', owner: 'p1', x: 4, y: 4, pop: 5, food: 20, shields: 0, buildings: ['temple'], producing: { kind: 'unit', id: 'militia' }, workers: [0, 1, 2, 3] }
  });
  // pop 5 auto layout has ONE would-be rioter; the temple's contentBonus 1
  // calms exactly that one, so the hypothetical passes and the AI hands
  // the tiles back (pop 6 would need temple+market — one temple is not
  // enough, and the no-flap test above proves the guard holds there)
  const after = ai.runAiTurn(engine, state, 'p1', RULESET);
  assert.strictEqual(after.cities.c9.workers, undefined,
    'reverted to auto (setWorkers auto:true clears manual mode)');
});
