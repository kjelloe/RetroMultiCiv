// CONCEPT-COVERAGE probe (user request 2026-07-26): which game mechanics does
// the AI actually exercise in simulated runs? Wraps the engine's applyCommand
// to tally COMMAND types issued and EVENT types emitted over full canonical
// games — the definitive used/unused list (every mechanic emits typed events).
//
//   node debugging/probe-concepts.js [seeds=1] [turns=400] [civs=7]
//
// Prints one JSON per seed: {commands: {type: n}, events: {type: n}} plus a
// combined tally. Compare the event keys against test/event-catalog.test.js
// EVENT_TYPES — catalog types NEVER emitted are the unused-concept list.
const RULESET = require('../test/ruleset.js');

(async () => {
  const ai = await import('../engine/ai.js');
  const { createEngine } = await import('../engine/index.js');
  const seeds = Number(process.argv[2] || 1);
  const turns = Number(process.argv[3] || 400);
  const civs = Number(process.argv[4] || 7);
  const ROSTER = [
    { id: 'p1', name: 'Romans', color: '#3b7dd8', civ: 'romans' },
    { id: 'p2', name: 'Egyptians', color: '#d8b13b', civ: 'egyptians' },
    { id: 'p3', name: 'Greeks', color: '#3bd87d', civ: 'greeks' },
    { id: 'p4', name: 'Zulus', color: '#d84a3b', civ: 'zulus' },
    { id: 'p5', name: 'Babylonians', color: '#8a5ad8', civ: 'babylonians' },
    { id: 'p6', name: 'Chinese', color: '#3bc8d8', civ: 'chinese' },
    { id: 'p7', name: 'Mongols', color: '#d8853b', civ: 'mongols' }
  ];
  const total = { commands: {}, events: {} };
  for (let seed = 1; seed <= seeds; seed++) {
    const base = createEngine(RULESET);
    const tally = { commands: {}, events: {} };
    const engine = Object.assign({}, base, {
      applyCommand(state, cmd) {
        tally.commands[cmd.type] = (tally.commands[cmd.type] || 0) + 1;
        const r = base.applyCommand(state, cmd);
        if (r.ok && r.events) {
          for (const e of r.events) tally.events[e.type] = (tally.events[e.type] || 0) + 1;
        }
        return r;
      }
    });
    const players = ROSTER.slice(0, civs).map(p => ({ id: p.id, name: p.name, color: p.color, human: false, civ: p.civ }));
    let state = engine.createGame({ seed, options: { width: 80, height: 50, players } });
    for (let round = 0; round < turns && !state.gameOver; round++) {
      for (const pid of state.playerOrder) {
        if (state.gameOver) break;
        if (state.players[pid] && state.players[pid].alive === false) {
          const r = engine.applyCommand(state, { type: 'endTurn', playerId: pid });
          if (r.ok) state = r.state;
          continue;
        }
        state = ai.runAiTurn(engine, state, pid, RULESET);
        const r = engine.applyCommand(state, { type: 'endTurn', playerId: pid });
        if (r.ok) state = r.state;
      }
    }
    for (const k of Object.keys(tally.commands)) total.commands[k] = (total.commands[k] || 0) + tally.commands[k];
    for (const k of Object.keys(tally.events)) total.events[k] = (total.events[k] || 0) + tally.events[k];
    console.log(JSON.stringify({ seed, finalTurn: state.turn, gameOver: state.gameOver === true, tally }));
  }
  console.log('TOTAL ' + JSON.stringify(total));
  // the unused list: catalog types never emitted
  const { EVENT_TYPES } = require('../test/event-catalog.test.js');
  const unused = Object.keys(EVENT_TYPES).filter(t => !total.events[t]);
  console.log('UNUSED_EVENT_TYPES ' + JSON.stringify(unused));
})();
