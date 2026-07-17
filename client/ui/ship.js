// H8 (A76 space race, specs/a76-space-race.md §Client): the GRAPHICAL
// spaceship screen — the assembly renders visually as parts complete
// (structure frame filling in, components/modules attaching, the Civ1
// diagram spirit through the house flat style), plus the characteristics
// table (the wiki panel contract), the launch button with an
// irreversibility confirm, and the rival-launch banner (the race is
// public). Full-screen overlay on the pedia precedent; 🚀 corner button.
// Client-only + golden-neutral: reads state, issues only launchShip.
//
// ---- MOCK-FIRST SEAM (architect #1292) -------------------------------------
// The engine half (N17) is in flight, so the §3 math below (functionalCounts /
// isViable / shipStats) is a LOCAL MIRROR of engine/spaceship.js driven by
// rules.ssFlight/ssParts with spec-constant fallbacks. When N17 commits, this
// block DELETES and the three names import from '../../engine/spaceship.js'.
// ----------------------------------------------------------------------------
import { wonderActive } from '../../engine/cities.js';

// A45: capture at module eval — main.js canonicalizes the URL after boot.
// ?ship=1 forces the 🚀 button + a mock preview ship (screenshots/dev before
// the engine half lands; the launch button stays disabled on mock data).
const SHIP_PREVIEW = new URLSearchParams(location.search).get('ship') === '1';

const FALLBACK_FLIGHT = {
  gateWonder: 'apollo-program', colonistsPerHab: 10000, arrivalScoreDivisor: 200,
  structuralSlotsNum: 28, structuralSlotsDen: 39, flightMassPerEngine: 1600,
  flightYearsMin: 5, successFlightFreeYears: 15
};
const FALLBACK_PARTS = {
  structural: { cost: 80, mass: 100, max: 39 },
  propulsion: { cost: 160, mass: 400, max: 8 },
  fuel: { cost: 160, mass: 400, max: 8 },
  habitation: { cost: 320, mass: 1600, max: 4 },
  lifeSupport: { cost: 320, mass: 1600, max: 4 },
  solar: { cost: 320, mass: 400, max: 4 }
};
const NONSTRUCT = ['propulsion', 'fuel', 'habitation', 'lifeSupport', 'solar'];

function idiv(a, b) { return Math.floor(a / b); }
function count(ship, key) { return (ship && ship[key] !== undefined) ? ship[key] : 0; }
function flightRules(ruleset) { return ruleset.rules.ssFlight || FALLBACK_FLIGHT; }
function partRules(ruleset) { return ruleset.rules.ssParts || FALLBACK_PARTS; }

function functionalCounts(ship, ruleset) {
  const f = flightRules(ruleset);
  let supported = idiv(count(ship, 'structural') * f.structuralSlotsNum, f.structuralSlotsDen);
  const fn = {};
  for (const k of NONSTRUCT) {
    const take = Math.min(count(ship, k), supported);
    fn[k] = take;
    supported -= take;
  }
  return fn;
}

function isViable(ship, ruleset) {
  if (!ship) return false;
  const fn = functionalCounts(ship, ruleset);
  return fn.propulsion >= 1 && fn.fuel >= 1 && fn.habitation >= 1
    && fn.lifeSupport >= 1 && fn.solar >= 1;
}

function shipStats(ship, ruleset) {
  const f = flightRules(ruleset);
  const P = partRules(ruleset);
  const fn = functionalCounts(ship, ruleset);
  const population = fn.habitation * f.colonistsPerHab;
  const supportPct = Math.min(100, idiv(fn.lifeSupport * 100, Math.max(1, fn.habitation)));
  const energyPct = Math.min(100, idiv(fn.solar * 2 * 100, Math.max(1, fn.habitation + fn.lifeSupport)));
  let mass = 0;
  for (const k of Object.keys(P)) mass += count(ship, k) * P[k].mass;
  const poweredEngines = Math.min(fn.propulsion, fn.fuel);
  const fuelPct = fn.propulsion === 0 ? 0 : idiv(Math.min(fn.fuel, fn.propulsion) * 100, fn.propulsion);
  const flightYears = Math.max(f.flightYearsMin,
    idiv(mass * 10, Math.max(1, poweredEngines * f.flightMassPerEngine)));
  let successPct = 0;
  if (isViable(ship, ruleset)) {
    successPct = Math.max(5, Math.min(100,
      idiv(supportPct + energyPct, 2) - idiv(Math.max(0, flightYears - f.successFlightFreeYears), 2)));
  }
  return { population, supportPct, energyPct, mass, fuelPct, flightYears, successPct };
}
// ---- end mock mirror -------------------------------------------------------

