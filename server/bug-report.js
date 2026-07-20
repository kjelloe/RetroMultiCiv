// In-client BUG REPORTS (helper queue #3, user-requested 2026-07-20 for the
// public test server). A playtester's one-click report — free text plus the
// Shift+D recording (initial state + command log + hashes), game code, turn and
// URL params — POSTs to the game server, which writes it here as ONE json file.
// Posture mirrors --share-reports: WRITE-ONLY (never served back over HTTP; the
// operator reads the dir over ssh), opt-in via --bug-reports DIR, off by
// default. Keep the newest `keep` files (mtime order, ours-only) so a small box
// never fills up.
import fs from 'node:fs';
import path from 'node:path';

const FORMAT = 'retromulticiv-bug-report';

// atomic write: bugreports/<utc-timestamp>-<gameId>.json. The wrapper record
// stamps a format + receive time; the client payload rides under `report`.
function writeBugReport(dir, payload, now) {
  fs.mkdirSync(dir, { recursive: true });
  const t = now || Date.now();
  const ts = new Date(t).toISOString().replace(/[:.]/g, '-');
  const rawGid = payload && payload.gameId !== undefined && payload.gameId !== null ? String(payload.gameId) : '';
  const gid = rawGid.replace(/[^A-Za-z0-9-]/g, '').slice(0, 40) || 'nogame';
  const record = { format: FORMAT, version: 1, receivedAt: new Date(t).toISOString(), report: payload };
  const file = path.join(dir, `${ts}-${gid}.json`);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(record));
  fs.renameSync(tmp, file);
  return file;
}

function rotateBugReports(dir, keep) {
  let names;
  try { names = fs.existsSync(dir) ? fs.readdirSync(dir) : []; } catch (e) { return; }
  const files = [];
  for (const f of names) {
    if (!f.endsWith('.json')) continue;
    const p = path.join(dir, f);
    try { files.push({ path: p, mtime: fs.statSync(p).mtimeMs }); } catch (e) { /* gone */ }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  for (const victim of files.slice(keep)) {
    try { fs.unlinkSync(victim.path); } catch (e) { /* already gone */ }
  }
}

export { writeBugReport, rotateBugReports, FORMAT };
