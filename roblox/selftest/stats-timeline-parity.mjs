#!/usr/bin/env node
// check.sh gate 24 (SO8 battles/wonders timelines): the GameServer accumulates
// world-public battles (combatResolved) + wonders (wonderBuilt) the same way the
// browser client/ui/stats-data.js does, pushes them on {t=stats}, and
// Statistics.client renders them. Two-sided string-scan: the browser owner logic
// (winner=attacker→attackerOwner) must still hold, and the GameServer + client
// must mirror it. A reword either side fails.
import { readFileSync } from 'node:fs';

const U = (p) => new URL(p, import.meta.url);
const statsData = readFileSync(U('../../client/ui/stats-data.js'), 'utf8');
const server = readFileSync(U('../src/server/GameServer.server.luau'), 'utf8');
const client = readFileSync(U('../src/client/Statistics.client.luau'), 'utf8');
const clientState = readFileSync(U('../src/client/ClientState.luau'), 'utf8');

const errs = [];
const needIn = (src, label, frag, why) => {
  if (!src.includes(frag)) errs.push(`missing in ${label}: ${JSON.stringify(frag)} (${why})`);
};

// the browser accumulation contract (a reword there = re-port the server)
needIn(statsData, 'stats-data.js', "e.type === 'combatResolved'", 'browser tallies battles from combat');
needIn(statsData, 'stats-data.js', "e.winner === 'attacker' ? e.attackerOwner", 'browser winner→owner mapping');
needIn(statsData, 'stats-data.js', "e.type === 'wonderBuilt'", 'browser wonders from wonderBuilt');
needIn(statsData, 'stats-data.js', 'state.cities[e.cityId]', 'browser resolves the wonder owner via the city');

// the GameServer mirrors it (same events + winner→owner + public-only)
needIn(server, 'GameServer.server.luau', 'statsBattles', 'server accumulates battles');
needIn(server, 'GameServer.server.luau', 'statsWonders', 'server accumulates wonders');
needIn(server, 'GameServer.server.luau', '"combatResolved"', 'server reads combat events');
needIn(server, 'GameServer.server.luau', 'e.winner == "attacker" and e.attackerOwner', 'server winner→owner mapping matches browser');
needIn(server, 'GameServer.server.luau', '"wonderBuilt"', 'server reads wonder events');
needIn(server, 'GameServer.server.luau', 'state.cities[e.cityId]', 'server resolves the wonder owner via the city');
needIn(server, 'GameServer.server.luau', 'battles = statsBattles, wonders = statsWonders', 'server pushes both on {t=stats}');

// the client carries + renders them
needIn(clientState, 'ClientState.luau', 'msg.battles or {}', 'ClientState forwards battles');
needIn(clientState, 'ClientState.luau', 'msg.wonders or {}', 'ClientState forwards wonders');
needIn(client, 'Statistics.client.luau', 'lastBattles', 'client stores battles');
needIn(client, 'Statistics.client.luau', 'lastWonders', 'client stores wonders');
needIn(client, 'Statistics.client.luau', '🏛 Wonders', 'client renders the wonders timeline');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log('stats-timeline-parity: GameServer battles/wonders accumulation mirrors stats-data.js + pushed + client renders');
