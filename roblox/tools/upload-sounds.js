'use strict';
// roblox/tools/upload-sounds.js — bulk-upload the rendered sound WAVs as Roblox
// audio assets via the OPEN CLOUD Assets API and capture the assetIds
// automatically (the manual create.roblox.com flow needs 32 uploads + 32
// copy-pastes; this does the whole worksheet in one run).
//
// One-time setup (user):
//   1. create.roblox.com -> Open Cloud -> API Keys -> Create:
//      - API System: Assets, permissions: read + write
//      - Accepted IP: 0.0.0.0/0 (or your IP)
//      - copy the key
//   2. Your numeric userId (profile URL: roblox.com/users/<ID>/profile).
//   NOTE: audio uploads require an ID-VERIFIED account for useful quota
//   (verified ~100/month, unverified ~10 — 32 files needs verified).
//
// Run (Node >= 18, no deps):
//   ROBLOX_API_KEY=xxxx ROBLOX_USER_ID=12345 node roblox/tools/upload-sounds.js
//   (or put the key in a file:  ROBLOX_API_KEY_FILE=~/.roblox-api-key ...)
//
// What it does:
//   - reads debugging/sounds-export/VOLUMES.md (cue / file / volume / assetId)
//   - uploads every cue whose assetId column is empty (sequential, polite delay)
//   - polls each upload operation until the assetId is issued
//   - rewrites VOLUMES.md with the assetIds filled (idempotent — re-run safe;
//     already-filled rows are skipped, so a failed run just resumes)
//   - regenerates roblox/src/client/SoundAssets.luau (cue -> rbxassetid + the
//     approved Volume) — Rojo syncs it, Sound.client requires it. Done.

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const EXPORT_DIR = path.join(ROOT, 'debugging', 'sounds-export');
const VOLUMES = path.join(EXPORT_DIR, 'VOLUMES.md');
const LUAU_OUT = path.join(ROOT, 'roblox', 'src', 'client', 'SoundAssets.luau');

const API = 'https://apis.roblox.com/assets/v1';

function apiKey() {
  if (process.env.ROBLOX_API_KEY) return process.env.ROBLOX_API_KEY.trim();
  if (process.env.ROBLOX_API_KEY_FILE) {
    return fs.readFileSync(process.env.ROBLOX_API_KEY_FILE.replace(/^~/, process.env.HOME), 'utf8').trim();
  }
  console.error('Set ROBLOX_API_KEY (or ROBLOX_API_KEY_FILE). See the header for the one-time key setup.');
  process.exit(1);
}

function userId() {
  if (process.env.ROBLOX_USER_ID) return process.env.ROBLOX_USER_ID.trim();
  console.error('Set ROBLOX_USER_ID (your numeric id from roblox.com/users/<ID>/profile).');
  process.exit(1);
}

// ---- VOLUMES.md parse/rewrite ------------------------------------------------
function parseRows(md) {
  const rows = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*([\w-]+)\s*\|\s*([\w.-]+\.wav)\s*\|\s*([\d.]+)\s*\|\s*(\d*)\s*\|\s*$/);
    if (m) rows.push({ cue: m[1], file: m[2], volume: m[3], assetId: m[4] || '' });
  }
  return rows;
}

function rewriteVolumes(md, rows) {
  const byCue = Object.fromEntries(rows.map(r => [r.cue, r]));
  return md.split('\n').map(line => {
    const m = line.match(/^\|\s*([\w-]+)\s*\|\s*([\w.-]+\.wav)\s*\|\s*([\d.]+)\s*\|\s*\d*\s*\|\s*$/);
    if (m && byCue[m[1]] && byCue[m[1]].assetId) {
      return `| ${m[1]} | ${m[2]} | ${m[3]} | ${byCue[m[1]].assetId} |`;
    }
    return line;
  }).join('\n');
}

// ---- Open Cloud calls ---------------------------------------------------------
async function uploadOne(key, creator, cue, filePath) {
  const request = {
    assetType: 'Audio',
    displayName: `RMC ${cue}`,
    description: `RetroMultiCiv game cue '${cue}' (synthesized, tools/render-sounds.js)`,
    creationContext: { creator: { userId: creator } },
  };
  const form = new FormData();
  form.append('request', JSON.stringify(request));
  form.append('fileContent', new Blob([fs.readFileSync(filePath)], { type: 'audio/wav' }), path.basename(filePath));
  const res = await fetch(`${API}/assets`, { method: 'POST', headers: { 'x-api-key': key }, body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`upload ${cue}: HTTP ${res.status} ${JSON.stringify(body)}`);
  return body.operationId || (body.path || '').replace(/^operations\//, '');
}

async function pollOperation(key, opId, cue) {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await fetch(`${API}/operations/${opId}`, { headers: { 'x-api-key': key } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`poll ${cue}: HTTP ${res.status} ${JSON.stringify(body)}`);
    if (body.done) {
      const id = body.response && (body.response.assetId || body.response.assetID);
      if (!id) throw new Error(`poll ${cue}: done without assetId ${JSON.stringify(body)}`);
      return String(id);
    }
  }
  throw new Error(`poll ${cue}: not done after 60s (operation ${opId}) — re-run to resume`);
}

// ---- Luau emit ----------------------------------------------------------------
function emitLuau(rows) {
  const lines = rows.map(r => `\t["${r.cue}"] = { asset = ${r.assetId ? `"rbxassetid://${r.assetId}"` : '""'}, volume = ${r.volume} },`);
  return [
    '-- GENERATED by roblox/tools/upload-sounds.js from debugging/sounds-export/',
    '-- VOLUMES.md (Open Cloud upload run) — do not hand-edit; re-run the uploader.',
    '-- cue -> { asset = "rbxassetid://<id>" (or "" while unuploaded), volume } —',
    '-- the volume column is the APPROVED browser mix (VOLUMES.md worksheet).',
    'return {',
    ...lines,
    '}',
    '',
  ].join('\n');
}

async function main() {
  const md = fs.readFileSync(VOLUMES, 'utf8');
  const rows = parseRows(md);
  if (rows.length === 0) { console.error('no rows parsed from VOLUMES.md'); process.exit(1); }
  const pending = rows.filter(r => !r.assetId);
  console.log(`${rows.length} cues, ${pending.length} to upload`);
  if (pending.length > 0) {
    const key = apiKey();
    const creator = userId();
    for (const row of pending) {
      const file = path.join(EXPORT_DIR, row.file);
      process.stdout.write(`uploading ${row.cue} ... `);
      try {
        const op = await uploadOne(key, creator, row.cue, file);
        row.assetId = await pollOperation(key, op, row.cue);
        console.log(`assetId ${row.assetId}`);
      } catch (e) {
        console.log('FAILED');
        console.error(`  ${e.message}`);
        console.error('  (progress so far is saved; re-run to resume from here)');
        break; // save partial progress below rather than hammering a failing API
      }
      await new Promise(r => setTimeout(r, 1000)); // polite pacing
    }
  }
  fs.writeFileSync(VOLUMES, rewriteVolumes(md, rows));
  fs.writeFileSync(LUAU_OUT, emitLuau(rows));
  const done = rows.filter(r => r.assetId).length;
  console.log(`worksheet: ${done}/${rows.length} assetIds filled -> VOLUMES.md`);
  console.log(`luau table: ${path.relative(ROOT, LUAU_OUT)} regenerated`);
  if (done === rows.length) console.log('ALL DONE — commit SoundAssets.luau + drop VOLUMES.md into roblox/acceptance/.');
}

main().catch(e => { console.error(e); process.exit(1); });
