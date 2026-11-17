#!/usr/bin/env node
// One report after a Studio run (specs/roblox-parity-plan.md step 0.2):
// diagnostics, the UI tour's stops, refused commands by reason, seconds per
// turn, and the acceptance replay verdict.
//
//   node roblox/tools/after-run.js               newest session, with the replay
//   node roblox/tools/after-run.js --no-replay   skip the replay (long games take minutes)
//   node roblox/tools/after-run.js --session 2   the 2nd-newest session
//   node roblox/tools/after-run.js --from FILE   a saved Output file instead of the Studio log
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// text of a saved session -> the report's figures (pure; pinned by
// roblox/selftest/after-run.mjs)
function analyse(text) {
  const lines = text.split('\n');
  const r = {
    init: null, lastTurn: 0, final: null, commands: 0, refused: 0, refusedBy: {}, refusedByType: {},
    clientRejects: 0, notSent: 0, diagFail: [], warnings: 0, errors: 0,
    tour: [], tourDone: null, tourAbort: null, tourRuns: 0, turnTimes: [], regent: [], endscreen: null, badges: [],
  };
  const stamp = {};
  for (const line of lines) {
    const m = /^\s*(\d\d):(\d\d):(\d\d)\.(\d{3})\s+(.*)$/.exec(line);
    const msg = m ? m[5] : line.trim();
    const t = m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000 : null;
    let x;
    if (msg.startsWith('[R4INIT]')) { r.init = msg.slice(9); r.final = null; r.endscreen = null; r.badges = []; } // a final line above the game start is the previous Play's
   
    else if ((x = /^\[R4CODE\] turn=(\d+)/.exec(msg))) {
      r.lastTurn = Math.max(r.lastTurn, +x[1]);
      if (t !== null) stamp[+x[1]] = t;
    } else if (msg.startsWith('[R4FINAL]')) r.final = msg.slice(10);
    else if (msg.startsWith('[R4LOG] ')) {
      let e = null;
      try { e = JSON.parse(msg.slice(8)); } catch (err) { /* not an entry */ }
      if (e && e.t === 'cmd') {
        r.commands += 1;
        if (e.ok === false) {
          r.refused += 1;
          r.refusedBy[e.reason] = (r.refusedBy[e.reason] || 0) + 1;
          const type = (e.cmd && e.cmd.type) || '?';
          r.refusedByType[type] = (r.refusedByType[type] || 0) + 1;
        }
      }
    } else if (msg.includes('[RMC-DIAG] FAIL')) r.diagFail.push(msg.replace(/^.*\[RMC-DIAG\] FAIL /, ''));
    else if (msg.startsWith('[DebugMenu] UI tour started')) {
      // several tours in one session: the report is about the last one
      r.tourRuns += 1; r.tour = []; r.tourDone = null; r.tourAbort = null;
    } else if (msg.startsWith('[RMC-TOUR] DONE')) r.tourDone = msg.slice(11);
    else if (msg.startsWith('[RMC-TOUR] ABORT')) r.tourAbort = msg.slice(11);
    else if ((x = /^\[RMC-TOUR\] (\d\d)\/(\d\d) (\S+) (PASS|FAIL|SKIP)(.*)$/.exec(msg))) {
      r.tour.push({ id: x[3], verdict: x[4], detail: x[5].trim() });
    } else if (msg.startsWith('[Client] rejected')) r.clientRejects += 1;
    else if (msg.includes('not sent')) r.notSent += 1;
    else if ((x = /^\[Client\] AI regency (ON|OFF)/.exec(msg))) r.regent.push(x[1]);
    else if (msg.startsWith('[SO7] endscreen sent')) r.endscreen = msg.slice(22);
    else if ((x = /^\[RMC-BADGE\] earned (\S+)/.exec(msg))) r.badges.push(x[1]);
  }
  // seconds per turn over four equal spans of the turns that carry a time stamp
  const turns = Object.keys(stamp).map(Number).sort((a, b) => a - b);
  if (turns.length >= 8) {
    const q = Math.floor(turns.length / 4);
    for (let i = 0; i < 4; i++) {
      const a = turns[i * q], b = turns[i === 3 ? turns.length - 1 : (i + 1) * q];
      let dt = stamp[b] - stamp[a];
      if (dt < 0) dt += 86400; // the run crossed midnight
      if (b > a) r.turnTimes.push({ from: a, to: b, secs: Math.round((dt / (b - a)) * 100) / 100 });
    }
  }
  return r;
}

