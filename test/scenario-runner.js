// Engine-agnostic scenario runner. Scenarios are plain JSON (test/scenarios/)
// so the SAME files verify the Node engine now and the Luau engine in phase 5
// (this runner gets a mechanical Luau port; scenarios and hashes are shared).
//
// Scenario format:
// {
//   "name": "...",
//   "setup": { "state": {...} }              // inline initial state, OR
//            { "seed": 42, "options": {...} } // engine.createGame(setup)
//   "script": [
//     { "cmd": { "type": "moveUnit", ... },
//       "expect": {                       // all fields optional
//         "ok": true|false,               // command accepted?
//         "state": { "units.u1.x": 6 }    // dotted-path assertions after step
//       } }
//   ],
//   "final": {                            // optional, checked after the script
//     "state": { "turn": 2 },
//     "hash": "0x…"                       // golden state hash; null = print it
//   }
// }
//
// Engine adapter contract:
//   createGame(setup) -> state
//   applyCommand(state, cmd) -> { state, ok, reason?, events }
const { hashState } = require('../shared/statehash.js');

function getPath(obj, dotted) {
  let cur = obj;
  for (const key of dotted.split('.')) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[key];
  }
  return cur;
}

function checkPaths(state, expected, label, failures) {
  for (const [p, want] of Object.entries(expected)) {
    const got = getPath(state, p);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      failures.push(`${label}: ${p} = ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    }
  }
}

function runScenario(engine, scenario) {
  const failures = [];
  let state = scenario.setup.state
    ? JSON.parse(JSON.stringify(scenario.setup.state))
    : engine.createGame(scenario.setup);

  (scenario.script || []).forEach((step, i) => {
    const label = `step ${i} (${step.cmd.type})`;
    const res = engine.applyCommand(state, step.cmd);
    if (res.state !== undefined) state = res.state;
    const exp = step.expect || {};
    if (exp.ok !== undefined && res.ok !== exp.ok) {
      failures.push(`${label}: ok=${res.ok}${res.reason ? ` (${res.reason})` : ''}, expected ok=${exp.ok}`);
    }
    if (exp.state) checkPaths(state, exp.state, label, failures);
  });

  if (scenario.final) {
    if (scenario.final.state) checkPaths(state, scenario.final.state, 'final', failures);
    if ('hash' in scenario.final) {
      const h = hashState(state);
      if (scenario.final.hash === null) {
        console.log(`[scenario "${scenario.name}"] record final hash: ${h}`);
      } else if (h !== scenario.final.hash) {
        failures.push(`final hash ${h}, expected ${scenario.final.hash}`);
      }
    }
  }

  return { pass: failures.length === 0, failures, state };
}

module.exports = { runScenario, getPath };
