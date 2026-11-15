#!/usr/bin/env node
// check.sh gate 58 (plan step 1.0): the difficulty the host picks reaches the
// engine. The server's and the lobby's level lists are rules.json's
// `difficulties` (easiest first), createGame takes each id, the server passes
// it, and the replay tool rebuilds the same game from [R4INIT] levels=7.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { loadRuleset } = require('../../tools/replay.js');
const { createEngine } = await import('../../engine/index.js');

const errs = [];
const check = (name, ok, detail) => { if (!ok) errs.push(`${name}${detail !== undefined ? ': ' + JSON.stringify(detail) : ''}`); };
const read = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const listOf = (src, re) => { const m = re.exec(src); return m ? [...m[1].matchAll(/"([a-z]+)"/g)].map(x => x[1]) : null; };

const server = read('roblox/src/server/GameServer.server.luau');
const lobby = read('roblox/src/client/Lobby.client.luau');
const assemble = read('roblox/acceptance/assemble.js');
const ruleset = loadRuleset();
const rows = ruleset.rules.difficulties;
const ids = Object.keys(rows);

const serverLevels = listOf(server, /local DIFFICULTY_LEVELS = \{([^}]*)\}/);
const lobbyLevels = listOf(lobby, /local SETUP_DIFFICULTY = \{([^}]*)\}/);
check('server levels = rules.json difficulties, in order', JSON.stringify(serverLevels) === JSON.stringify(ids), serverLevels);
check('lobby levels = the server levels', JSON.stringify(lobbyLevels) === JSON.stringify(serverLevels), lobbyLevels);
for (const id of ids) check(`lobby names ${id}`, new RegExp(`\\b${id} = "[A-Z][A-Za-z-]+"`).test(lobby));
check('server passes the level to createGame', server.includes('difficulty = setup.difficulty }, -- step 1.0'));
check('server defaults to prince', /difficulty = "prince", combat = "bestof3", seedOverride = 0, -- R24b/.test(server));
check('[R4INIT] marks the new shape', server.includes('marathon=%s levels=7 initialHash=%s'));
check('saves mark the new shape', server.includes('levels = (not setup.legacyDifficulty) and 7 or nil'));
check('a legacy save keeps its rules override', server.includes('setup.legacyDifficulty = envelope.levels ~= 7'));
check('replay tool reads levels=7', assemble.includes("const engineLevels = init.levels === '7';") && assemble.includes('engineLevels ? { difficulty: init.difficulty } : {}'));

// the engine takes each id and the figures differ level to level
const engine = createEngine(ruleset);
const players = ['romans', 'zulus', 'babylonians'].map((civ, i) => ({ id: 'p' + (i + 1), civ, name: ruleset.civs[civ].name, color: ruleset.civs[civ].color, human: i === 0 }));
const make = difficulty => engine.createGame({ seed: 1234, options: Object.assign({ width: 40, height: 25, players }, difficulty ? { difficulty } : {}) });
let lastContent = Infinity;
for (const id of ids) {
  const st = make(id);
  check(`createGame takes ${id}`, st.ok !== false && st.difficulty === id, st.difficulty);
  check(`${id}: start gold from its row`, st.players.p1.gold === rows[id].startGold, st.players.p1.gold);
  check(`${id}: not easier than the level before`, rows[id].contentCitizens <= lastContent, rows[id].contentCitizens);
  lastContent = rows[id].contentCitizens;
}
check('hardest level is harder than the easiest', rows[ids[0]].contentCitizens > rows[ids.at(-1)].contentCitizens && rows[ids[0]].aiCostPct > rows[ids.at(-1)].aiCostPct);
// the old lobby ids match no row: the engine falls back to prince (what every game ran as before step 1.0)
for (const legacy of ['easy', 'medium', 'hard']) {
  check(`legacy id ${legacy} is not a level`, rows[legacy] === undefined);
  check(`legacy id ${legacy} falls back to prince`, make(legacy).difficulty === 'prince');
}
check('no id falls back to prince', make(undefined).difficulty === 'prince');

if (errs.length) {
  console.error('difficulty-levels: FAIL');
  for (const e of errs) console.error('  ' + e);
  process.exit(1);
}
console.log(`difficulty-levels: ${ids.length} levels reach the engine (${ids.join(', ')})`);
