// Bootstrap: fetch the ruleset, create the world + session, wire the UI.
// State lives in session.js; panels/input/saves/hud are in ui/*.
// URL params: ?seed=N fixed world · ?civs=2..7 · ?humans=1..civs (hotseat)
// · ?mock=1 static state · ?diag=1 · a bare URL opens the setup screen.
// ctx.HUMAN is the current VIEWPOINT (hotseat hands it between players).
import { mlog } from './ui/mlog.js'; // L5: FIRST import — the ?mlog buffer arms before anything else
import { createRenderer } from './renderer/renderer.js';
import { getGraphicsDiagnostics, showDiagnostics, webglHelp } from './diagnostics.js';
import { createSession } from './session.js';
import { createRemoteSession } from './session-remote.js';
import { gameCode as computeGameCode } from '../shared/gamecode.js';
import { victoryOverrides, DEFAULT_VICTORY } from '../shared/victory-presets.js';
import { shuffleRoster } from '../shared/civ-shuffle.js';
import { matchSnapshot, snapshotUsable } from '../shared/age-snapshots.js';
import { hashState } from '../shared/statehash.js';
import { armSessionGuard, maybeShowRejoinBanner, renderRejoinFailure } from './ui/rejoin.js';
import { maybeShowSetupOnboarding, maybeShowGameOnboarding, showOnboarding } from './ui/onboarding.js';
import { capitalOf } from '../engine/government.js';
import { initHud } from './ui/hud.js';
import { initPanels } from './ui/panels.js';
import { initInput } from './ui/input.js';
import { initSaves } from './ui/saves.js';
import { initBugReport } from './ui/bug-report.js';
import { createHoverCard } from './ui/hover-card.js';
import { initTurnLog } from './ui/turnlog.js';
import { initOverlays } from './ui/overlays.js';
import { initLeftStack } from './ui/left-stack.js';
import { initDiscoveryCard } from './ui/discovery-card.js';
import { initDpad } from './ui/dpad.js';
import { initShip } from './ui/ship.js';
import { initMinimap } from './ui/minimap.js';
import { initBuildQueue } from './ui/build-queue.js';
import { initCityOverview } from './ui/city-overview.js';
import { initMilitaryOverview } from './ui/military-overview.js';
import { initEconOverview } from './ui/econ-overview.js';
import { initAutomate } from './ui/automate.js';
import { initDebugPanel } from './ui/debug-panel.js';
import { initStrategicOverlay } from './ui/strategic-overlay.js';
import { initDiplomacy } from './ui/diplomacy.js';
import { initTechTree } from './ui/tech-tree.js';
import { initRegency } from './ui/regency.js';
import { initReplay } from './ui/replay.js';
import { initHistorian } from './ui/historian.js';
import { initEndScreen } from './ui/endscreen.js';
import { initStats } from './ui/stats.js';
import { initSound } from './ui/sound.js';
import { initAdvice } from './ui/advice.js';
import { showSetupScreen } from './ui/setup.js';
import { initHandoff } from './ui/handoff.js';
import { initOptions } from './ui/options.js';
import { initPedia } from './ui/pedia.js';
import { createFfOverlay } from './ui/ff-overlay.js';

const hudStatus = document.getElementById('hud-status');

