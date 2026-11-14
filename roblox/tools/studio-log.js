#!/usr/bin/env node
// Reads Roblox Studio's own log file — Studio mirrors the Output window to
// %LOCALAPPDATA%\Roblox\logs\*_Studio_*_last.log while it runs (script output
// on the FLog::CreatorOutput channel), so a Play Solo is readable from WSL
// with no copy-paste and no Studio setting.
//
//   node roblox/tools/studio-log.js              last play session, [R4LOG] lines elided
//   node roblox/tools/studio-log.js --diag       only [RMC-DIAG] lines, warnings, errors
//   node roblox/tools/studio-log.js --list       one line per play session in the file
//   node roblox/tools/studio-log.js --session 2  the 2nd-newest session (1 = newest)
//   node roblox/tools/studio-log.js --all        keep the [R4LOG] lines
//   node roblox/tools/studio-log.js --grep TEXT  only lines containing TEXT
//   node roblox/tools/studio-log.js --tail N     only the last N lines
//   node roblox/tools/studio-log.js --save roblox/acceptance/runX.txt
//        write the whole session in the Output-window shape assemble.js reads
//   node roblox/tools/studio-log.js --file PATH  a specific log (default: newest
//        Studio log under $RMC_STUDIO_LOGS or /mnt/c/Users/*/AppData/Local/Roblox/logs)
'use strict';
const fs = require('fs');
const path = require('path');

const SESSION_MARK = '=== RetroMultiCiv R1 anchor gate ===';
const DIAG_TAG = '[RMC-DIAG]';
const LINE = /^(\d{4}-\d\d-\d\dT(\d\d:\d\d:\d\d\.\d{3})Z),[\d.]+,[0-9a-f]+,\d+(?:,(\w+))? \[(?:FLog|DFLog)::(\w+)\] ?(.*)$/;
// engine-side lines that are a script failing, whatever channel carries them
const SCRIPT_ERR = /Stack Begin|Stack End|Script '|ServerScriptService\.|StarterPlayerScripts\.|PlayerScripts\.RetroMultiCivClient|attempt to |invalid argument #/;

// text -> [{ ts, time, level, chan, msg }]; untimestamped lines continue the
// previous record (multi-line prints and tracebacks)
function parse(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    const m = LINE.exec(line);
    if (m) {
      out.push({ ts: m[1], time: m[2], level: m[3] || 'Info', chan: m[4], msg: m[5] });
    } else if (out.length > 0 && line !== '') {
      out[out.length - 1].msg += '\n' + line;
    }
  }
  return out;
}

// the records a script produced: its own channel, anything DIAG-tagged, and
// engine error lines that name a script
function isScript(r) {
  if (r.chan === 'CreatorOutput') return true;
  if (r.msg.includes(DIAG_TAG)) return true;
  return (r.level === 'Error' || r.level === 'Warning') && SCRIPT_ERR.test(r.msg);
}

// split at each server boot (the anchor-gate banner); lines printed in the
// 2 s before a banner belong to that boot, anything earlier is dropped
function sessions(records) {
  const script = records.filter(isScript);
  const starts = [];
  script.forEach((r, i) => { if (r.msg.includes(SESSION_MARK)) starts.push(i); });
  const out = [];
  for (let s = 0; s < starts.length; s++) {
    let from = starts[s];
    const t0 = Date.parse(script[from].ts);
    const floor = s > 0 ? starts[s - 1] : -1;
    while (from - 1 > floor && t0 - Date.parse(script[from - 1].ts) <= 2000) from--;
    const to = s + 1 < starts.length ? starts[s + 1] : script.length;
    out.push(script.slice(from, to));
  }
  // the next session's preamble was sliced into this one's tail: trim it
  for (let s = 0; s + 1 < out.length; s++) {
    const nextFirst = out[s + 1][0];
    const cut = out[s].indexOf(nextFirst);
    if (cut >= 0) out[s] = out[s].slice(0, cut);
  }
  return out;
}

function isDiag(r) {
  return r.msg.includes(DIAG_TAG) || r.level === 'Warning' || r.level === 'Error';
}