function render(r, extra) {
  const out = [];
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
  out.push('== run report ==');
  if (extra.session) out.push(extra.session);
  out.push(r.init ? `game: ${r.init}` : 'game: none started');
  if (r.lastTurn > 0) out.push(`turns: ${r.lastTurn}${r.endscreen ? ` (ended: ${r.endscreen})` : ' (not finished)'}${r.final ? `, final ${r.final}` : ''}`);
  out.push(`diagnostics: ${r.diagFail.length} FAIL`);
  for (const f of r.diagFail) out.push(`  FAIL ${f}`);
  if (r.tour.length === 0 && !r.tourAbort) out.push('tour: not run (Debug menu > Run UI tour)');
  else {
    out.push(`tour${r.tourRuns > 1 ? ` (last of ${r.tourRuns} runs)` : ''}: ${r.tourDone || r.tourAbort || 'started, no DONE line (interrupted?)'}`);
    for (const s of r.tour) if (s.verdict !== 'PASS') out.push(`  ${s.verdict} ${s.id} ${s.detail}`);
  }
  if (r.commands > 0) {
    const pct = Math.round((r.refused * 1000) / r.commands) / 10;
    out.push(`commands: ${r.commands} logged, ${r.refused} refused by the engine (${pct} %)${r.refused ? ' - ' + top(r.refusedBy) : ''}`);
    if (r.refused) out.push(`  refused by type: ${top(r.refusedByType)}`);
  }
  out.push(`client: ${r.clientRejects} rejected line(s), ${r.notSent} not sent while the regent held the seat, regency ${r.regent.join(' > ') || 'never on'}`);
  if (r.turnTimes.length) out.push('seconds per turn: ' + r.turnTimes.map(t => `${t.secs} (turns ${t.from}-${t.to})`).join(', '));
  if (r.init) out.push(`badges: ${r.badges.length} earned${r.badges.length ? ' - ' + r.badges.join(', ') : ''}`);
  if (extra.replay) out.push(`replay: ${extra.replay}`);
  return out.join('\n');
}

module.exports = { analyse, render };

if (require.main === module) {
  const args = process.argv.slice(2);
  const arg = name => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
  const here = __dirname;
  let file = arg('--from');
  let session = null;
  if (!file) {
    file = path.join(os.tmpdir(), `rmc-after-run-${process.pid}.txt`);
    const a = [path.join(here, 'studio-log.js'), '--save', file];
    if (arg('--session')) a.push('--session', arg('--session'));
    const res = spawnSync('node', a, { encoding: 'utf8' });
    if (res.status !== 0 || !fs.existsSync(file)) {
      console.error('after-run: could not read the Studio log\n' + (res.stderr || res.stdout));
      process.exit(1);
    }
    const sum = spawnSync('node', [path.join(here, 'studio-log.js'), '--diag', ...(arg('--session') ? ['--session', arg('--session')] : [])], { encoding: 'utf8' });
    session = (sum.stdout || '').trim().split('\n').filter(l => l.startsWith('session ')).pop() || null;
  }
  const r = analyse(fs.readFileSync(file, 'utf8'));
  let replay = null;
  if (!args.includes('--no-replay') && r.init) {
    const res = spawnSync('node', [path.join(here, '..', 'acceptance', 'assemble.js'), file], { encoding: 'utf8', maxBuffer: 1 << 28 });
    const tail = ((res.stdout || '') + (res.stderr || '')).trim().split('\n');
    replay = tail.filter(l => /ACCEPTANCE|MISMATCH|diverg/i.test(l)).pop() || tail.pop() || 'no output';
  } else if (r.init) replay = 'skipped (--no-replay)';
  console.log(render(r, { session, replay }));
  if (!arg('--from')) fs.unlinkSync(file);
}