// surface any failure in the HUD — a silent exception otherwise looks like an
// empty map — and keep them for the Shift+D diagnostics download
const capturedErrors = [];
window.addEventListener('error', e => {
  if (`${e.message}`.indexOf('setup') !== -1) return; // deliberate bootstrap stop
  capturedErrors.push(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`);
  hudStatus.textContent = `ERROR: ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`;
  hudStatus.style.color = '#ff7b6b';
  // docs/07 §3.2: quicksave the last coherent state and show its code, so an
  // abrupt end still yields a verifiable stamp. Never let this throw (const TDZ
  // during bootstrap, a corrupt state, etc. all fall through the catch).
  try {
    const code = ctx.gameCode();
    if (code) {
      localStorage.setItem('retromulticiv-save', JSON.stringify(session.state));
      hudStatus.textContent += ` · state code ${code} (autosaved)`;
    }
  } catch (_) { /* the error handler must not error */ }
  // surface a one-click "report this problem" affordance (bug-report.js listens)
  try { window.dispatchEvent(new CustomEvent('rmc-error', { detail: hudStatus.textContent })); } catch (_) { /* never throw here */ }
});
window.addEventListener('unhandledrejection', e => {
  if (`${e.reason}`.indexOf('setup') !== -1) return; // deliberate bootstrap stop
  capturedErrors.push(`${e.reason && e.reason.message ? e.reason.message : e.reason}`);
  hudStatus.textContent = `ERROR: ${e.reason && e.reason.message ? e.reason.message : e.reason}`;
  hudStatus.style.color = '#ff7b6b';
  try { window.dispatchEvent(new CustomEvent('rmc-error', { detail: hudStatus.textContent })); } catch (_) { /* never throw here */ }
});

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

// #2305: try a pre-baked starting-age snapshot for this EXACT config before the
// live fast-forward. Returns the (neutral, grant-applied) state to adopt, or
// null on ANY miss — no manifest, no config match, a corrupt file, a failed
// statehash pin, or a dead human seat — so arbitrary seeds run the live ff
// unchanged (shared/age-snapshots.js is the pure matcher/guard).
async function tryAgeSnapshot(cfg, humanSeats) {
  try {
    const manifest = await fetchJson('../data/age-snapshots/manifest.json');
    const preset = matchSnapshot(manifest, cfg);
    if (!preset) return null;
    const state = await fetchJson('../data/age-snapshots/' + preset.file);
    return snapshotUsable(state, preset, humanSeats, hashState) ? state : null;
  } catch (_) { return null; }
}

// A77: an options-like reader over localStorage for the bootstrap tunes (the
// real ctx.options isn't wired until after the world builds). Sound defaults
// mirror ui/options.js DEFAULTS.
function storedOptions() {
  const D = { soundMaster: '70', soundEffects: true, soundMusic: true };
  return { get(k) {
    try { const o = JSON.parse(localStorage.getItem('retromulticiv-options') || '{}'); return o[k] !== undefined ? o[k] : D[k]; }
    catch (e) { return D[k]; }
  } };
}

const params = new URLSearchParams(location.search);
// a bare URL (no world parameters) gets the game-setup screen; it reloads
// boot fade-in: ease the #boot-fade layer (opaque from the first paint) out once
// the finished scene / setup screen is up. A rAF lets the reveal ride the next
// paint; a failsafe guarantees the page never stays black on any boot path.
function revealApp() {
  const f = document.getElementById('boot-fade');
  if (f) requestAnimationFrame(() => f.classList.add('gone'));
}
setTimeout(revealApp, 4000); // failsafe: never leave a black screen

// with ?seed=&civs=&humans= filled in
if (!params.has('seed') && !params.has('civs') && !params.has('mock') && !params.has('server')
    && !params.has('resume')) {
  showSetupScreen();
  revealApp(); // fade in the setup screen
  maybeShowRejoinBanner(); // XII.4: a left-behind server game gets a one-tap rejoin
  // first-timer arrows to the setup choices (once/browser) — but NOT under an
  // e2e/demo flow: those auto-open the host/join/find sub-flows without clicking
  // (so nothing dismisses the overlay), and the full-screen layer would then sit
  // over the lobby's own buttons and swallow their clicks (the e2ehost-boot bug).
  const automation = [...params.keys()].some(k => k.startsWith('e2e') || k === 'lobbydemo' || k === 'setupdemo' || k === 'envoydemo' || k === 'parleydemo');
  if (!automation) maybeShowSetupOnboarding();
  throw new Error('setup'); // stop the bootstrap; the setup screen reloads
}
// Tab-loss fix (user ruling 2026-07-22): ?resume=local boots straight from the
// localStorage autosave (saves.js writes it every turn + on tab-hide; the setup
// screen offers the link). Read the record NOW — its rulesOverrides must merge
// before the ruleset is assembled. Missing/corrupt record → the setup screen.
let resumeRec = null;
if (params.get('resume') === 'local') {
  try { resumeRec = JSON.parse(localStorage.getItem('rmc_local_autosave') || 'null'); } catch (e) { resumeRec = null; }
  if (!resumeRec || !resumeRec.state) {
    showSetupScreen();
    throw new Error('setup'); // nothing to resume — fall back to a fresh start
  }
}
const [terrain, units, techs, buildings, wonders, governments, civs, rules] = await Promise.all([
  fetchJson('../data/terrain.json'),
  fetchJson('../data/units.json'),
  fetchJson('../data/techs.json'),
  fetchJson('../data/buildings.json'),
  fetchJson('../data/wonders.json'),
  fetchJson('../data/governments.json'),
  fetchJson('../data/civs.json'),
  fetchJson('../data/rules.json')
]);
const ruleset = { terrain, units, techs, buildings, wonders, governments, civs, rules };
mlog('boot', 'ruleset loaded');

// Difficulty adjusts the content-citizen threshold (a RULESET override, not
// state — recorded in diagnostics so tools/replay.js applies the same rules).
// the 7-level ladder ids (#2155); difficulty flows into createGame as
// state.difficulty (the engine reads the full difficulties table), NOT an override.
const DIFFICULTY = { trainer: 1, chieftain: 1, warlord: 1, prince: 1, king: 1, emperor: 1, godemperor: 1 };
const MAP_SIZES = {
  xsmall: [40, 25], small: [60, 38], medium: [80, 50],
  large: [104, 65], xlarge: [128, 80], huge: [160, 100]
};
const difficulty = DIFFICULTY[params.get('difficulty')] !== undefined ? params.get('difficulty') : 'prince';
// combat calculations: authentic Civ 1 one-shot (rules default) or
// best-of-three (?combat=bestof3 — the setup screen's default pick);
// a full hitpoints system is a possible third mode later
const combat = params.get('combat') === 'bestof3' ? 'bestof3' : 'authentic';
const rulesOverrides = {};
if (combat === 'bestof3') rulesOverrides.combatRounds = 3;
// manhattan-gate (#16): ?nonukes=1 disables nuclear units entirely (the local-game
// mirror of the lobby host no-nukes toggle) — a rulesOverride, so tools/replay.js applies it.
if (params.get('nonukes') === '1') rulesOverrides.nukesDisabled = true;
// a resumed game replays the overrides it was SAVED with (difficulty table
// values ride in state; combat/victory/marathon shapes ride here)
if (resumeRec) Object.assign(rulesOverrides, resumeRec.rulesOverrides || {});
// victory conditions (?victory=<preset>): the chosen preset's rulesOverride
// patch (e.g. marathon → endYear 9999, removing the score-victory year limit).
// endYear lives in ruleset.rules (the sim's --natural shape), so it plumbs as a
// rulesOverride, not a state field. Absent/unknown = 'standard' = today's game.
// ?marathon=1 stays a back-compat alias for ?victory=marathon (old URLs/saves).
const victoryChoice = params.get('victory') || (params.get('marathon') === '1' ? 'marathon' : DEFAULT_VICTORY);
Object.assign(rulesOverrides, victoryOverrides(victoryChoice));
ruleset.rules = Object.assign({}, rules, rulesOverrides);

// --- graphics: probe before three.js starts (pinned to r162 = WebGL1 capable) ---
const diag = getGraphicsDiagnostics();
console.table(diag);
if (params.get('diag') === '1' || !diag.webgl2) showDiagnostics(diag);
if (!diag.webgl2 && !diag.webgl1) {
  hudStatus.style.color = '#ff7b6b';
  hudStatus.textContent = webglHelp();
  throw new Error('WebGL unavailable');
}
if (!diag.webgl2) {
  console.warn('RetroMultiCiv: WebGL2 unavailable, rendering via WebGL1 fallback');
}
let renderer;
try {
  renderer = createRenderer(document.getElementById('app'));
} catch (err) {
  hudStatus.style.color = '#ff7b6b';
  hudStatus.textContent = `The 3D map could not start: ${err.message} — ${webglHelp()}`;
  showDiagnostics(diag);
  throw err;
}

// --- world -----------------------------------------------------------------
import { createEngine } from '../engine/index.js';

let initialState = null;
let humans = 1;
let session = null;
const cityNamesByPlayer = {}; // pid -> that civilization's historic city list
const factionsByPid = {};     // pid -> data/civs.json visual (art A1.6a); the
                              // renderer falls back to player.color when empty
                              // (mock states, server/lobby games without civs)
const serverParam = params.get('server');
if (serverParam) {
  // Phase-3 (docs/06 §5): the authoritative engine runs on the server. Join
  // it and let the per-seat filtered view BE our state; hotseat stays a
  // local-only feature (a server game is 1 human + AI until phase 4).
  const wsUrl = serverParam === '1'
    ? `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
    : serverParam;
  const pick = params.get('civ');
  const myName = (pick && civs[pick] && civs[pick].name) || 'Player';
  mlog('join', `${wsUrl} game=${params.get('game') || '?'} spectate=${params.get('spectate') === '1'}`);
  try {
    session = await createRemoteSession({
      ruleset, baseRules: rules, wsUrl, name: myName, gameId: params.get('game') || undefined,
      spectator: params.get('spectate') === '1' // A17: tokenless omniscient viewer
    });
  } catch (err) {
    // A definitive join-reject (the game ended / is gone) downgrades to a
    // graceful setup-screen card — never the raw "ERROR: join rejected" banner.
    if (err && err.joinRejected) {
      showSetupScreen();
      // the "View final result" button fetches /saves/<gameId>.json from the
      // server's HTTP origin (same host as the ws): /ws → same origin, else
      // ws[s]://host → http[s]://host.
      const serverBase = wsUrl.startsWith('/') ? location.origin
        : wsUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
      if (renderRejoinFailure(document.getElementById('setup-box'), err.code, { gameId: err.gameId, gameCode: err.gameCode, serverBase })) {
        try { history.replaceState({}, '', location.pathname); } catch (_) { /* about: URLs */ }
        throw new Error('setup'); // clean stop; the error handler ignores 'setup'
      }
    }
    throw err; // anything else keeps the normal error path
  }
  mlog('joined', `seat=${session.playerId} turn=${session.state && session.state.turn}`);
  // A24: server games now carry each player's civ (joined reply) — wire the
  // city-name rosters and faction visuals exactly like local games
  for (const [pid, civId] of Object.entries(session.playerCivs || {})) {
    if (!civs[civId]) continue;
    cityNamesByPlayer[pid] = civs[civId].cities;
    if (civs[civId].visual) factionsByPid[pid] = civs[civId].visual;
  }
} else if (params.get('mock') === '1') {
  initialState = await fetchJson('./mock-state.json');
} else {
  const seed = parseInt(params.get('seed') || '', 10) || (Date.now() % 1000000);
  // A38: the map size gates the civ count (measured seats-per-size table,
  // data/rules.json maxCivsBySize) — URL abuse clamps down silently, the
  // setup screen enforces the same table interactively
  const sizeParam = MAP_SIZES[params.get('size')] !== undefined ? params.get('size') : 'medium';
  const maxCivs = (rules.maxCivsBySize && rules.maxCivsBySize[sizeParam]) || 14;
  const civCount = Math.min(maxCivs, Math.max(2, parseInt(params.get('civs') || '2', 10) || 2));
  humans = Math.min(civCount, Math.max(1, parseInt(params.get('humans') || '1', 10) || 1));

  // Which civilizations play: player 1's pick (?civ=romans) first, the rest
  // drawn from data/civs.json in a seed-shuffled order — same seed, same
  // opponents, so games stay reproducible from the URL alone.
  // §11: xorshift32-driven shuffle (shared/civ-shuffle.js) — the old raw-LCG
  // shuffle biased shuffled[0] by seed parity (the "always Aztec" start).
  const roster = Object.keys(civs).sort();
  const shuffled = shuffleRoster(roster, seed);
  const picked = params.get('civ');
  const lineup = picked && civs[picked]
    ? [picked].concat(shuffled.filter(id => id !== picked))
    : shuffled;

  // A20 starting age: any age past Ancient means the whole world plays as AI
  // up to the age's turn (see shared/fastforward.js), then the humans take
  // over their seats with the cumulative tech grant of prior eras
  const age = (ruleset.rules.ages || []).find(a => a.id === (params.get('age') || 'ancient'))
    || { id: 'ancient', turn: 0 };

  const playerDefs = [];
  for (let i = 0; i < civCount; i++) {
    const civId = lineup[i];
    playerDefs.push({
      id: 'p' + (i + 1), civ: civId,
      name: civs[civId].name, color: civs[civId].color,
      human: age.turn > 0 ? false : i < humans // late starts: AI plays history first
    });
    cityNamesByPlayer['p' + (i + 1)] = civs[civId].cities;
    if (civs[civId].visual) factionsByPid['p' + (i + 1)] = civs[civId].visual;
  }
  const size = sizeParam; // resolved above the civ clamp (A38)
  const dims = MAP_SIZES[size];
  // A82a: ?maptype= validated against rules.mapTypes (unknown clamps to the
  // identity default, like ?size); the engine resolves the preset itself
  const mapType = (rules.mapTypes && rules.mapTypes[params.get('maptype')])
    ? params.get('maptype') : 'continents';
  // A92: ?debug=1 (which already means per-command hashes) ALSO enables the
  // engine's debug-command family for local games — setup.debug reaches
  // mapgen, which sets state.debugEnabled at creation
  const setupA92 = {
    seed, options: { width: dims[0], height: dims[1], players: playerDefs, mapType, difficulty }
  };
  if (params.get('debug') === '1') setupA92.debug = true;
  if (resumeRec) {
    // resume boots the SAVED state — no world creation, no fast-forward
    initialState = resumeRec.state;
  } else {
  initialState = createEngine(ruleset).createGame(setupA92);
  if (initialState.ok === false) throw new Error(`createGame failed: ${initialState.reason}`);

  if (age.turn > 0) {
    const humanSeats = [];
    for (let i = 0; i < humans; i++) humanSeats.push('p' + (i + 1));
    // #2305: a pre-baked snapshot for this EXACT config (default lineup, same
    // seed/size/civs/age/maptype/difficulty) loads INSTANTLY — no live walk.
    // The grant is already baked in; just flip the human seats. Any miss
    // (arbitrary seed, a ?civ pick, no snapshot) → the live ff below.
    const snapState = await tryAgeSnapshot(
      { age: age.id, size, seed, civs: civCount, mapType, difficulty, picked }, humanSeats);
    if (snapState) {
      for (const pid of humanSeats) snapState.players[pid].human = true;
      initialState = snapState;
      hudStatus.textContent = '';
    } else {
    const { createFastForward, applyAgeGrant } = await import('../shared/fastforward.js');
    const fwd = createFastForward(ruleset, initialState, { humanSeats });
    // A56(a): a center-screen year counter sweeping 4000 BC → the start year,
    // era names fading through, driven by the REAL simulated turn; honors
    // reduceAnimation; removed the instant history hands off (never delays it).
    // ctx.options isn't wired yet at bootstrap, so read the flag from storage.
    let ffReduce = false;
    try { ffReduce = JSON.parse(localStorage.getItem('retromulticiv-options') || '{}').reduceAnimation === true; } catch (e) { /* fresh */ }
    const ffOverlay = createFfOverlay({ reduceAnimation: ffReduce, ages: ruleset.rules.ages || [] });
    // A77: the world-creation tune under the fast-forward (ctx.sound isn't wired
    // yet at bootstrap — a tune-only instance reading the stored sound prefs)
    const ffSound = initSound({ options: storedOptions(), session: null });
    ffSound.playTune('creation');
    // FF FIX #3: at high civ counts ONE round is many heavy AI turns, so a fixed
    // 5-round slice can block the main thread for seconds (Firefox "unresponsive
    // page" on 14 civs / medium / Space). Bound each synchronous burst by a TIME
    // budget instead — run single rounds until ~30ms elapse, then yield to the
    // event loop. Same command sequence, just finer batching (determinism
    // unaffected — verified in test/fastforward.test.js); the overlay updates
    // every slice, so the user keeps seeing motion.
    const SLICE_MS = 30;
    let r = { done: false };
    while (!r.done) {
      const sliceStart = Date.now();
      do { r = fwd.step(1, age.turn); } while (!r.done && Date.now() - sliceStart < SLICE_MS);
      ffOverlay.update(fwd.turn, age.turn, fwd.state.year);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (fwd.aborted) {
      ffSound.stopTune();
      // deterministic UX: name the casualty, never silently re-roll seeds
      const a = fwd.aborted;
      ffOverlay.fail(a.reason === 'civEliminated'
        ? `✗ ${a.name} was destroyed before the ${age.name} — try another seed, age, or civilization`
        : `✗ history ended early (${a.reason}) — try another seed or an earlier age`);
      throw new Error('setup'); // stop the bootstrap; the message stays
    }
    ffSound.stopTune();
    ffOverlay.remove();
    initialState = fwd.state;
    applyAgeGrant(initialState, age, ruleset);
    for (const pid of humanSeats) initialState.players[pid].human = true;
    hudStatus.textContent = '';
    } // end live-ff branch (no matching snapshot)
  }
  } // end fresh-start branch (a resume skips creation + fast-forward)

  // a resumed game canonicalizes to ?resume=local — a refresh then re-resumes
  // from the LATEST autosave; a ?seed URL here would silently restart turn 1
  if (resumeRec) {
    history.replaceState(null, '', '?resume=local');
  } else {
  history.replaceState(null, '',
    `?seed=${seed}&civs=${civCount}&humans=${humans}`
    + `${picked && civs[picked] ? `&civ=${picked}` : ''}`
    + `${size !== 'medium' ? `&size=${size}` : ''}`
    + `${difficulty !== 'prince' ? `&difficulty=${difficulty}` : ''}`
    + `${combat !== 'authentic' ? `&combat=${combat}` : ''}`
    + `${age.turn > 0 ? `&age=${age.id}` : ''}`
    + `${mapType !== 'continents' ? `&maptype=${mapType}` : ''}`); // A82a: canonical URL keeps the world reproducible
  }
}

// --- wiring ------------------------------------------------------------------
// ?debug=1: the diagnostics recorder also hashes after every single command
// (default: after each end-turn round) — finer replay divergence pinpointing
if (!session) session = createSession(ruleset, initialState, { debug: params.get('debug') === '1' });
mlog('boot', `session ready (turn ${session.state && session.state.turn})`);
// lastMovedBy: pid -> unitId, PER PLAYER (wave III) — a hotseat hand-off lands
// each incoming player on THEIR last-moved unit, not the previous player's
const sel = { unitId: null, cityId: null, lastMovedBy: {} };
// baseRules = the untouched rules.json: loading a save re-derives the live
// rules as base + THE SAVE'S recorded overrides (B16 apply-on-load ruling)
const ctx = { session, renderer, sel, HUMAN: session.playerId || 'p1', errors: capturedErrors, rulesOverrides, baseRules: rules };
// A17 spectator mode: ctx.HUMAN is the 'spectator' pseudo-viewer — the UI
// renders the omniscient view read-only (no players[ctx.HUMAN] entry exists,
// so hud/input/panels gate their owner reads on this flag)
ctx.SPECTATOR = ctx.HUMAN === 'spectator';
if (ctx.SPECTATOR) {
  const chip = document.createElement('div');
  chip.id = 'spectator-chip';
  chip.textContent = '👁 spectating';
  chip.style.cssText = 'position:fixed;top:8px;right:96px;z-index:41;background:#2b2416;'
    + 'border:1px solid #6b5d2f;border-radius:6px;padding:4px 10px;color:#ffe066;'
    + 'font-family:inherit;font-size:12px;';
  document.body.appendChild(chip);
  const endBtn = document.getElementById('end-turn');
  if (endBtn) endBtn.style.display = 'none'; // nothing to end — view-only
  const selNote = document.getElementById('hud-selection');
  if (selNote) selNote.textContent = 'watching — click any unit to inspect it';
  // no own unit to land on — open on the middle of the world instead
  renderer.centerOn(Math.floor(session.state.map.width / 2), Math.floor(session.state.map.height / 2));
}

ctx.selectUnit = (unit, opts) => {
  sel.unitId = unit.id;
  sel.cityId = null;
  renderer.setSelection({ unitId: unit.id });
  if (!opts || !opts.keepStack) ctx.panels.closeStackPanel();
  ctx.hud.unitNote(unit);
  if (ctx.refreshActionBar) ctx.refreshActionBar();
  if (ctx.advice) ctx.advice.offer('unit-selected'); // A78
};

// select the viewpoint's first idle unit (game start and every hand-off)
function selectFirstUnit(noCenter) {
  const unit = Object.values(session.state.units).find(
    u => u.owner === ctx.HUMAN && u.moves > 0
  );
  if (unit) {
    ctx.selectUnit(unit);
    if (!noCenter) renderer.centerOn(unit.x, unit.y);
  } else {
    sel.unitId = null;
    if (ctx.refreshActionBar) ctx.refreshActionBar();
  }
}

// Hotseat hand-off: swap the viewpoint to the (human) active player. All
// per-player UI resets and the map re-renders through THEIR fog.
ctx.setHuman = (pid) => {
  ctx.HUMAN = pid;
  sel.unitId = null;
  sel.cityId = null;
  ctx.panels.closeAll();
  if (ctx.turnlog) ctx.turnlog.resetViewer();
  ctx.hud.refresh();
  // wave III landing order: THEIR last-moved unit → their capital → any unit
  const lastId = sel.lastMovedBy[pid];
  const last = lastId && session.state.units[lastId];
  if (last && last.owner === pid) {
    ctx.selectUnit(last);
    renderer.centerOn(last.x, last.y);
    return;
  }
  const cap = capitalOf(session.state, pid, ruleset);
  if (cap) renderer.centerOn(cap.x, cap.y);
  selectFirstUnit(Boolean(cap)); // capital shown: select without re-centering
};

// next unused name from the viewpoint civilization's roster, else a fallback
ctx.suggestCityName = () => {
  const taken = {};
  for (const cid of Object.keys(session.state.cities)) {
    taken[session.state.cities[cid].name] = true;
  }
  for (const name of cityNamesByPlayer[ctx.HUMAN] || []) {
    if (!taken[name]) return name;
  }
  return `New City ${session.state.nextCityId}`;
};

// The game verification code (docs/07): computed locally from the full state,
// but in server mode the client only holds a filtered VIEW — the authoritative
// code comes from the server (slice 3, `session.serverCode`). Returns null when
// no trustworthy code is available yet (server mode before the first code push).
ctx.gameCode = () => {
  if (session.serverCode !== undefined) return session.serverCode;
  if (serverParam) return null;
  try { return computeGameCode(session.state); } catch (e) { return null; }
};
ctx.lastSaveCode = null; // set by ui/saves.js on save; shown on the hand-off screen

ctx.bugReport = initBugReport(ctx); // #3: in-client bug report (options + error banner)
ctx.hoverCard = createHoverCard(); // XIV §22/§24/§27: the shared hover-card component
initOptions(ctx);
ctx.pedia = initPedia(ctx);         // A58: the in-game encyclopedia (📖 / ?)
ctx.hud = initHud(ctx);
// server mode: surface disconnect/reconnect notices in the HUD banner, and
// wire the phase-4 turn flow (your-turn chime, waiting-for-<name>, skip vote)
if (session.setStatusHandler) session.setStatusHandler(msg => ctx.hud.banner(`⚠ ${msg}`));
if (serverParam) import('./ui/lobby.js').then(m => m.initMultiplayerFlow(ctx));
ctx.panels = initPanels(ctx);
ctx.handoff = initHandoff(ctx);
initInput(ctx);
ctx.saves = initSaves(ctx); // XIV §5+§8: Save/Load actions for the ⚙ Options buttons
ctx.turnlog = initTurnLog(ctx);
ctx.overlays = initOverlays(ctx); // A45: data layers over explored tiles
initLeftStack(); // A57: one open left-stack panel at a time (after overlays inserts)
ctx.discoveryCard = initDiscoveryCard(ctx); // the tech-discovery card (turnlog's flash yields to it)
initDpad(ctx); // L7b: coarse-pointer d-pad (CSS-gated to touch devices)
ctx.ship = initShip(ctx); // H8 (A76): the graphical spaceship screen (🚀)
ctx.minimap = initMinimap(ctx); // C1: world minimap (click-to-jump, fog-honest)
ctx.buildQueue = initBuildQueue(ctx); // C3: per-city build queue (logged commands only)
ctx.cityOverview = initCityOverview(ctx); // XIV §34: all-cities overview panel (needs panels + buildQueue)
ctx.militaryOverview = initMilitaryOverview(ctx); // XIV §41: all-units overview (sits left of 🏙; needs city-overview button present)
ctx.econOverview = initEconOverview(ctx); // XIV §49: economic overview (sits left of ⚔; needs military-overview button present)
ctx.automate = initAutomate(ctx); // C4: sentry-wake + settler automation (view-based)
ctx.debugPanel = initDebugPanel(ctx); // A92: null unless state.debugEnabled
ctx.strategicOverlay = initStrategicOverlay(ctx); // live AI strategy (?debug=1 / spectator only)
ctx.diplomacy = initDiplomacy(ctx); // D2: Foreign-relations panel (feature-detected; inert until D1)
ctx.techTree = initTechTree(ctx); // XII.6: graphical tech tree + client-side beeline (🌳 / Shift+T)
// L6: spectators issue no commands — the 🤖 regency button (and its seat
// takeover) never exists for the view-only pseudo-seat
ctx.regency = ctx.SPECTATOR ? null : initRegency(ctx); // A40: AI regency (🤖 auto turn)
ctx.replay = initReplay(ctx);     // A47: post-game replay theater
ctx.historian = initHistorian(ctx); // A75: the age-change historian's report
ctx.stats = initStats(ctx);         // A73-STATS: the statistics page
ctx.sound = initSound(ctx);         // A77: event sound cues (fog-filtered)
// A78 first-timer advice is a SEATED-PLAYER aid (found-a-city, settler,
// low-treasury… all read ctx.HUMAN's empire) — a view-only spectator has none,
// so it's null for them (every caller already guards `if (ctx.advice)`).
ctx.advice = ctx.SPECTATOR ? null : initAdvice(ctx);
ctx.endscreen = initEndScreen(ctx); // A73: the end-game scoreboard
// first-timer WHERE-things-are arrows (once/browser); the '?' in Options re-shows
ctx.onboarding = { show: showOnboarding };
// XII.4: in a server game, guard against an accidental leave (mobile back-swipe
// unloads the page — Part C's reconnect can't help) and remember the seat so the
// setup screen can offer a one-tap rejoin. Spectators/local games are no-ops.
if (serverParam && !ctx.SPECTATOR) armSessionGuard({ session, serverParam });

if (renderer.setFactions) renderer.setFactions(factionsByPid);
// palette pass: a civ-palette mode change re-resolves every visual (the
// renderer maps through ui/palette.js displayVisual) and repaints
ctx.options.watch(k => {
  if (k === 'civPalette') {
    if (renderer.setFactions) renderer.setFactions(factionsByPid);
    ctx.hud.refresh();
  }
});
// A28: renderer animations honor the ⚙ reduce-animation preference, live
if (renderer.setReduceAnimation) {
  renderer.setReduceAnimation(ctx.options.get('reduceAnimation') === true);
  ctx.options.watch((k, v) => {
    if (k === 'reduceAnimation') {
      renderer.setReduceAnimation(v === true);
      ctx.hud.refresh(); // rebuild so re-enabling re-registers sway/smoke
    }
  });
}
// first in-game screen: one-time arrows to the controls (a real seated game,
// not a spectator view and not a finished game booted just to show its endscreen)
const demoParam = params.get('envoydemo') === '1' || params.get('parleydemo') === '1';
if (!ctx.SPECTATOR && !demoParam && !(session.state && session.state.gameOver)) maybeShowGameOnboarding();
session.onChange((_state, events) => {
  ctx.hud.refresh();
  ctx.panels.refresh();
  // A28 combat flash: viewer-involved fights only (fog: rival-vs-rival
  // battles may sit on tiles this player has never seen) — same filter as
  // the A16 camera linger it pairs with
  const combats = (events || []).filter(e => e.type === 'combatResolved'
    && e.x !== undefined && (e.attackerOwner === ctx.HUMAN || e.defenderOwner === ctx.HUMAN));
  if (combats.length > 0 && renderer.playEvents) renderer.playEvents(combats);
});

ctx.hud.refresh();
const firstUnit = Object.values(session.state.units).find(
  u => u.owner === ctx.HUMAN && session.state.players[ctx.HUMAN]
    && session.state.players[ctx.HUMAN].human
);
if (firstUnit) {
  ctx.selectUnit(firstUnit);
  renderer.centerOn(firstUnit.x, firstUnit.y);
}
const zoom = parseInt(params.get('zoom') || '', 10);
if (zoom) renderer.setZoom(zoom); // handy for close-up screenshots
revealApp(); // scene positioned + HUD up — fade in the finished world
// late-join §4: a takeover joiner boots with assignedCiv on its join answer —
// a prominent reveal names the AI civilization they were handed (server names it,
// §3 deterministic). Local/non-takeover boots have no assignedCiv → nothing.
if (serverParam && session.assignedCiv && civs[session.assignedCiv]) {
  ctx.hud.banner(`🏛 You've taken over the ${civs[session.assignedCiv].name} — their empire is yours for the rest of the game!`);
}

// ?bannerdemo=1 (A25 screenshots): render the your-turn banner with its
// dismiss/mute controls deterministically — re-fired so the 5s transient
// can't expire before a virtual-time screenshot captures it
if (params.get('bannerdemo') === '1') {
  ctx.hud.turnBanner('🔔 Your turn');
  setInterval(() => ctx.hud.turnBanner('🔔 Your turn'), 3000);
}

// ?spechover=unit|city (A35 screenshots): as a spectator, park the cursor
// over the first city (or a unit standing outside any city) and fire the
// hover so the tooltip renders — re-fired for virtual-time captures
if (params.get('spechover')) {
  const spKind = params.get('spechover');
  const spState = session.state;
  const cityTiles = {};
  for (const c of Object.values(spState.cities)) cityTiles[`${c.x},${c.y}`] = true;
  const spTarget = spKind === 'city'
    ? Object.values(spState.cities)[0]
    : Object.values(spState.units).find(u => !cityTiles[`${u.x},${u.y}`]);
  if (spTarget) {
    renderer.centerOn(spTarget.x, spTarget.y);
    renderer.setZoom(8);
    const fire = () => {
      const canvas = document.querySelector('#app canvas');
      const r = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true
      }));
    };
    fire();
    setInterval(fire, 400);
  }
}

