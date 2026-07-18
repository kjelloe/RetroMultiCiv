// check.sh gate 9, JS side (architect grant @0acb4ef4 condition c): the
// cross-language fast-forward proof. Fixed seed + a short synthetic probe
// age (25 turns + the ancient-era grant) — the loop and the grant path are
// the same code no matter the turn count, so a fast probe pins parity
// without a multi-minute gate. Prints one line: the final state hash.
// The luau twin (fastforward-parity.luau) must print the identical hash.
import { readFileSync } from 'node:fs';
import { createEngine } from '../../engine/index.js';
import { fastForwardTo } from '../../shared/fastforward.js';
import { hashState } from '../../shared/statehash.js';

const ruleset = {};
for (const f of ['terrain', 'units', 'techs', 'buildings', 'wonders', 'governments', 'civs', 'rules']) {
  ruleset[f] = JSON.parse(readFileSync(new URL(`../../data/${f}.json`, import.meta.url), 'utf8'));
}

const CIVS = ['romans', 'babylonians', 'germans'];
const players = CIVS.map((id, i) => ({
  id: 'p' + (i + 1), name: ruleset.civs[id].name, color: ruleset.civs[id].color,
  human: i === 0,
}));

const engine = createEngine(ruleset);
const created = engine.createGame({
  seed: 20260718,
  options: { width: 40, height: 25, players, mapType: 'continents' },
});
if (created.ok === false) { console.error('createGame failed: ' + created.reason); process.exit(1); }
// createGame returns the state itself on success ({ok:false,...} on failure)

const PROBE_AGE = { id: 'probe', turn: 25, grantEras: ['ancient'] };
const r = fastForwardTo(ruleset, created, PROBE_AGE, ['p1']);
if (r.aborted) { console.error('aborted: ' + JSON.stringify(r.aborted)); process.exit(1); }
const h = hashState(r.state) >>> 0;
console.log('ff-parity 0x' + h.toString(16).padStart(8, '0') + ' turn ' + r.state.turn + ' grant ' + r.grant.length);
