// A47 post-game replay theater: after gameOver, re-run the whole game from
// turn 0 as a GLOBAL spectator. Everything rides trusted machinery — the
// in-memory recording (initial state + every command) re-applied through the
// REAL engine in a SANDBOX instance (never touches the finished session), and
// rendered omnisciently. Zero engine changes. The theater doubles as a
// replay-verifier: after playback the replayed final hash must equal the
// recording's — a visible tamper check (assert()ed in the browser case).
import { createEngine, deepClone } from '../../engine/index.js';
import { runAiTurn } from '../../engine/ai.js';
import { hashState } from '../../shared/statehash.js';
import { filterView } from '../../engine/visibility.js';
import { majorEvents } from './replay-events.js';

export function initReplay(ctx) {
  const { session, renderer } = ctx;
  const ruleset = session.ruleset;
  const engine = createEngine(ruleset);

  // "⏵ Watch the replay" — surfaced on gameOver (hidden otherwise)
  const btn = document.createElement('button');
  btn.id = 'replay-btn';
  btn.className = 'hidden';
  btn.textContent = '⏵ Watch the replay';
  document.body.appendChild(btn);
  session.onChange(() => btn.classList.toggle('hidden', session.state.gameOver !== true));
  btn.classList.toggle('hidden', session.state.gameOver !== true);

  // The recording source: local session holds it in memory; a server game
  // owns it and answers {t:'fullLog'} only post-gameOver. Both give
  // { initialState, log, finalHash }.
  function getRecording() {
    if (session.requestFullLog) return session.requestFullLog();
    const d = session.exportDiagnostics();
    return Promise.resolve({ initialState: d.initialState, log: d.log, finalHash: d.finalHash,
      format: d.format, version: d.version });
  }

  // A87 (c): a recording we know how to replay. Server recordings arrive with
  // no envelope (trusted, current); a LOCAL recording carrying a format must
  // match the version the theater speaks, else "format unsupported".
  const SUPPORTED = { format: 'retromulticiv-diagnostics', version: 1 };
  function recordingSupported(rec) {
    if (rec.format === undefined) return true;
    return rec.format === SUPPORTED.format && rec.version === SUPPORTED.version;
  }
  // A87 (c): the FIRST recorded entry whose replayed hash disagrees (the
  // divergence index the verifier already computes), or null. cmd entries carry
  // a hash only under ?debug=1; round entries always do (client/session.js).
  function firstDivergence(rec) {
    let state = deepClone(rec.initialState);
    let applied = 0;
    for (const entry of rec.log) {
      state = stepEntry(state, entry).state;
      applied++;
      if (entry.hash !== undefined && hashState(state) !== entry.hash) return applied;
    }
    return null;
  }

  // Apply ONE log entry to the sandbox, returning its events. cmd = a human/
  // regent command (re-applied); round = an AI chain (re-derived), same rules
  // as tools/replay.js so the sandbox tracks the recorded game exactly.
  function stepEntry(state, entry) {
    if (entry.t === 'cmd') {
      const res = engine.applyCommand(state, entry.cmd);
      return { state: res.ok ? res.state : state, events: res.ok ? res.events : [] };
    }
    if (entry.t === 'round') {
      const events = [];
      const first = engine.applyCommand(state, { type: 'endTurn', playerId: state.activePlayer });
      if (!first.ok) return { state, events };
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
      return { state, events };
    }
    return { state, events: [] }; // airound etc. (not in client/server recordings)
  }

  // Replay the WHOLE recording with no rendering — the verifier. Returns the
  // reproduced final hash, the recorded one, and the collected major events.
  function verifyReplay(rec) {
    let state = deepClone(rec.initialState);
    const majors = [];
    for (const entry of rec.log) {
      const r = stepEntry(state, entry);
      state = r.state;
      for (const m of majorEvents(r.events, state, ruleset)) majors.push(m);
    }
    return { replayHash: hashState(state), recordedHash: rec.finalHash, majors,
      divergedAt: firstDivergence(rec) };
  }

  let theater = null;
  // A87 (b): 'spectator' = omniscient (players.spectator===undefined → all
  // revealed); a real playerId = that civ's fog-of-war eyes (filterView).

  async function open() {
    if (theater) return;
    const rec = await getRecording();
    // A87 (c): a recording from a newer/foreign format can't be replayed
    // honestly — say so plainly instead of playing something wrong.
    if (!recordingSupported(rec)) {
      const warn = document.createElement('div');
      warn.id = 'replay-theater';
      warn.innerHTML = `<div id="replay-bar"><span id="replay-turn">⚠ Replay format unsupported`
        + ` — this recording was made by a different version.</span>`
        + `<button id="replay-close">✕ Close</button></div>`;
      document.body.appendChild(warn);
      theater = { panel: warn, close: () => { warn.remove(); theater = null; } };
      warn.querySelector('#replay-close').addEventListener('click', theater.close);
      return;
    }
    // animations off during playback (render-time only, so it's free); restore
    const priorReduce = ctx.options && ctx.options.get('reduceAnimation');
    if (renderer.setReduceAnimation) renderer.setReduceAnimation(true);

    const totalRounds = rec.log.reduce((n, e) => n + (e.t === 'round' ? 1 : 0), 0);
    const panel = document.createElement('div');
    panel.id = 'replay-theater';
    panel.innerHTML = `
      <div id="replay-bar">
        <button id="replay-restart" title="Back to start">⏮ Start</button>
        <button id="replay-playpause">⏸ Pause</button>
        <label>Speed <input id="replay-tempo" type="range" min="1" max="50" value="4"> <span id="replay-tempo-n">4</span>/s</label>
        <label>Jump <input id="replay-scrub" type="range" min="0" max="${totalRounds}" value="0" title="jump to a turn"></label>
        <label>View <select id="replay-view" title="whose eyes"></select></label>
        <span id="replay-turn"></span>
        <button id="replay-close">✕ Close</button>
      </div>
      <div id="replay-feed"></div>`;
    document.body.appendChild(panel);

    let state = deepClone(rec.initialState);
    let idx = 0;
    let applied = 0;         // A87 (c): entries applied — the "command N" index
    let divergedAt = null;   // first entry whose replayed hash disagreed
    let roundsDone = 0;      // A87 (a): rounds applied — the scrubber position
    let perspective = 'spectator'; // A87 (b): 'spectator' (omniscient) | a playerId
    let playing = true;
    let tempo = 4;
    const feed = panel.querySelector('#replay-feed');
    const turnLabel = panel.querySelector('#replay-turn');
    const scrubEl = panel.querySelector('#replay-scrub');
    const viewFor = s => filterView(s, perspective);

    // A87 (b): the view dropdown — omniscient plus each civ in the game
    const viewEl = panel.querySelector('#replay-view');
    viewEl.innerHTML = '<option value="spectator">🌍 Omniscient</option>'
      + (rec.initialState.playerOrder || []).map(pid => {
        const p = rec.initialState.players[pid];
        const civ = p.civ && ruleset.civs[p.civ] ? ruleset.civs[p.civ].name : (p.name || pid);
        return `<option value="${pid}">👁 ${civ}</option>`;
      }).join('');

    renderer.setViewState(viewFor(state));
    renderer.centerOn(Math.floor(state.map.width / 2), Math.floor(state.map.height / 2));

    function addFeed(m) {
      const year = state.year < 0 ? `${-state.year} BC` : `${state.year} AD`;
      const div = document.createElement('div');
      div.className = 'replay-line';
      div.textContent = `T${state.turn} · ${year} · ${m.icon} ${m.text}`;
      if (m.loc) {
        div.classList.add('has-loc');
        div.addEventListener('click', () => renderer.centerOn(m.loc.x, m.loc.y));
      }
      feed.appendChild(div);
      while (feed.children.length > 200) feed.removeChild(feed.firstChild);
      feed.scrollTop = feed.scrollHeight;
    }

    // one "step" = advance to the next round boundary (a turn) so tempo reads
    // as turns/second; cmd entries within a turn apply without their own render
    function stepTurn() {
      let sawRound = false;
      while (idx < rec.log.length && !sawRound) {
        const entry = rec.log[idx++];
        const r = stepEntry(state, entry);
        state = r.state;
        applied++;
        if (divergedAt === null && entry.hash !== undefined && hashState(state) !== entry.hash) divergedAt = applied;
        for (const m of majorEvents(r.events, state, ruleset)) addFeed(m);
        if (entry.t === 'round') { sawRound = true; roundsDone++; }
      }
    }

    let acc = 0, last = performance.now();
    function loop(now) {
      if (!theater) return;
      const dt = (now - last) / 1000; last = now;
      if (playing && idx < rec.log.length) {
        acc += dt * tempo;
        let budget = 200; // apply-throttle: batch turns per frame above ~5/s, render once
        while (acc >= 1 && idx < rec.log.length && budget-- > 0) { stepTurn(); acc -= 1; }
        renderer.setViewState(viewFor(state));
        scrubEl.value = String(roundsDone); // A87 (a): the scrubber tracks playback
        const year = state.year < 0 ? `${-state.year} BC` : `${state.year} AD`;
        turnLabel.textContent = `turn ${state.turn} · ${year}`;
        if (idx >= rec.log.length) {
          playing = false;
          panel.querySelector('#replay-playpause').textContent = '⏵ Play';
          // A87 (c): the verifier's verdict in human terms
          if (divergedAt !== null) {
            turnLabel.textContent += ` · ❌ Mismatch at command ${divergedAt}`;
            panel.dataset.verified = '0';
          } else if (hashState(state) === rec.finalHash) {
            turnLabel.textContent += ' · ✅ Verified';
            panel.dataset.verified = '1';
          } else {
            // final hashes differ but no per-entry hash pinned where (a recording
            // without per-command hashes) — still honest, just less precise
            turnLabel.textContent += ' · ⚠ replay diverged';
            panel.dataset.verified = '0';
          }
        }
      }
      requestAnimationFrame(loop);
    }

    // re-seed the sandbox from turn 0 — the machinery already rebuilds from
    // initialState, so this is a re-invoke, not new plumbing (⏮ + auto-loop)
    function restart() {
      state = deepClone(rec.initialState);
      idx = 0;
      applied = 0; divergedAt = null; roundsDone = 0;
      acc = 0; last = performance.now();
      feed.textContent = '';
      scrubEl.value = '0';
      playing = true;
      panel.querySelector('#replay-playpause').textContent = '⏸ Pause';
      delete panel.dataset.verified;
      renderer.setViewState(viewFor(state));
      turnLabel.textContent = `turn ${state.turn}`;
    }

    // A87 (a): jump to round N — re-apply from turn 0 to that boundary (the
    // sandbox rebuilds from initialState; no per-step render, one at the end).
    function scrubTo(target) {
      state = deepClone(rec.initialState);
      idx = 0; applied = 0; divergedAt = null; roundsDone = 0;
      feed.textContent = '';
      while (idx < rec.log.length && roundsDone < target) stepTurn();
      renderer.setViewState(viewFor(state));
      const year = state.year < 0 ? `${-state.year} BC` : `${state.year} AD`;
      turnLabel.textContent = `turn ${state.turn} · ${year}`;
      delete panel.dataset.verified;
    }

    panel.querySelector('#replay-restart').addEventListener('click', restart);
    panel.querySelector('#replay-playpause').addEventListener('click', e => {
      if (idx >= rec.log.length) { restart(); return; } // ⏵ at the end replays
      playing = !playing;
      e.target.textContent = playing ? '⏸ Pause' : '⏵ Play';
    });
    const tempoEl = panel.querySelector('#replay-tempo');
    tempoEl.addEventListener('input', () => {
      tempo = parseInt(tempoEl.value, 10);
      panel.querySelector('#replay-tempo-n').textContent = String(tempo);
    });
    // A87 (a): drag to jump — pause and re-derive to that turn on release
    scrubEl.addEventListener('change', () => {
      playing = false;
      panel.querySelector('#replay-playpause').textContent = '⏵ Play';
      scrubTo(parseInt(scrubEl.value, 10));
    });
    // A87 (b): switch whose eyes we watch through — re-render the current state
    viewEl.addEventListener('change', () => {
      perspective = viewEl.value;
      renderer.setViewState(viewFor(state));
    });
    panel.querySelector('#replay-close').addEventListener('click', close);

    theater = { panel };
    requestAnimationFrame(loop);

    function close() {
      if (!theater) return;
      panel.remove();
      theater = null;
      if (renderer.setReduceAnimation) renderer.setReduceAnimation(priorReduce === true);
      renderer.setViewState(filterView(session.state, ctx.HUMAN)); // back to the final game view
    }
    theater.close = close;
  }

  btn.addEventListener('click', open);

  return { open, verifyReplay, getRecording };
}