// ?e2e=9 (A47): the replay theater IS a replay-verifier. Found a city, play a
// few rounds to build a real recording, then replay it in the sandbox and
// assert the reproduced final hash equals the recording's — and that the
// major-events feed filled. Also proves the full-history save round-trips.
if (params.get('e2e') === '9' && firstUnit && firstUnit.type === 'settlers') {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  await session.apply({ type: 'foundCity', playerId: ctx.HUMAN, unitId: firstUnit.id, name: 'Replayville' });
  for (let i = 0; i < 3; i++) await ctx.endTurn();
  const rec = await ctx.replay.getRecording();
  const v = ctx.replay.verifyReplay(rec);
  probe.textContent = `e2e9 match:${v.replayHash === v.recordedHash}`
    + ` majors:${v.majors.length} entries:${session.log.length} errors:${capturedErrors.length}`;
  if (params.get('e2eopen') === '1') await ctx.replay.open(); // screenshot the theater
}

// ?hoverdemo=1 (A19 screenshots): with the camera centered on the selected
// unit, hover a screen point offset from canvas center (&hoverdx/&hoverdy px)
// so the move-affordance arrow renders deterministically in headless shots
if (params.get('hoverdemo') === '1' && firstUnit) {
  const canvas = document.querySelector('#app canvas');
  if (canvas) {
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      clientX: r.left + r.width / 2 + (parseInt(params.get('hoverdx') || '', 10) || 80),
      clientY: r.top + r.height / 2 + (parseInt(params.get('hoverdy') || '', 10) || 0),
      bubbles: true
    }));
  }
}