// A partial assembly with a structural shortfall: supported = idiv(16*28,39)
// = 11 slots, consumed by propulsion+fuel in the canonical order, so the
// modules render non-functional (the red-box mechanic on screen).
const MOCK_SHIP = { structural: 16, propulsion: 6, fuel: 5, habitation: 3, lifeSupport: 2, solar: 2, launched: 0 };
const MOCK_FULL = { structural: 39, propulsion: 8, fuel: 8, habitation: 4, lifeSupport: 4, solar: 4, launched: 0 };

const PART_LABELS = {
  structural: 'Structural', propulsion: 'Propulsion', fuel: 'Fuel',
  habitation: 'Habitation', lifeSupport: 'Life Support', solar: 'Solar Panel'
};

// --- the assembly diagram (inline SVG, flat house style) --------------------
// Every SLOT is always drawn: unbuilt = faint outline (the frame visibly
// fills in), built+functional = solid, built beyond the structurally
// supported count = dimmed with a red edge (Civ1's red-box rule).
function slotClass(i, built, functional) {
  if (i < functional) return 'ss-built';
  if (i < built) return 'ss-dead';
  return 'ss-empty';
}

function drawShip(ship, ruleset) {
  const P = partRules(ruleset);
  const fn = functionalCounts(ship, ruleset);
  const el = [];
  // structural spine: max slots as a 3-wide truss ladder up the middle
  const sMax = P.structural.max, sBuilt = count(ship, 'structural');
  for (let i = 0; i < sMax; i++) {
    const col = i % 3, row = idiv(i, 3); // 13 rows x 3
    const x = 150 + col * 20, y = 470 - row * 34;
    el.push(`<rect class="ss-truss ${i < sBuilt ? 'ss-built' : 'ss-empty'}"
      x="${x}" y="${y}" width="16" height="30" rx="2"/>`);
  }
  // propulsion: engine bells across the base (8)
  const pB = count(ship, 'propulsion');
  for (let i = 0; i < P.propulsion.max; i++) {
    const x = 62 + i * 30, y = 512;
    el.push(`<path class="ss-engine ${slotClass(i, pB, fn.propulsion)}"
      d="M${x} ${y} l20 0 l6 22 l-32 0 z"/>`);
  }
  // fuel: tanks in a row above the engines (8)
  const fB = count(ship, 'fuel');
  for (let i = 0; i < P.fuel.max; i++) {
    const x = 60 + i * 30, y = 478;
    el.push(`<rect class="ss-fuel ${slotClass(i, fB, fn.fuel)}"
      x="${x}" y="${y}" width="24" height="28" rx="10"/>`);
  }
  // habitation: 4 large domes, upper left column
  const hB = count(ship, 'habitation');
  for (let i = 0; i < P.habitation.max; i++) {
    const y = 90 + i * 78;
    el.push(`<circle class="ss-hab ${slotClass(i, hB, fn.habitation)}"
      cx="100" cy="${y}" r="30"/>`);
  }
  // life support: 4 boxes, upper right column
  const lB = count(ship, 'lifeSupport');
  for (let i = 0; i < P.lifeSupport.max; i++) {
    const y = 66 + i * 78;
    el.push(`<rect class="ss-life ${slotClass(i, lB, fn.lifeSupport)}"
      x="232" y="${y}" width="48" height="48" rx="6"/>`);
  }
  // solar: 4 panel wings, two per side at the top
  const oB = count(ship, 'solar');
  for (let i = 0; i < P.solar.max; i++) {
    const left = i % 2 === 0;
    const x = left ? 6 : 296, y = 28 + idiv(i, 2) * 46;
    el.push(`<g class="ss-solar ${slotClass(i, oB, fn.solar)}">
      <rect x="${x}" y="${y}" width="58" height="30" rx="2"/>
      <line x1="${x + 19}" y1="${y}" x2="${x + 19}" y2="${y + 30}"/>
      <line x1="${x + 38}" y1="${y}" x2="${x + 38}" y2="${y + 30}"/>
    </g>`);
  }
  // nose cone
  el.push(`<path class="ss-truss ${sBuilt >= sMax ? 'ss-built' : 'ss-empty'}" d="M150 26 l18 -22 l18 22 z"/>`);
  return `<svg id="ship-svg" viewBox="0 0 360 544" role="img" aria-label="spaceship assembly">${el.join('')}</svg>`;
}

