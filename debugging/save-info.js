// Summarize a save/recording/state file: format, turn/year, players, map,
// canonical state hash, and the game verification code — the first look at
// any file a playtest report hands over (before deciding to replay).
//   node debugging/save-info.js <file.json>   (or: bash debugging/info.sh <file>)
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('usage: node debugging/save-info.js <file.json>'); process.exit(2); }

async function main() {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const state = raw.state !== undefined ? raw.state : raw;
  const kind = raw.format !== undefined ? raw.format
    : raw.diag !== undefined || raw.entries !== undefined ? 'diagnostics'
    : state.turn !== undefined ? 'bare state' : 'unknown';
  console.log(`file:    ${path.basename(file)}  (${kind}${raw.gameId ? `, game ${raw.gameId}` : ''})`);
  if (state.turn === undefined) { console.log('no state payload found'); return; }
  const yr = state.year < 0 ? `${-state.year} BC` : `${state.year} AD`;
  console.log(`turn:    ${state.turn} · ${yr} · active ${state.activePlayer}`
    + (state.gameOver ? ` · GAME OVER (winner ${state.winner})` : ''));
  console.log(`map:     ${state.map.width}×${state.map.height}`);
  for (const pid of state.playerOrder || Object.keys(state.players)) {
    const p = state.players[pid];
    if (!p) continue;
    const cities = Object.values(state.cities || {}).filter(c => c.owner === pid).length;
    const units = Object.values(state.units || {}).filter(u => u.owner === pid).length;
    console.log(`  ${pid}  ${String(p.name).padEnd(14)} ${(p.civ || '-').padEnd(12)}`
      + `${p.human ? 'human' : 'AI   '} · ${cities}c ${units}u ${((p.techs && p.techs.length) || 0)}t`
      + `${p.alive === false ? ' · DEAD' : ''}`);
  }
  const { hashState } = await import('../shared/statehash.js');
  const { gameCode } = await import('../shared/gamecode.js');
  console.log(`hash:    ${hashState(state)}`);
  console.log(`code:    ${gameCode(state)}`);
}

main().catch(e => { console.error(`not a readable save: ${e.message}`); process.exit(1); });