// XIV §26: ?discoverydemo=<techId|1> shows the discovery celebration and leaves
// it open (screenshot review / manual look — the real trigger is techDiscovered).
if (params.get('discoverydemo') && ctx.discoveryCard && ctx.discoveryCard.show) {
  const p = params.get('discoverydemo');
  const t = session.ruleset.techs[p] ? p
    : (Object.keys(session.ruleset.techs).find(id => session.ruleset.techs[id].era) || 'writing');
  ctx.discoveryCard.show(t);
}

// XIV §48: ?wonderdemo=<wonderId|1> shows the wonder-complete splash and leaves it
// open (screenshot review / manual look — the real trigger is an own wonderBuilt).
if (params.get('wonderdemo') && ctx.discoveryCard && ctx.discoveryCard.showWonder) {
  const w = params.get('wonderdemo');
  const wid = session.ruleset.wonders[w] ? w : Object.keys(session.ruleset.wonders)[0];
  const cid = session.state.cityOrder && session.state.cityOrder[0];
  ctx.discoveryCard.showWonder(wid, cid);
}

// XIV §33: ?envoydemo=1 injects a sample incoming peace offer and pops the envoy
// modal, leaving it up (screenshot review / manual look — the real trigger is a
// rival's offer landing on your turn). Local engine only (fog-view has no
// writable relations).
if (params.get('envoydemo') === '1' && params.get('server') !== '1' && ctx.diplomacy && ctx.diplomacy.scanOffers) {
  const rival = (session.state.playerOrder || Object.keys(session.state.players))
    .find(pid => pid !== ctx.HUMAN && pid !== 'barb' && session.state.players[pid] && session.state.players[pid].alive !== false);
  if (rival) {
    const { pairKey } = await import('../shared/diplomacy-view.js');
    await Promise.resolve(); // let initDiplomacy's command probe flip commandReady
    if (!session.state.relations) session.state.relations = {};
    session.state.relations[pairKey(ctx.HUMAN, rival)] = { state: 'war', offer: { from: rival, turn: session.state.turn } };
    ctx.diplomacy.scanOffers();
  }
}