export function initShip(ctx) {
  const { session, hud } = ctx;

  const overlay = document.createElement('div');
  overlay.id = 'ship-screen';
  overlay.className = 'hidden';
  overlay.innerHTML = `
    <div id="ship-frame">
      <div id="ship-head"><h2>🚀 Spaceship</h2><button id="ship-close" title="close (Esc)">✕</button></div>
      <div id="ship-body">
        <div id="ship-diagram"></div>
        <div id="ship-side">
          <div id="ship-parts"></div>
          <div id="ship-stats"></div>
          <div id="ship-status"></div>
          <div id="ship-launch-row" class="hidden">
            <button id="ship-launch">Launch</button>
            <span id="ship-confirm" class="hidden">launch is IRREVERSIBLE — no recall, and a captured
              capital destroys the ship mid-flight
              <button id="ship-launch-yes">Confirm launch</button>
              <button id="ship-launch-no">Cancel</button></span>
          </div>
          <div id="ship-preset" class="hidden">mock preview:
            <button data-mock="partial">partial</button>
            <button data-mock="full">full ship</button></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const diagramEl = overlay.querySelector('#ship-diagram');
  const partsEl = overlay.querySelector('#ship-parts');
  const statsEl = overlay.querySelector('#ship-stats');
  const statusEl = overlay.querySelector('#ship-status');
  const launchRow = overlay.querySelector('#ship-launch-row');
  const confirmEl = overlay.querySelector('#ship-confirm');
  const launchBtn = overlay.querySelector('#ship-launch');
  const presetEl = overlay.querySelector('#ship-preset');

  let mockShape = MOCK_SHIP; // ?ship=1 preview only

  // the viewpoint player's ship, or the mock under ?ship=1 — never cache HUMAN
  function myShip() {
    const me = session.state.players[ctx.HUMAN];
    if (me && me.spaceship) return { ship: me.spaceship, mock: false };
    if (SHIP_PREVIEW) return { ship: mockShape, mock: true };
    return { ship: null, mock: false };
  }

  function apollo() {
    const f = flightRules(session.ruleset);
    return session.ruleset.wonders[f.gateWonder] !== undefined
      && wonderActive(session.state, f.gateWonder, session.ruleset);
  }

  function render() {
    const { ship, mock } = myShip();
    const ruleset = session.ruleset;
    const P = partRules(ruleset);
    const shown = ship || { launched: 0 };
    diagramEl.innerHTML = drawShip(shown, ruleset)
      + (mock ? '<div id="ship-mock-note">PREVIEW — mock data (?ship=1)</div>' : '');
    const fn = functionalCounts(shown, ruleset);
    partsEl.innerHTML = Object.keys(P).map(k => {
      const built = count(shown, k), dead = k === 'structural' ? 0 : built - fn[k];
      return `<div class="ship-part-row"><span>${PART_LABELS[k]}</span>
        <b>${built}/${P[k].max}${dead > 0 ? ` <i class="ship-dead-note">(${dead} unsupported)</i>` : ''}</b></div>`;
    }).join('');
    const st = shipStats(shown, ruleset);
    statsEl.innerHTML = [
      ['Population', st.population.toLocaleString('en-US') + ' colonists'],
      ['Life support', st.supportPct + '%'],
      ['Energy', st.energyPct + '%'],
      ['Mass', st.mass.toLocaleString('en-US') + ' tons'],
      ['Fuel', st.fuelPct + '%'],
      ['Flight time', st.flightYears + ' years'],
      ['Success chance', st.successPct + '%']
    ].map(([l, v]) => `<div class="ship-stat"><span>${l}</span><b>${v}</b></div>`).join('');

    const launched = shown.launched !== undefined && shown.launched !== 0;
    const viable = isViable(shown, ruleset);
    confirmEl.classList.add('hidden');
    launchBtn.classList.remove('hidden');
    if (launched) {
      const left = shown.arrivalTurn - session.state.turn;
      statusEl.textContent = `Launched on turn ${shown.launched} — arrival turn ${shown.arrivalTurn}`
        + (left > 0 ? ` (${left} turn${left === 1 ? '' : 's'} to go)` : '');
      launchRow.classList.add('hidden');
    } else if (!ship) {
      statusEl.textContent = apollo()
        ? 'No parts built yet — cities build spaceship parts like improvements once the techs are in.'
        : 'Spaceship construction opens once any civilization completes the Apollo Program.';
      launchRow.classList.add('hidden');
    } else {
      statusEl.textContent = viable
        ? 'The ship is viable and ready to launch.'
        : 'Not yet viable — a launch needs a working propulsion + fuel pair and one functional module of each type.';
      const mine = !mock && !ctx.SPECTATOR && session.state.activePlayer === ctx.HUMAN;
      launchRow.classList.toggle('hidden', !(mine && viable && apollo()));
    }
    presetEl.classList.toggle('hidden', !mock);
  }

  function open() { overlay.classList.remove('hidden'); render(); }
  function close() { overlay.classList.add('hidden'); }
  overlay.querySelector('#ship-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });

  launchBtn.addEventListener('click', () => {
    launchBtn.classList.add('hidden');
    confirmEl.classList.remove('hidden');
  });
  overlay.querySelector('#ship-launch-no').addEventListener('click', () => {
    confirmEl.classList.add('hidden');
    launchBtn.classList.remove('hidden');
  });
  overlay.querySelector('#ship-launch-yes').addEventListener('click', async () => {
    const res = await session.apply({ type: 'launchShip', playerId: ctx.HUMAN });
    if (res && res.ok === false) hud.banner(`launch rejected: ${res.reason}`);
    render();
  });
  presetEl.addEventListener('click', e => {
    const b = e.target.closest('button[data-mock]');
    if (!b) return;
    mockShape = b.dataset.mock === 'full' ? MOCK_FULL : MOCK_SHIP;
    render();
  });

  // 🚀 corner button — appears once the race exists for this viewpoint
  // (Apollo built anywhere, own parts underway, or the ?ship=1 preview)
  const corner = document.getElementById('corner-buttons');
  let btn = null;
  if (corner) {
    btn = document.createElement('button');
    btn.id = 'open-ship'; btn.title = 'spaceship'; btn.textContent = '🚀';
    btn.className = 'hidden';
    corner.insertBefore(btn, corner.firstChild);
    btn.addEventListener('click', () => overlay.classList.contains('hidden') ? open() : close());
  }
  function refreshButton() {
    if (!btn) return;
    const me = session.state.players[ctx.HUMAN];
    btn.classList.toggle('hidden', !(SHIP_PREVIEW || (me && me.spaceship) || apollo()));
  }
  refreshButton();

  session.onChange((state, events) => {
    for (const e of events || []) {
      if (e.type === 'shipLaunched') {
        const who = state.players[e.playerId];
        hud.banner(e.playerId === ctx.HUMAN
          ? `🚀 Your spaceship is away — arrival on turn ${e.arrivalTurn}`
          : `🚀 ${who ? who.name : e.playerId} has LAUNCHED a spaceship — arrival on turn ${e.arrivalTurn}!`);
      } else if (e.type === 'shipDestroyed' && e.playerId === ctx.HUMAN) {
        hud.banner('☄ Your spaceship was destroyed with the capital — a new one may be built');
      }
    }
    refreshButton();
    if (!overlay.classList.contains('hidden')) render();
  });

  return { open, close };
}
