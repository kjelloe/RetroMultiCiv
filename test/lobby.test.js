// Phase-4 slice 1 (docs/08 §2): the pure lobby registry surface — join-code
// derivation and create/list/resolve. The seat-token lifecycle across
// lobby→start is pending an architect design decision and is NOT yet tested.
const test = require('node:test');
const assert = require('node:assert');
const RULESET = require('./ruleset.js');
const lobby = import('../server/lobby.js');
let joinCode, createRegistry, yearAtTurn;
test.before(async () => { ({ joinCode, createRegistry, yearAtTurn } = await lobby); });

test('joinCode: 5 Crockford chars, deterministic, alphabet-clean', () => {
  assert.strictEqual(joinCode('g1'), joinCode('g1'), 'deterministic');
  assert.match(joinCode('g1'), /^[0-9A-HJKMNP-TV-Z]{5}$/, '5 Crockford chars (no I/L/O/U)');
  // distinct gameIds almost never collide — sample a batch
  const codes = new Set();
  for (let i = 1; i <= 200; i++) codes.add(joinCode('g' + i));
  assert.ok(codes.size >= 198, `few collisions across 200 ids (got ${codes.size} distinct)`);
});

test('create: builds a pre-start lobby with the right seats, clamped', () => {
  let n = 0;
  const reg = createRegistry({ ruleset: {}, gameIdFn: () => 'g' + (++n) });
  const { entry: e } = reg.create({ civs: 4, humans: 2, size: 'small' }, 'Kjell');
  assert.strictEqual(e.status, 'lobby');
  assert.strictEqual(e.gameId, 'g1');
  assert.strictEqual(e.joinCode, joinCode('g1'));
  assert.strictEqual(Object.keys(e.seats).length, 4);
  assert.deepStrictEqual(Object.keys(e.seats).map(p => e.seats[p].human), [true, true, false, false]);
  assert.strictEqual(e.game, null, 'no engine game until start');
  // clamping (A38): civs 2..14 (the roster ceiling; no maxCivsBySize table
  // in this bare ruleset), humans 1..civs
  const { entry: big } = reg.create({ civs: 99, humans: 99, size: 'nonsense' }, 'Kjell');
  assert.strictEqual(Object.keys(big.seats).length, 14);
  assert.strictEqual(big.options.size, 'medium', 'unknown size falls back');
  assert.strictEqual(Object.values(big.seats).filter(s => s.human).length, 14);
  const { entry: tiny } = reg.create({ civs: 1, humans: 0 }, 'Kjell');
  assert.strictEqual(Object.keys(tiny.seats).length, 2, 'civs floors at 2');
  assert.strictEqual(Object.values(tiny.seats).filter(s => s.human).length, 1, 'humans floors at 1');
});

test('create: the measured seats-per-size table gates civ counts (A38)', () => {
  let n = 0;
  const ruleset = { rules: { maxCivsBySize: { xsmall: 7, small: 12, medium: 14 } } };
  const reg = createRegistry({ ruleset, gameIdFn: () => 'g' + (++n) });
  const rej = reg.create({ civs: 13, humans: 1, size: 'small' }, 'Kjell');
  assert.strictEqual(rej.ok, false);
  assert.strictEqual(rej.reason, 'mapTooSmall');
  assert.strictEqual(rej.maxCivs, 12, 'the rejection names the limit');
  const { entry: ok } = reg.create({ civs: 12, humans: 1, size: 'small' }, 'Kjell');
  assert.strictEqual(Object.keys(ok.seats).length, 12, 'at the limit is fine');
  // setSlots clamps at the table too — greedy growth stops at the size cap
  const grown = reg.setSlots(ok.gameId, 99);
  assert.strictEqual(grown.ok, true);
  assert.strictEqual(Object.keys(ok.seats).length, 12, 'resize clamps to small\'s 12');
});

test('resolveId: by gameId and by join code (case-insensitive)', () => {
  let n = 0;
  const reg = createRegistry({ ruleset: {}, gameIdFn: () => 'g' + (++n) });
  const { entry: e } = reg.create({ civs: 2, humans: 1 }, 'Kjell');
  assert.strictEqual(reg.resolveId(e.gameId), e.gameId);
  assert.strictEqual(reg.resolveId(e.joinCode), e.gameId);
  assert.strictEqual(reg.resolveId(e.joinCode.toLowerCase()), e.gameId, 'codes are case-insensitive');
  assert.strictEqual(reg.resolveId('ZZZZZ'), null);
});

