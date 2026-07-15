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
    return Promise.resolve({ initialState: d.initialState, log: d.log, finalHash: d.finalHash });
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
    return { replayHash: hashState(state), recordedHash: rec.finalHash, majors };
  }

  let theater = null;
  function omniscient(state) { return filterView(state, 'spectator'); } // players.spectator===undefined → all revealed

  async function open() {
    if (theater) return;
    const rec = await getRecording();
    // animations off during playback (render-time only, so it's free); restore
    const priorReduce = ctx.options && ctx.options.get('reduceAnimation');
    if (renderer.setReduceAnimation) renderer.setReduceAnimation(true);

    const panel = document.createElement('div');
    panel.id = 'replay-theater';
    panel.innerHTML = `
      <div id="replay-bar">
        <button id="replay-restart" title="Back to start">⏮ Start</button>
        <button id="replay-playpause">⏸ Pause</button>
        <label>Replay speed <input id="replay-tempo" type="range" min="1" max="50" value="4"> <span id="replay-tempo-n">4</span>/s</label>
        <span id="replay-turn"></span>
        <button id="replay-close">✕ Close</button>
      </div>
      <div id="replay-feed"></div>`;
    document.body.appendChild(panel);

    let state = deepClone(rec.initialState);
    let idx = 0;
    let playing = true;
    let tempo = 4;
    const feed = panel.querySelector('#replay-feed');
    const turnLabel = panel.querySelector('#replay-turn');
    renderer.setViewState(omniscient(state));
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
        for (const m of majorEvents(r.events, state, ruleset)) addFeed(m);
        if (entry.t === 'round') sawRound = true;
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
        renderer.setViewState(omniscient(state));
        const year = state.year < 0 ? `${-state.year} BC` : `${state.year} AD`;
        turnLabel.textContent = `turn ${state.turn} · ${year}`;
        if (idx >= rec.log.length) {
          playing = false;
          panel.querySelector('#replay-playpause').textContent = '⏵ Play';
          // the verifier's verdict, shown honestly
          const ok = hashState(state) === rec.finalHash;
          turnLabel.textContent += ok ? ' · ✅ replay verified' : ' · ⚠ replay diverged';
          panel.dataset.verified = ok ? '1' : '0';
        }
      }
      requestAnimationFrame(loop);
    }

    // re-seed the sandbox from turn 0 — the machinery already rebuilds from
    // initialState, so this is a re-invoke, not new plumbing (⏮ + auto-loop)
    function restart() {
      state = deepClone(rec.initialState);
      idx = 0;
      acc = 0; last = performance.now();
      feed.textContent = '';
      playing = true;
      panel.querySelector('#replay-playpause').textContent = '⏸ Pause';
      delete panel.dataset.verified;
      renderer.setViewState(omniscient(state));
      turnLabel.textContent = `turn ${state.turn}`;
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
