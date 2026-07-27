// Regenerates the gitignored B13 witness (debugging/logs/retromulticiv-witness-b13.json):
// an all-AI 4-civ 40x25 recording via the exported sim-driver runSim({rulesOverrides:{contentCitizens:6},chaos:false}), wrapped in the client save-with-embedded-diag envelope so it replays clean through the CURRENT engine (clean-by-construction: gen + replay share initialState + rulesOverrides).
//
// Usage: node debugging/gen-witness-b13.js <outPath> [seed] [turns]
const path = require('path');
const fs = require('fs');
const REPO = path.resolve(__dirname, '..');
const { runSim, loadModules } = require(path.join(REPO, 'test/sim-driver.js'));

const outPath = process.argv[2];
if (!outPath) { console.error('need outPath'); process.exit(2); }
const seed = process.argv[3] !== undefined ? Number(process.argv[3]) : 424242;
const turns = process.argv[4] !== undefined ? Number(process.argv[4]) : 130;
const RULES_OVERRIDES = { contentCitizens: 6 };

(async () => {
  const mods = await loadModules();
  let res;
  try {
    res = await runSim({
      seed, civs: 4, width: 40, height: 25, turns,
      rulesOverrides: RULES_OVERRIDES,
      chaos: false,            // witness log is pure airound (no chaos entries)
      artifactsDir: false,     // don't spill sim/ artifacts
      checkEvery: 1, hashEvery: 10,
    });
  } catch (e) {
    console.error(`runSim threw at seed ${seed} turn ${e.turn}: ${(e.problems||[]).slice(0,3).join(' | ') || e.message}`);
    process.exit(3);
  }
  const { state, roundLog, initialState } = res;
  const save = {
    format: 'retromulticiv-save',
    savedAt: '2026-07-26T00:00:00.000Z',
    turn: state.turn,
    state,
    diag: { initialState, log: roundLog, rulesOverrides: RULES_OVERRIDES },
  };
  fs.writeFileSync(outPath, JSON.stringify(save));
  let hash = '(n/a)';
  try { hash = String(mods.hashState(state)); } catch (_) {}  // hashState already returns a 0x-prefixed hex string
  console.error(`WROTE ${outPath}  seed=${seed} turns=${turns} finalTurn=${state.turn} logEntries=${roundLog.length} finalHash=${hash}`);
})();