test('list: reflects seat occupancy', () => {
  let n = 0;
  const reg = createRegistry({ ruleset: {}, gameIdFn: () => 'g' + (++n) });
  const { entry } = reg.create({ civs: 3, humans: 2 }, 'Kjell'); // creator holds p1
  let row = reg.list().find(g => g.gameId === entry.gameId);
  assert.deepStrictEqual(row.seats, { taken: 1, total: 2 }); // creator reserved p1
  assert.strictEqual(row.started, false);
  reg.reserveSeat(entry.gameId, { name: 'Ada' });
  row = reg.list().find(g => g.gameId === entry.gameId);
  assert.deepStrictEqual(row.seats, { taken: 2, total: 2 });
});

test('reserveSeat: first-free, requested pick, full, and release', () => {
  let n = 0;
  // fixed reconnectIdFn so reserveSeat's return (Part B mobile seat-grace adds a
  // reconnectId) stays deterministic for the exact-match assertions below.
  const reg = createRegistry({ ruleset: {}, gameIdFn: () => 'g' + (++n), reconnectIdFn: () => 'rc' });
  const { entry } = reg.create({ civs: 4, humans: 3 }, 'Kjell'); // creator p1
  assert.deepStrictEqual(reg.reserveSeat(entry.gameId, { name: 'Ada' }), { ok: true, seat: 'p2', reconnectId: 'rc' }, 'first free');
  assert.deepStrictEqual(reg.reserveSeat(entry.gameId, { name: 'Bo', seat: 'p3' }), { ok: true, seat: 'p3', reconnectId: 'rc' }, 'honors pick');
  assert.strictEqual(reg.reserveSeat(entry.gameId, { name: 'X' }).reason, 'gameFull', 'no human seats left');
  assert.strictEqual(reg.reserveSeat(entry.gameId, { name: 'X', seat: 'p4' }).reason, 'gameFull', 'p4 is an AI seat');
  reg.releaseSeat(entry.gameId, 'p3');
  assert.deepStrictEqual(reg.reserveSeat(entry.gameId, { name: 'Cy', seat: 'p3' }), { ok: true, seat: 'p3', reconnectId: 'rc' }, 'freed seat reusable');
});

test('create: the victory-conditions preset is whitelisted (so resume rebuilds the choice)', () => {
  let n = 0;
  const reg = createRegistry({ ruleset: {}, gameIdFn: () => 'g' + (++n) });
  // the stored entry.options.victory is what BOTH start and resume read
  // (overridesFor(e.options)); a dropped whitelist here was marathon's bug.
  assert.strictEqual(reg.create({ civs: 2, humans: 1, victory: 'marathon' }, 'K').entry.options.victory, 'marathon');
  assert.strictEqual(reg.create({ civs: 2, humans: 1, victory: 'standard' }, 'K').entry.options.victory, 'standard');
  assert.strictEqual(reg.create({ civs: 2, humans: 1 }, 'K').entry.options.victory, 'standard', 'omitted → standard');
  assert.strictEqual(reg.create({ civs: 2, humans: 1, victory: 'bogus' }, 'K').entry.options.victory, 'standard', 'unknown → standard');
  assert.strictEqual(reg.create({ civs: 2, humans: 1, marathon: true }, 'K').entry.options.victory, 'marathon', 'legacy marathon:true → marathon');
});

test('start: authors the seating chart — picked seat + name, unfilled/dropped → AI', () => {
  let n = 0;
  const reg = createRegistry({ ruleset: RULESET, gameIdFn: () => 'g' + (++n), seedFn: () => 424242 });
  const { entry } = reg.create({ civs: 3, humans: 3, size: 'xsmall' }, 'Kjell'); // p1..p3 human; creator p1
  reg.reserveSeat(entry.gameId, { name: 'Ada', seat: 'p3' }); // Ada picks p3; p2 left unfilled
  const res = reg.start(entry.gameId, ['p1', 'p3']); // p1, p3 live
  assert.ok(res.ok, res.reason);
  assert.deepStrictEqual(res.humanSeats, ['p1', 'p3'], 'human seats in seat order');
  const players = res.game.state.players;
  assert.strictEqual(players.p1.name, 'Kjell'); assert.strictEqual(players.p1.human, true);
  assert.strictEqual(players.p2.human, false, 'unfilled human seat → AI');
  assert.strictEqual(players.p3.name, 'Ada', 'picked seat keeps the picker name');
  assert.strictEqual(players.p3.human, true);
  assert.strictEqual(entry.status, 'started');
  assert.strictEqual(reg.start(entry.gameId, ['p1']).reason, 'alreadyStarted', 'no double start');
});