// ?e2e=1: scripted sequence for the headless browser test — found a city with
// the starting settlers and fill both panels, so their code paths execute
// (hidden panel content stays in the DOM for --dump-dom to assert on).
if (params.get('e2e') === '1' && firstUnit && firstUnit.type === 'settlers') {
  // sweep the pointer across the centered map: the hover paths (settler site
  // preview, combat odds) must not throw (playtest regression: the site
  // preview crashed on every mouse move once governments landed)
  const canvas = document.querySelector('#app canvas');
  if (canvas) {
    const r = canvas.getBoundingClientRect();
    for (const fx of [0.5, 0.45, 0.55, 0.4, 0.6]) {
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: r.left + r.width * fx, clientY: r.top + r.height * 0.5, bubbles: true
      }));
    }
  }
  // snapshot the selected settler's action bar before founding consumes it
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  probe.textContent = 'actionbar: ' + document.getElementById('action-bar').textContent;
  document.body.appendChild(probe);
  await session.apply({ type: 'foundCity', playerId: ctx.HUMAN, unitId: firstUnit.id, name: 'Testopolis' });
  ctx.panels.toggleResearchPanel();
  // XIV §1/§9/§21/§28 hud-polish: rates+government in the top bar, the tech-tree
  // button inside the research panel labelled "View technology tree", and the
  // persistent "View game summary" reopen button all present.
  let hudpolish = 'unchecked';
  {
    const rl = document.getElementById('research-label');
    const ratesOk = rl && /💰\d+% 🔬\d+% 🎭\d+% · \S/.test(rl.textContent); // XV §1: icon rate vocabulary
    const tt = document.getElementById('open-tech-tree');
    const ttInPanel = tt && tt.closest && tt.closest('#research-panel') && /View technology tree/.test(tt.textContent);
    const vs = document.getElementById('view-summary');
    hudpolish = (ratesOk ? 'rates' : 'norates')
      + '/' + (ttInPanel ? 'ttpanel' : 'nott')
      + '/' + (vs ? 'summary' : 'nosummary');
  }
  // XIV §26: the tech-discovery celebration overlay — large glyph, ADVANCE
  // DISCOVERED / name / blurb, an UNLOCKED consequence panel, and the two
  // deliberate exits (Continue / Choose Research); NO auto-close.
  let discovery = 'unchecked';
  if (ctx.discoveryCard && ctx.discoveryCard.show) {
    const R = session.ruleset;
    const hasUnlock = t => Object.values(R.units).concat(Object.values(R.buildings), Object.values(R.wonders)).some(d => d.tech === t);
    const someTech = Object.keys(R.techs).find(t => R.techs[t].era && hasUnlock(t))
      || Object.keys(R.techs).find(t => R.techs[t].era) || 'writing';
    ctx.discoveryCard.show(someTech);
    const ov = document.getElementById('discovery-overlay');
    const card = document.getElementById('discovery-card');
    discovery = (ov ? 'overlay' : 'noverlay')
      + '/' + (card && /ADVANCE DISCOVERED/.test(card.textContent) ? 'kicker' : 'nokicker')
      + '/' + (card && card.querySelector('.dc-continue') && card.querySelector('.dc-choose') ? 'exits' : 'noexits');
    // XV §6: an unlock link's hover shows the §22 shared hover-card summary
    const dcLink = card && card.querySelector('.dc-link');
    if (dcLink && ctx.hoverCard) {
      dcLink.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const h = document.getElementById('hover-card');
      discovery += '/' + (h && !h.classList.contains('hidden') && h.querySelector('.hover-title') ? 'unlockcard' : 'nounlockcard');
      ctx.hoverCard.hide();
    } else { discovery += '/nolink'; }
    const cont = card && card.querySelector('.dc-continue');
    if (cont) cont.click(); // Continue closes it (no auto-timer)
    discovery += '/' + (document.getElementById('discovery-overlay') ? 'stuck' : 'closed');
  }
  // XV §3/§4: the research panel's View-Tech-Tree (lower-left) opens the tree,
  // which has a Back-to-list + Close-research footer; Back leaves the panel open.
  let techtreeux = 'unchecked';
  {
    const rp = document.getElementById('research-panel');
    if (rp && rp.classList.contains('hidden') && ctx.panels) ctx.panels.toggleResearchPanel();
    const ttBtn = document.getElementById('open-tech-tree');
    if (ttBtn) {
      ttBtn.click(); // open the tree
      const back = document.getElementById('tt-back');
      const closeR = document.getElementById('tt-close-research');
      techtreeux = (ttBtn.closest('#research-panel') ? 'inpanel' : 'notinpanel')
        + '/' + (back && closeR ? 'footer' : 'nofooter');
      if (back) back.click(); // Back closes the tree, research panel stays
      const treeHidden = (document.getElementById('tech-tree') || {}).classList
        ? document.getElementById('tech-tree').classList.contains('hidden') : true;
      const rpOpen = rp && !rp.classList.contains('hidden');
      techtreeux += '/' + (treeHidden && rpOpen ? 'backok' : 'backbad');
    }
  }
  // XIV §48: the own-wonder completion splash reuses the discovery frame — the
  // WONDER COMPLETE card with Go-to-city + Continue exits, no auto-close.
  let wondersplash = 'unchecked';
  if (ctx.discoveryCard && ctx.discoveryCard.showWonder && session.state.cityOrder.length > 0) {
    const wid = Object.keys(session.ruleset.wonders)[0];
    ctx.discoveryCard.showWonder(wid, session.state.cityOrder[0]);
    const card = document.getElementById('discovery-card');
    wondersplash = (document.getElementById('discovery-overlay') ? 'overlay' : 'noverlay')
      + '/' + (card && /WONDER COMPLETE/.test(card.textContent) ? 'kicker' : 'nokicker')
      + '/' + (card && card.querySelector('.dc-continue') && card.querySelector('.dc-goto') ? 'exits' : 'noexits');
    const cont2 = card && card.querySelector('.dc-continue');
    if (cont2) cont2.click();
    wondersplash += '/' + (document.getElementById('discovery-overlay') ? 'stuck' : 'closed');
  }
  // A58 item 4: the Civilopedia search finds an entry by name across categories.
  let pediasearch = 'unchecked';
  if (ctx.pedia && ctx.pedia.open) {
    ctx.pedia.open();
    const input = document.getElementById('pedia-search');
    if (input) {
      input.value = 'Palace';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const items = Array.from(document.querySelectorAll('#pedia-list .pedia-item'));
      pediasearch = 'input/' + (items.some(b => /Palace/.test(b.textContent)) ? 'found' : 'notfound');
      if (items[0]) items[0].click(); // opens the matched article
      input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true }));
    } else pediasearch = 'noinput';
    ctx.pedia.close();
  }
  // XIV §25/§23: the map suppresses the browser context menu; the 'Show unit
  // move' pacing option exists (default ON).
  let inputpacing = 'unchecked';
  {
    const canvas = document.querySelector('canvas');
    let ctxmenu = 'nocanvas';
    if (canvas) {
      const cm = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });
      canvas.dispatchEvent(cm);
      ctxmenu = cm.defaultPrevented ? 'suppressed' : 'notsuppressed';
    }
    const opt = document.querySelector('[data-opt="showUnitMove"]');
    inputpacing = ctxmenu + '/' + (opt ? 'showmove' : 'noshowmove');
  }
  // XIV §22: the research-panel unlock names are pedia hover-links that show the
  // shared hover-card entity summary (the research panel is open in ?e2e=1).
  let hoverinfo = 'unchecked';
  {
    const link = document.querySelector('#research-list .pedia-link');
    if (link && ctx.hoverCard) {
      link.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      const h = document.getElementById('hover-card');
      hoverinfo = (link ? 'link' : 'nolink')
        + '/' + (h && !h.classList.contains('hidden') && h.querySelector('.hover-title') ? 'carded' : 'nocard');
      if (ctx.hoverCard) ctx.hoverCard.hide();
    } else { hoverinfo = link ? 'link/nohover' : 'nolink'; }
  }
  let foodrow = 'nocity';
  if (session.state.cityOrder.length > 0) {
    const cid = session.state.cityOrder[0];
    ctx.panels.openCityPanel(cid);
    // click a worked mini-map tile: unassigns it and switches to manual mode
    const workedCell = document.querySelector('#city-map .ctile.assignable.worked');
    if (workedCell) workedCell.click();
    // XIV §45: the food row must tell the truth about settler upkeep. Inject two
    // settlers HOMED to this city (a probe, not a command — no hash impact) and
    // re-render: the row must show the settler-eat segment + a net that dropped
    // by settlerFoodUpkeep×2 vs the citizen-only figure (the Teotihuacan trap).
    const before = (document.getElementById('city-stats') || {}).textContent || '';
    const netBefore = (before.match(/net ([+-]\d+)/) || [])[1] || '?';
    session.state.units.__probeS1 = { id: '__probeS1', type: 'settlers', owner: ctx.HUMAN, x: 0, y: 0, moves: 1, home: cid };
    session.state.units.__probeS2 = { id: '__probeS2', type: 'settlers', owner: ctx.HUMAN, x: 0, y: 0, moves: 1, home: cid };
    ctx.panels.openCityPanel(cid);
    const after = (document.getElementById('city-stats') || {}).textContent || '';
    const netAfter = (after.match(/net ([+-]\d+)/) || [])[1] || '?';
    foodrow = (/🌾 \d+ · 👥 eat \d+/.test(before) ? 'row' : 'norow')
      + '/' + (/settlers? eat|×2 eat/.test(after) || /⚒👤×2/.test(after) ? 'settlerseg' : 'noseg')
      + '/' + (Number(netAfter) === Number(netBefore) - 2 ? 'nettruth' : `netbad(${netBefore}->${netAfter})`);
    delete session.state.units.__probeS1;
    delete session.state.units.__probeS2;
    ctx.panels.openCityPanel(cid); // restore the honest panel
  }
  // XIV §45a: the unit info card must show the home city (or "unsupported").
  // The founding settler is consumed, so inject a probe unit at the city and
  // render the card directly for both the homed and homeless cases.
  let unithome = 'norender';
  if (ctx.hud && ctx.hud.unitNote && session.state.cityOrder.length > 0) {
    const cid0 = session.state.cityOrder[0];
    const c0 = session.state.cities[cid0];
    const base = { id: '__probeU', type: 'militia', owner: ctx.HUMAN, x: c0.x, y: c0.y, moves: 1 };
    ctx.hud.unitNote(Object.assign({}, base, { home: cid0 }));
    const homedLine = (document.getElementById('unit-line') || {}).textContent || '';
    ctx.hud.unitNote(Object.assign({}, base, { home: undefined }));
    const bareLine = (document.getElementById('unit-line') || {}).textContent || '';
    unithome = (homedLine.indexOf('🏠') !== -1 && homedLine.indexOf(c0.name) !== -1 ? 'home' : 'nohome')
      + '/' + (/unsupported/.test(bareLine) ? 'unsupported' : 'nounsup');
  }
  // XIV §34: the city overview panel lists every own city with yield/econ
  // columns; opening it must show a named row, and a row click opens that city.
  let cityoverview = 'unchecked';
  if (ctx.cityOverview && ctx.cityOverview.open) {
    ctx.cityOverview.open();
    const table = document.getElementById('city-overview-table');
    const rows = table ? table.querySelectorAll('tbody .co-row') : [];
    cityoverview = (table ? 'table' : 'notable')
      + '/' + (rows.length >= 1 ? 'rows' + rows.length : 'norows')
      + '/' + (table && /Testopolis/.test(table.textContent) ? 'named' : 'noname');
    if (rows.length) { rows[0].click(); cityoverview += '/' + (ctx.panels.isCityOpen() ? 'opens' : 'noopen'); }
    ctx.cityOverview.close();
  }
  // XIV §41: the military overview lists own units with A/D/M + a 🔍 zoom-to.
  // Inject a probe unit (no hash impact) so a row exists at turn 1.
  let military = 'unchecked';
  if (ctx.militaryOverview && ctx.militaryOverview.open && session.state.cityOrder.length > 0) {
    const cid0 = session.state.cityOrder[0];
    const c0 = session.state.cities[cid0];
    session.state.units.__probeM = { id: '__probeM', type: 'militia', owner: ctx.HUMAN, x: c0.x, y: c0.y, moves: 1, home: cid0 };
    ctx.militaryOverview.open();
    const table = document.getElementById('military-overview-table');
    const rows = table ? table.querySelectorAll('tbody .mo-row') : [];
    military = (table ? 'table' : 'notable') + '/' + (rows.length >= 1 ? 'rows' + rows.length : 'norows')
      + '/' + (table && table.querySelector('.mo-zoom') ? 'zoom' : 'nozoom')
      + '/' + (table && /\d+\/\d+\/\d+/.test(table.textContent) ? 'adm' : 'noadm');
    ctx.militaryOverview.close();
    delete session.state.units.__probeM;
  }
  // XIV §49: the economic overview's itemized rows must sum EXACTLY to its NET
  // total (the same invariant that keeps it equal to the top-bar (+N)).
  let econ = 'unchecked';
  if (ctx.econOverview && ctx.econOverview.open) {
    ctx.econOverview.open();
    const table = document.getElementById('econ-overview-table');
    if (table) {
      const rows = Array.from(table.querySelectorAll('tbody tr'));
      const num = t => { const m = String(t).replace(/−/g, '-').match(/-?\d+/); return m ? Number(m[0]) : 0; };
      const total = rows.length ? num(rows[rows.length - 1].children[1].textContent) : 0;
      let sum = 0;
      for (let i = 0; i < rows.length - 1; i++) sum += num(rows[i].children[1].textContent);
      econ = 'panel/' + (sum === total ? 'sums' : `mismatch(${sum}!=${total})`);
    } else econ = 'notable';
    ctx.econOverview.close();
  }
  // XIV §43: the "+" affordance on a catalog row enqueues (the touch path), and
  // the "building …" line now lives in the catalog column (#city-build-line).
  let buildqueue = 'unchecked';
  let capital = 'unchecked';
  if (session.state.cityOrder.length > 0) {
    const cid = session.state.cityOrder[0];
    ctx.panels.openCityPanel(cid);
    const before = ctx.buildQueue ? ctx.buildQueue.get(cid).length : -1;
    const add = document.querySelector('#city-catalog .option .opt-add');
    if (add) add.click();
    const after = ctx.buildQueue ? ctx.buildQueue.get(cid).length : -1;
    const buildLine = document.getElementById('city-build-line');
    buildqueue = (add ? 'plus' : 'noplus')
      + '/' + (after === before + 1 ? 'enqueued' : `noq(${before}->${after})`)
      + '/' + (buildLine && /building:/.test(buildLine.textContent) ? 'line' : 'noline');
    // XIV §44: the sole city is the capital → ★ in the title, Palace hidden here.
    const title = document.getElementById('city-title');
    const catalog = document.getElementById('city-catalog');
    capital = (title && /★/.test(title.textContent) ? 'star' : 'nostar')
      + '/' + (catalog && !/Palace/.test(catalog.textContent) ? 'palace-hidden' : 'palace-shown');
  }
  // XIV §33: an incoming diplomacy offer pops the envoy modal (leader + Accept /
  // Reject / Consider-later). Inject a rival's standing offer (a probe, not a
  // command — no hash impact), scan, and assert the modal shows; "Consider
  // later" must dismiss it while the offer PERSISTS in state. Local engine only:
  // ?server=1 fog-filters the view (no writable relations), and this presentation
  // is transport-agnostic, so the local pass covers it.
  let envoy = params.get('server') === '1' ? 'server-skip' : 'unchecked';
  if (envoy === 'unchecked' && ctx.diplomacy && ctx.diplomacy.scanOffers) {
    const rival = (session.state.playerOrder || Object.keys(session.state.players))
      .find(pid => pid !== ctx.HUMAN && pid !== 'barb' && session.state.players[pid] && session.state.players[pid].alive !== false);
    if (rival) {
      const { pairKey } = await import('../shared/diplomacy-view.js');
      const key = pairKey(ctx.HUMAN, rival);
      if (!session.state.relations) session.state.relations = {};
      session.state.relations[key] = { state: 'war', offer: { from: rival, turn: session.state.turn } };
      ctx.diplomacy.scanOffers();
      const m = document.getElementById('envoy-modal');
      const shown = m && !m.classList.contains('hidden');
      const hasBtns = !!(m && m.querySelector('#envoy-accept') && m.querySelector('#envoy-reject') && m.querySelector('#envoy-later'));
      const named = !!(m && m.textContent.indexOf(session.state.players[rival].name) !== -1);
      if (m && m.querySelector('#envoy-later')) m.querySelector('#envoy-later').click();
      const dismissed = !!(m && m.classList.contains('hidden'));
      const persists = !!(session.state.relations[key] && session.state.relations[key].offer);
      envoy = (shown ? 'shown' : 'noshow') + '/' + (hasBtns ? 'btns' : 'nobtns')
        + '/' + (named ? 'named' : 'noname') + '/' + (dismissed ? 'later' : 'nolater')
        + '/' + (persists ? 'persists' : 'gone');
      delete session.state.relations[key];
    }
  }
  // XIV §35: a transient message carrying coords gets a 🔍 zoom-to (panning via
  // renderer.centerOn); a message without coords shows no icon.
  let zoomto = 'unchecked';
  if (ctx.hud && ctx.hud.flash) {
    ctx.hud.flash('probe with loc', { x: 3, y: 4 });
    const fb = document.getElementById('flash-banner');
    const zb = fb && fb.querySelector('.banner-zoom');
    if (zb) zb.click(); // pans via renderer.centerOn — must not throw
    ctx.hud.flash('probe no loc');
    const withoutIcon = !!(fb && fb.querySelector('.banner-zoom'));
    zoomto = (zb ? 'icon' : 'noicon') + '/' + (withoutIcon ? 'stuck' : 'clean');
  }
  // docs/07: exercise the save path so the persistent game-code toast renders
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true }));
  // B15: clicking ANYWHERE on the toast must hide it (the unmissable dismiss)
  const toastEl = document.getElementById('code-toast');
  if (toastEl) toastEl.click();
  const bodyClickDisplay = toastEl ? getComputedStyle(toastEl).display : 'missing';
  // B6: re-show, then the ✕ must ALSO actually hide it — record the computed
  // display after the click (a class-only check would pass with no CSS rule)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F5', bubbles: true }));
  const toastX = document.getElementById('code-toast-x');
  if (toastX) toastX.click();
  // #3: the bug-report dialog opens and assembles a payload with the recording
  // attached (the free-text + Shift+D recording contract), then closes clean.
  let bugAttached = 'none';
  if (ctx.bugReport) {
    ctx.bugReport.open();
    const bugDialog = document.getElementById('bug-report');
    const payload = ctx.bugReport.buildPayload('e2e probe');
    bugAttached = (bugDialog ? 'open' : 'missing')
      + '/' + (payload && payload.diagnostics && Array.isArray(payload.diagnostics.log) ? 'log' + payload.diagnostics.log.length : 'nolog')
      + '/' + (payload && payload.text === 'e2e probe' ? 'text' : 'notext');
    const bugX = document.getElementById('bug-x');
    if (bugX) bugX.click(); // close it so the screenshot path is unobstructed
  }
  // XIV §20: the "press E" no-moves hint is ONE builder honoring the mute
  // option + carrying the 🔕. Not muted → the center banner shows with #mute-hint;
  // muted → nothing shows (returns false). Both the auto path and input.js's N
  // path route through ctx.hud.noMovesHint.
  let ehint = 'none';
  if (ctx.hud && ctx.hud.noMovesHint && ctx.options) {
    ctx.options.set('hideNoMovesHint', false);
    const shownRet = ctx.hud.noMovesHint();
    const muteBtn = document.getElementById('mute-hint');
    ctx.options.set('hideNoMovesHint', true);
    if (ctx.hud.banner) document.getElementById('center-banner').textContent = '';
    const mutedRet = ctx.hud.noMovesHint();
    const muteBtn2 = document.getElementById('mute-hint');
    ehint = (shownRet && muteBtn ? 'shown' : 'noshow')
      + '/' + (!mutedRet && !muteBtn2 ? 'muted' : 'notmuted');
    ctx.options.set('hideNoMovesHint', false); // restore
    document.getElementById('center-banner').textContent = '';
  }
  // XIV §5+§8: the ⚙ Options panel carries always-visible Save/Load buttons
  // (the touch-device save path) wired to the same actions as Shift+S/L.
  const optSave = document.getElementById('opt-save');
  const optLoad = document.getElementById('opt-load');
  const saveLoad = (optSave ? 'save' : 'nosave') + '/' + (optLoad ? 'load' : 'noload')
    + '/' + (ctx.saves && ctx.saves.saveGame && ctx.saves.loadGame ? 'wired' : 'unwired');
  probe.textContent += ' · toastBodyClickDisplay: ' + bodyClickDisplay
    + ' · toastDisplay: ' + (toastEl ? getComputedStyle(toastEl).display : 'missing')
    + ' · code: ' + (ctx.gameCode() || 'none')
    + ' · gameId: ' + (session.gameId || 'none') // server's real id (404-fix regression guard)
    + ' · diaglog: ' + session.log.length // recorder captured the commands
    + ' · bugreport: ' + bugAttached // #3: dialog opened + payload assembled with the recording
    + ' · saveload: ' + saveLoad // XIV §5+§8: Options Save/Load buttons present + wired
    + ' · ehint: ' + ehint // XIV §20: unified no-moves hint (🔕 shown / muted honored)
    + ' · foodrow: ' + foodrow // XIV §45: settler upkeep truth in the city food row
    + ' · hudpolish: ' + hudpolish // XIV §1/§9/§21/§28: rates+gov, tech-tree in panel, summary reopen
    + ' · hoverinfo: ' + hoverinfo // XIV §22: research-panel pedia hover-links + shared card
    + ' · discovery: ' + discovery // XIV §26: celebration overlay (kicker + two exits, no auto-close)
    + ' · techtreeux: ' + techtreeux // XV §3/§4: View-Tech-Tree in panel + tree Back/Close-research footer
    + ' · wondersplash: ' + wondersplash // XIV §48: own-wonder completion splash (reuses the discovery frame)
    + ' · pediasearch: ' + pediasearch // A58 item 4: Civilopedia search finds an entry by name
    + ' · inputpacing: ' + inputpacing // XIV §25/§23: contextmenu suppressed + Show unit move option
    + ' · unithome: ' + unithome // XIV §45a: unit card shows the home city
    + ' · cityoverview: ' + cityoverview // XIV §34: overview panel lists cities + row opens the city
    + ' · military: ' + military // XIV §41: military overview lists units with A/D/M + 🔍 zoom-to
    + ' · econ: ' + econ // XIV §49: economic overview rows sum exactly to the NET total
    + ' · buildqueue: ' + buildqueue // XIV §43: catalog "+" enqueues + the build line moved to the catalog
    + ' · capital: ' + capital // XIV §44: capital ★ in the title + Palace hidden from the capital's catalog
    + ' · envoy: ' + envoy // XIV §33: incoming-offer modal (Accept/Reject/Consider-later, persists)
    + ' · zoomto: ' + zoomto // XIV §35: 🔍 zoom-to on coord-bearing transient messages
    + ' · errors: ' + capturedErrors.length; // hover sweep etc. must stay clean
  if (params.get('e2eclose') === '1') ctx.panels.closeAll(); // unobstructed screenshots
}