function format(r) {
  const lvl = r.level === 'Info' ? ' ' : r.level === 'Warning' ? 'W' : r.level === 'Error' ? 'E' : '?';
  return `${r.time} ${lvl} ${r.msg}`;
}

// the Output-window shape ("  HH:MM:SS.mmm  message"): assemble.js only needs
// the message text, and the saved file stays diffable against a pasted one
function outputShape(r) {
  return `  ${r.time}  ${r.msg}`;
}

function summarize(sess) {
  const n = (f) => sess.filter(f).length;
  return {
    start: sess[0].ts,
    end: sess[sess.length - 1].ts,
    lines: sess.length,
    r4log: n((r) => r.msg.includes('[R4LOG]')),
    diagFail: n((r) => r.msg.includes(DIAG_TAG + ' FAIL')),
    warnings: n((r) => r.level === 'Warning'),
    errors: n((r) => r.level === 'Error'),
  };
}

function newestLog(dirs) {
  let best = null;
  for (const d of dirs) {
    let names;
    try { names = fs.readdirSync(d); } catch (e) { continue; }
    for (const name of names) {
      if (!/_Studio_.*\.log$/.test(name)) continue;
      const p = path.join(d, name);
      const mt = fs.statSync(p).mtimeMs;
      if (best === null || mt > best.mt) best = { p, mt };
    }
  }
  return best && best.p;
}

function logDirs() {
  if (process.env.RMC_STUDIO_LOGS) return [process.env.RMC_STUDIO_LOGS];
  const out = [];
  try {
    for (const u of fs.readdirSync('/mnt/c/Users')) out.push(`/mnt/c/Users/${u}/AppData/Local/Roblox/logs`);
  } catch (e) { /* not WSL */ }
  if (process.env.LOCALAPPDATA) out.push(path.join(process.env.LOCALAPPDATA, 'Roblox', 'logs'));
  return out;
}

function main(argv) {
  const opt = { session: 1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--diag' || a === '--list' || a === '--all') opt[a.slice(2)] = true;
    else if (a === '--session' || a === '--tail') opt[a.slice(2)] = parseInt(argv[++i], 10);
    else if (a === '--grep' || a === '--save' || a === '--file') opt[a.slice(2)] = argv[++i];
    else { console.error('unknown argument ' + a); return 2; }
  }
  const file = opt.file || newestLog(logDirs());
  if (!file) { console.error('no Studio log found (set RMC_STUDIO_LOGS or pass --file)'); return 2; }
  const sess = sessions(parse(fs.readFileSync(file, 'utf8')));
  console.error(`log: ${file} (${sess.length} play session(s))`);
  if (sess.length === 0) { console.error('no play session in this log (no anchor-gate banner yet)'); return 1; }
  if (opt.list) {
    sess.forEach((s, i) => {
      const m = summarize(s);
      console.log(`#${sess.length - i} ${m.start} .. ${m.end.slice(11)} lines=${m.lines} r4log=${m.r4log} diagFail=${m.diagFail} warn=${m.warnings} err=${m.errors}`);
    });
    return 0;
  }
  const pick = sess[sess.length - opt.session];
  if (!pick) { console.error(`no session ${opt.session} (have ${sess.length})`); return 1; }
  if (opt.save) {
    fs.writeFileSync(opt.save, pick.map(outputShape).join('\n') + '\n');
    const m = summarize(pick);
    console.log(`saved ${m.lines} lines (${m.r4log} R4LOG) to ${opt.save}`);
    return 0;
  }
  let rows = pick;
  if (opt.diag) rows = rows.filter(isDiag);
  else if (!opt.all) rows = rows.filter((r) => !r.msg.includes('[R4LOG]'));
  if (opt.grep) rows = rows.filter((r) => r.msg.includes(opt.grep));
  if (opt.tail) rows = rows.slice(-opt.tail);
  for (const r of rows) console.log(format(r));
  const m = summarize(pick);
  console.error(`session ${m.start}: ${m.lines} lines, ${m.diagFail} DIAG FAIL, ${m.warnings} warning(s), ${m.errors} error(s)`);
  return 0;
}

module.exports = { parse, sessions, isScript, isDiag, format, outputShape, summarize };
if (require.main === module) process.exit(main(process.argv.slice(2)));