test('start: a reserved seat whose connection dropped becomes AI', () => {
  let n = 0;
  const reg = createRegistry({ ruleset: RULESET, gameIdFn: () => 'g' + (++n), seedFn: () => 55 });
  const { entry } = reg.create({ civs: 2, humans: 2, size: 'xsmall' }, 'Kjell');
  reg.reserveSeat(entry.gameId, { name: 'Bo', seat: 'p2' });
  const res = reg.start(entry.gameId, ['p1']); // p2 reserved but not live
  assert.ok(res.ok, res.reason);
  assert.strictEqual(res.game.state.players.p2.human, false, 'dropped reservation → AI');
  assert.deepStrictEqual(res.humanSeats, ['p1']);
});

// #1875 operator resource caps -------------------------------------------------

test('yearAtTurn: turn 1 is -4000 BC and the calendar advances monotonically', () => {
  const rules = RULESET.rules;
  assert.strictEqual(yearAtTurn(rules, 1), -4000, 'games start at 4000 BC');
  assert.strictEqual(yearAtTurn(rules, 2), -3980, 'first step is +20');
  assert.ok(yearAtTurn(rules, 100) > yearAtTurn(rules, 50), 'monotonic increasing');
  assert.ok(yearAtTurn(rules, 200) < rules.endYear, 'turn 200 is still before the default endYear');
});

test('create: --max-civs silently clamps the requested civ count', () => {
  let n = 0;
  const reg = createRegistry({ ruleset: {}, gameIdFn: () => 'g' + (++n), maxCivs: 4 });
  const { entry } = reg.create({ civs: 10, humans: 8, size: 'huge' }, 'Kjell');
  assert.strictEqual(Object.keys(entry.seats).length, 4, 'civs clamped to --max-civs');
  assert.strictEqual(Object.values(entry.seats).filter(s => s.human).length, 4, 'humans re-clamped to civs');
  // the operator cap tightens the resize ceiling too
  assert.strictEqual(reg.setSlots(entry.gameId, 9).ok, true);
  assert.strictEqual(Object.keys(reg.entryOf(entry.gameId).seats).length, 4, 'setSlots honors --max-civs');
});

test('create: --max-size clamps the map size DOWN to the host ceiling', () => {
  let n = 0;
  const reg = createRegistry({ ruleset: {}, gameIdFn: () => 'g' + (++n), maxSize: 'small' });
  assert.strictEqual(reg.create({ civs: 2, humans: 1, size: 'huge' }, 'K').entry.options.size, 'small', 'huge clamped to small');
  assert.strictEqual(reg.create({ civs: 2, humans: 1, size: 'xsmall' }, 'K').entry.options.size, 'xsmall', 'below the cap is untouched');
});

test('create: the map-size seat limit STILL rejects (operator cap is a separate clamp)', () => {
  let n = 0;
  const ruleset = { rules: { maxCivsBySize: { xsmall: 7, small: 12, medium: 14 } } };
  const reg = createRegistry({ ruleset, gameIdFn: () => 'g' + (++n), maxCivs: 10 });
  // 13 civs on xsmall: --max-civs clamps to 10, but xsmall only seats 7 → reject
  const rej = reg.create({ civs: 13, humans: 1, size: 'xsmall' }, 'K');
  assert.strictEqual(rej.ok, false);
  assert.strictEqual(rej.reason, 'mapTooSmall');
  assert.strictEqual(rej.maxCivs, 7, 'reject reports the MAP limit, not the operator cap');
});

test('start: --max-turns caps the game endYear (marathon 9999 → the host cap)', () => {
  let n = 0;
  const reg = createRegistry({ ruleset: RULESET, gameIdFn: () => 'g' + (++n), seedFn: () => 7, maxTurns: 100 });
  const { entry } = reg.create({ civs: 2, humans: 1, size: 'xsmall', victory: 'marathon' }, 'Kjell');
  const res = reg.start(entry.gameId, ['p1']);
  assert.ok(res.ok, res.reason);
  const capped = yearAtTurn(RULESET.rules, 100); // -25
  assert.strictEqual(res.game.toSave().rulesOverrides.endYear, capped, 'marathon endYear clamped to the ~100-turn year');
});

test('start: --max-turns leaves a game that already ends earlier UNCHANGED', () => {
  let n = 0;
  // a huge maxTurns never tightens a standard game (endYear 2100 ≈ turn 330)
  const reg = createRegistry({ ruleset: RULESET, gameIdFn: () => 'g' + (++n), seedFn: () => 7, maxTurns: 9000 });
  const { entry } = reg.create({ civs: 2, humans: 1, size: 'xsmall' }, 'Kjell'); // standard victory
  const res = reg.start(entry.gameId, ['p1']);
  assert.ok(res.ok, res.reason);
  assert.strictEqual(res.game.toSave().rulesOverrides.endYear, undefined, 'standard game keeps its default endYear (no override)');
});