// ?e2e=2 (with &humans=2): scripted hotseat hand-off — end player 1's turn
// (twice: the first press is the units-still-have-moves confirmation) so the
// opaque hand-off screen for player 2 is up when --dump-dom fires.
if (params.get('e2e') === '2') {
  await ctx.endTurn();
  await ctx.endTurn();
}

// ?e2e=3 (with &humans=2): B1 regression — a GoTo must survive a hotseat
// hand-off (input.js: owner-filtered runAllGotos + autoSelectAfterTurn on the
// human→human path). Both players arm a REAL GoTo through the pick path
// ('g' + a canvas click); the probe records each unit's position at
// start / after-arm / final so the browser test can assert that p1's leg 2
// ran at the hand-back and that p2's unit never moved during p1's turn.
if (params.get('e2e') === '3' && firstUnit && firstUnit.type === 'settlers') {
  const canvas = document.querySelector('#app canvas');
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const map = session.state.map;
  const pos = id => { const u = session.state.units[id]; return u ? `${u.x},${u.y}` : 'gone'; };
  const tick = () => new Promise(r => setTimeout(r, 120));

  // target scan: same greedy rule as input.js gotoStep (strictly-closer
  // options, stable-sorted, first passable wins), with land as the
  // apply-succeeds proxy — a settler's step onto land always succeeds this
  // early. The raycast pick can land one tile off, so a target only
  // qualifies when it AND all 8 neighbors offer two greedy legs.
  const VEC = { N: [0, -1], NE: [1, -1], E: [1, 0], SE: [1, 1], S: [0, 1], SW: [-1, 1], W: [-1, 0], NW: [-1, -1] };
  const wrapDist = (ax, ay, bx, by) => {
    let dx = Math.abs(ax - bx);
    if (map.wrapX && map.width - dx < dx) dx = map.width - dx;
    const dy = Math.abs(ay - by);
    return dx > dy ? dx : dy;
  };
  const isLand = (x, y) => ruleset.terrain.terrains[map.tiles[y * map.width + x].t].domain === 'land';
  function greedyStep(cx, cy, tx, ty) {
    const here = wrapDist(cx, cy, tx, ty);
    const options = Object.keys(VEC).map(dir => {
      let nx = cx + VEC[dir][0];
      if (map.wrapX) nx = ((nx % map.width) + map.width) % map.width;
      return { nx, ny: cy + VEC[dir][1], d: wrapDist(nx, cy + VEC[dir][1], tx, ty) };
    }).filter(o => o.d < here && o.ny >= 0 && o.ny < map.height).sort((a, b) => a.d - b.d);
    for (const o of options) if (isLand(o.nx, o.ny)) return o;
    return null;
  }
  function twoLegs(sx, sy, tx, ty) {
    if (wrapDist(sx, sy, tx, ty) < 3) return false;
    const s1 = greedyStep(sx, sy, tx, ty);
    return s1 !== null && greedyStep(s1.nx, s1.ny, tx, ty) !== null;
  }
  function findTarget(u) {
    for (let D = 6; D >= 4; D--) {
      for (const dir of Object.keys(VEC)) {
        const tx = ((u.x + VEC[dir][0] * D) % map.width + map.width) % map.width;
        const ty = u.y + VEC[dir][1] * D;
        if (ty < 2 || ty >= map.height - 2) continue;
        let ok = true;
        for (let dy = -1; dy <= 1 && ok; dy++) {
          for (let dx = -1; dx <= 1 && ok; dx++) {
            const nx = ((tx + dx) % map.width + map.width) % map.width;
            if (!twoLegs(u.x, u.y, nx, ty + dy)) ok = false;
          }
        }
        if (ok) return { tx, ty };
      }
    }
    return null;
  }

  // arm a GoTo the way a player does: select, press G, click the destination
  // (centerOn puts the target tile under the canvas center for the raycast)
  async function armGoto(unit, tx, ty) {
    ctx.selectUnit(unit);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
    renderer.centerOn(tx, ty);
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, bubbles: true }));
    await tick(); // the pick handler fires runGoto without awaiting — let leg 1 land
  }

  const u1 = firstUnit.id;
  const t1 = findTarget(session.state.units[u1]);
  const p1start = pos(u1);
  if (t1) await armGoto(session.state.units[u1], t1.tx, t1.ty);
  const p1arm = pos(u1);
  await ctx.endTurn(); // leg 1 spent the settler's move — no confirmation needed
  // the hand-off curtain is up for player 2: any key confirms it
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
  const u2 = Object.values(session.state.units).find(u => u.owner === ctx.HUMAN && u.moves > 0);
  const t2 = u2 ? findTarget(u2) : null;
  const p2start = u2 ? pos(u2.id) : 'none';
  if (u2 && t2) await armGoto(u2, t2.tx, t2.ty);
  const p2arm = u2 ? pos(u2.id) : 'none';
  await ctx.endTurn(); // wraps the turn (moves refresh); the hand-back must run p1's queued route
  const p1final = pos(u1);
  const p2mid = u2 ? pos(u2.id) : 'none'; // p2 must not have moved on p1's turn
  // one more half-round: p2's route must have SURVIVED p1's turn-start
  // (an unfiltered runAllGotos would have cancelled it with notYourUnit
  // rejections — invisible in positions until p2's own next turn)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }));
  await ctx.endTurn(); // p1 -> p2 hand-off runs p2's queued leg 2
  probe.textContent = `goto p1 ${p1start} ${p1arm} ${p1final}`
    + ` p2 ${p2start} ${p2arm} ${p2mid} ${u2 ? pos(u2.id) : 'none'}`
    + ` targets ${t1 ? `${t1.tx},${t1.ty}` : 'none'} ${t2 ? `${t2.tx},${t2.ty}` : 'none'}`
    + ` errors: ${capturedErrors.length}`;
}

