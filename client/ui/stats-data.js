// A73-STATS: the statistics-page DATA layer. A fast, render-free sandbox replay
// of the recording (the same stepEntry contract as A47's theater and
// tools/replay.js) that collects, per game turn, each civ's score / cities /
// population / techs — plus battles won-lost, the wonders timeline, the age
// markers, and each civ's death turn. PURE and DOM-free (engine deps injected),
// so it unit-tests headless; stats.js renders the charts from what this returns.
// Golden-safe: reads the recording + the events the engine already emits.

// deps: { engine (createEngine result), runAiTurn, deepClone, score, ruleset }
export function collectStats(rec, deps) {
  const { engine, runAiTurn, deepClone, score, ruleset } = deps;
  let state = deepClone(rec.initialState);
  const order = state.playerOrder;

  const series = {};
  const battles = {};
  for (const pid of order) {
    series[pid] = {
      name: state.players[pid].name, color: state.players[pid].color,
      score: [], cities: [], pop: [], techs: [], deathTurn: undefined
    };
    battles[pid] = { won: 0, lost: 0 };
  }
  const wonders = []; // { turn, pid, wonder }
  const ages = [];    // { turn, age }
  const rounds = [];  // the turn at each snapshot

  // one log entry → its events; cmd re-applies, round re-derives the AI chain
  // (identical to A47/tools/replay.js so the sandbox tracks the recorded game)
  function stepEntry(entry) {
    if (entry.t === 'cmd') {
      const res = engine.applyCommand(state, entry.cmd);
      if (res.ok) state = res.state;
      return res.ok ? res.events : [];
    }
    if (entry.t === 'round') {
      const events = [];
      const first = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
      if (!first.ok) return events;
      state = first.state;
      for (const e of first.events) events.push(e);
      let guard = 20;
      while (!state.gameOver && !state.players[state.activePlayer].human && guard-- > 0) {
        state = runAiTurn(engine, state, state.activePlayer, ruleset, events);
        const res = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
        if (!res.ok) break;
        state = res.state;
        for (const e of res.events) events.push(e);
      }
      return events;
    }
    return [];
  }

  function absorb(events) {
    for (const e of events) {
      if (e.type === 'combatResolved') {
        const winOwner = e.winner === 'attacker' ? e.attackerOwner : e.defenderOwner;
        const loseOwner = e.winner === 'attacker' ? e.defenderOwner : e.attackerOwner;
        if (battles[winOwner]) battles[winOwner].won += 1;
        if (battles[loseOwner]) battles[loseOwner].lost += 1;
      } else if (e.type === 'wonderBuilt') {
        const home = state.cities[e.cityId];
        wonders.push({ turn: state.turn, pid: home ? home.owner : null, wonder: e.wonder });
      } else if (e.type === 'ageChanged') {
        ages.push({ turn: e.turn !== undefined ? e.turn : state.turn, age: e.age });
      } else if (e.type === 'playerDefeated') {
        if (series[e.playerId]) series[e.playerId].deathTurn = state.turn;
      }
    }
  }

  function snapshot() {
    rounds.push(state.turn);
    for (const pid of order) {
      let cities = 0, pop = 0;
      for (const cid of state.cityOrder) {
        const c = state.cities[cid];
        if (c && c.owner === pid) { cities += 1; pop += c.pop; }
      }
      const s = series[pid];
      s.score.push(score(state, pid, ruleset));
      s.cities.push(cities);
      s.pop.push(pop);
      s.techs.push(state.players[pid].techs.length);
    }
  }

  snapshot(); // the opening position
  for (const entry of rec.log) {
    absorb(stepEntry(entry));
    if (entry.t === 'round') snapshot();
  }
  return { rounds, series, battles, wonders, ages, playerOrder: order.slice() };
}
