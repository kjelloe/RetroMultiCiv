#!/usr/bin/env node
// check.sh gate 29 (MP4 regent narration): the seat owner's turn log narrates
// what the armed regent did — the browser turnlog.js regentTurn audit line
// ("🤖 regent played your turn: N moves · research → …"). The Roblox port must
// (a) have the GameServer emit the same tally on the synthetic regentTurn event
// (byType/research/production), and (b) narrate the same bits, own-seat only.
// String-scan both sides; a dropped bit / missing tally field fails.
import { readFileSync } from 'node:fs';

const U = (p) => new URL(p, import.meta.url);
const browser = readFileSync(U('../../client/ui/turnlog.js'), 'utf8');
const server = readFileSync(U('../src/server/GameServer.server.luau'), 'utf8');
const client = readFileSync(U('../src/client/TurnLog.client.luau'), 'utf8');

const errs = [];
const need = (src, label, frag, why) => {
  if (!src.includes(frag)) errs.push(`missing in ${label}: ${JSON.stringify(frag)} (${why})`);
};

// browser contract (a reword there = re-port the roblox side)
need(browser, 'turnlog.js', '🤖 regent played your turn', 'browser regent audit headline');
need(browser, 'turnlog.js', 'nothing to do', 'browser empty-turn tail');
need(browser, 'turnlog.js', 'e.byType', 'browser reads the command tally');
need(browser, 'turnlog.js', 'research → ', 'browser research bit');
need(browser, 'turnlog.js', 'production → ', 'browser production bit');

// GameServer emits the tally on the synthetic (never-hashed, never-recorded) event
need(server, 'GameServer.server.luau', 'byType[cmd.type] = (byType[cmd.type] or 0) + 1', 'server tallies command types');
need(server, 'GameServer.server.luau', 'research = cmd.tech', 'server captures the research set');
need(server, 'GameServer.server.luau', 'table.insert(production, cmd.item.id)', 'server captures production set');
need(server, 'GameServer.server.luau', 'byType = byType, research = research, production = production', 'server attaches the tally to regentTurn');

// the seat owner's turn log narrates the same bits, own-seat only
need(client, 'TurnLog.client.luau', 'e.type == "regentTurn"', 'client narrates regentTurn');
need(client, 'TurnLog.client.luau', 'e.playerId ~= you', 'own-seat-only guard');
need(client, 'TurnLog.client.luau', '🤖 regent played your turn', 'client headline mirrors browser');
need(client, 'TurnLog.client.luau', 'nothing to do', 'client empty-turn tail');
need(client, 'TurnLog.client.luau', 'research → ', 'client research bit');
need(client, 'TurnLog.client.luau', 'production → ', 'client production bit');

if (errs.length > 0) {
  for (const e of errs) console.error(e);
  process.exit(1);
}
console.log('regent-narration-parity: GameServer tallies the regent turn + TurnLog narrates it (turnlog.js twin)');