// ?e2e=5 (A28): mid-glide click. Deselect, step the settler one tile, then
// click its DESTINATION tile while the render-layer glide is still in
// flight — the pick must resolve to the LOGICAL tile (castAt reads
// view.units, never the tween), re-selecting the settler at its new home
// mid-animation. The probe carries the destination coords so the test can
// assert the unit line names the logical tile.
if (params.get('e2e') === '5' && firstUnit && firstUnit.type === 'settlers') {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const canvas = document.querySelector('#app canvas');
  const clickCenter = () => {
    const r = canvas.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, bubbles: true }));
  };
  const unitLine = document.getElementById('unit-line');
  // deselect first (far empty tile), so the mid-glide click must do the
  // real selection work — the unit line hides on deselect
  const u0 = session.state.units[firstUnit.id];
  renderer.centerOn(u0.x + (u0.x > 6 ? -5 : 5), u0.y);
  clickCenter();
  const clearedLine = unitLine.classList.contains('hidden');
  // one step in the first direction the engine accepts; the glide starts in
  // the same synchronous refresh chain, so no clock ticks before the click
  let moved = '';
  for (const dir of ['E', 'W', 'N', 'S', 'NE', 'SE', 'SW', 'NW']) {
    const r = await session.apply({ type: 'moveUnit', playerId: session.state.activePlayer, unitId: firstUnit.id, dir });
    if (r.ok) { moved = dir; break; }
  }
  const u = session.state.units[firstUnit.id];
  const busy = renderer.animBusy ? renderer.animBusy() : 'noapi';
  renderer.centerOn(u.x, u.y); // the destination tile sits under the canvas center
  clickCenter();
  probe.textContent = `e2e5 moved:${moved} dest:(${u.x},${u.y}) busy:${busy}`
    + ` clearedLine:${clearedLine} selLine:[${unitLine.classList.contains('hidden') ? '' : unitLine.textContent}]`
    + ` errors:${capturedErrors.length}`;
}

// ?e2e=6 (A29): rate-slider snapback + HUD civ + turn-button state. Drag the
// science slider to 100 — despotism caps rates, the engine rejects, and the
// thumb must SNAP BACK to the real rate instead of staying where the drag
// died. The probe also carries the status line (VI.1 civ format) and the
// End-Turn disabled state on the viewer's own turn (VI.6: must be enabled).
if (params.get('e2e') === '6') {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const slider = document.getElementById('rate-slider');
  slider.value = '100';
  slider.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 150)); // the async reject + snapback
  const me = session.state.players[ctx.HUMAN];
  const sciNow = me.sciRate === undefined ? session.ruleset.rules.defaultSciRate : me.sciRate;
  probe.textContent = `e2e6 slider:${slider.value} sci:${sciNow}`
    + ` status:[${document.getElementById('hud-status').textContent}]`
    + ` endTurnDisabled:${document.getElementById('end-turn').disabled}`
    + ` errors:${capturedErrors.length}`;
}

// ?logdemo=1 (A39 screenshots): seed the turn log with one entry per filter
// class, open it with the filter row showing; &logdemooff=cities (or any
// class) unchecks that box so the shot proves the entries vanish
if (params.get('logdemo') === '1') {
  const note = ctx.turnlog.note;
  note('⚔ Roman Legion defeated Zulu Militia at (12,9)', 'win', null, 'combat');
  note('🏛 Testopolis founded', 'win', null, 'cities');
  note('🔬 Bronze Working discovered', 'win', null, 'research');
  note('👀 Zulus founded Zimbabwe', '', null, 'rival');
  note('🏆 The Pyramids completed in a Zulu city', 'loss', null, 'world');
  note('💾 saved · code FWN6-X6PQ-3X5TD', '', null, 'saves');
  document.getElementById('turn-log').open = true;
  document.getElementById('log-filter-toggle').click();
  const off = params.get('logdemooff');
  if (off) {
    for (const box of document.querySelectorAll('#log-filter-boxes input')) {
      if (box.parentElement.textContent.trim().endsWith(off)) box.click();
    }
  }
}

// ?e2e=7 (A30): the chunked AI round must repaint the HUD between AI
// players — a MutationObserver watches the wait line show "<civ> (AI) is
// moving" DURING a local endTurn, which was impossible while the round ran
// as one synchronous batch. Two presses: the first is the units-still-have-
// moves confirmation.
if (params.get('e2e') === '7') {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const waitEl = document.getElementById('wait-line');
  let seenText = '';
  const obs = new MutationObserver(() => {
    if (!waitEl.classList.contains('hidden') && waitEl.textContent) {
      seenText = waitEl.textContent;
    }
  });
  obs.observe(waitEl, { attributes: true, childList: true, characterData: true, subtree: true });
  await ctx.endTurn();
  await ctx.endTurn();
  obs.disconnect();
  probe.textContent = `e2e7 seen:[${seenText}]`
    + ` hidden:${waitEl.classList.contains('hidden')} errors:${capturedErrors.length}`;
}

// ?e2e=8 (A46, server mode): reconnect coverage — sever the live socket and
// assert session-remote's 1/s retry loop reclaims the seat with the stored
// token and the HUD recovers. The reconnect announces itself via the
// stateReplaced marker (A30), which is exactly what the probe listens for.
if (params.get('e2e') === '8' && session.dropSocket) {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  session.onChange((_s, ev) => {
    if (ev.some(e => e.type === 'stateReplaced')) probe.dataset.reconnected = '1';
  });
  session.dropSocket();
  const poll = setInterval(() => {
    if (probe.dataset.reconnected === '1') {
      clearInterval(poll);
      probe.textContent = `e2e8 reconnected:true`
        + ` hud:[${document.getElementById('hud-status').textContent}]`
        + ` seatCode:${session.seatCode ? 'present' : 'missing'}`
        + ` errors:${capturedErrors.length}`;
    }
  }, 200);
}

// ?e2e=4 (with &server=1 in a 2-human game): B3 regression — ending my turn
// while the OTHER human is next must NOT take the hotseat hand-off path in
// server mode (it flipped ctx.HUMAN to the rival, whose filtered view entry
// carries no techs/gold, so the research panel crashed in researchCost).
if (params.get('e2e') === '4') {
  const probe = document.createElement('div');
  probe.id = 'e2e-probe';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  await ctx.endTurn(); // first call arms the units-still-have-moves confirm
  await ctx.endTurn(); // second call ends the turn; next seat is the rival human
  try {
    ctx.panels.toggleResearchPanel(); // crashed pre-fix (rival ctx.HUMAN)
  } catch (e) {
    capturedErrors.push(`research panel: ${e.message}`);
  }
  probe.textContent = `e2e4 human:${ctx.HUMAN} active:${session.state.activePlayer}`
    + ` handoffOpen:${ctx.handoff.isOpen()} errors:${capturedErrors.length}`;
}
