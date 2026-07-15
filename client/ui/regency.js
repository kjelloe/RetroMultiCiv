// A40 slice 2: AI regency — "let the AI take over for me". A 🤖 button left
// of End Turn opens a stance dialog; while a regent plays your seat, End Turn
// grays to "Auto Turn" (hud.js) and the AI ends your turns automatically.
// Regency is UI/session state, NEVER game state — the regent's commands log
// as ordinary cmd entries so replay needs nothing new (docs/08 §7).
//
// LOCAL games: the session drives the seat (session.regentTurn + this
// module's onChange re-kick). SERVER games: the SERVER drives regent seats;
// this module just sends {t:'regent', stance|null} and reflects the state.
// Captured at MODULE EVAL — main.js canonicalizes the URL after boot
// (history.replaceState drops unknown params), so a live location.search read
// would miss ?regentdemo (the A45 overlays trap).
import { createRegentDriver } from './regent-driver.js';

const PARAMS = new URLSearchParams(location.search);

const STANCES = [
  ['balanced', 'Balanced', 'well-rounded play'],
  ['defensive', 'Defensive', 'garrison and hold'],
  ['aggressive', 'Aggressive', 'build armies, attack'],
  ['science', 'Science', 'tech and libraries first'],
  ['growth', 'Growth', 'settlers and food first']
];

export function initRegency(ctx) {
  const { session } = ctx;
  const local = session.gameId === undefined; // hotseat/solo drive here
  // B11: the drive loop lives in regent-driver.js (DOM-free, unit-tested)
  const driver = local ? createRegentDriver(session, () => ctx.HUMAN) : null;

  // 🤖 button, left of End Turn
  const btn = document.createElement('button');
  btn.id = 'regent-btn';
  btn.textContent = '🤖';
  btn.title = 'let the AI play this seat (auto turn)';
  document.body.appendChild(btn);

  const dialog = document.createElement('div');
  dialog.id = 'regent-dialog';
  dialog.className = 'panel hidden';
  dialog.innerHTML = '<div class="panel-head"><h3>🤖 Hand your seat to the AI</h3>'
    + '<button class="panel-close" data-close="regent-dialog">✕</button></div>'
    + '<p class="setup-hint">the AI ends your turns automatically until you take back control</p>'
    + STANCES.map(([id, name, blurb]) =>
      `<button class="regent-stance" data-stance="${id}">${name} <span class="regent-blurb">— ${blurb}</span></button>`).join('')
    + '<button id="regent-off" class="hidden">✋ Take back control</button>';
  document.body.appendChild(dialog);

  function myRegent() {
    // server: seats carry it via the view's presence flags; local: session
    return local ? session.regents[ctx.HUMAN]
      : (session.regentStance ? session.regentStance() : undefined);
  }

  function setRegent(stance) {
    if (local) {
      session.setRegent(ctx.HUMAN, stance);
      if (stance !== null) drive();
    } else if (session.send) {
      session.send({ t: 'regent', stance });
    }
    refresh();
  }

  // LOCAL drive: while regency is armed, the driver plays turn after turn;
  // take-back (regents cleared) stops it at the next turn boundary.
  function drive() {
    if (driver) driver.kick();
  }

  function refresh() {
    const on = myRegent() !== undefined;
    btn.classList.toggle('active', on);
    btn.title = on ? 'AI is playing this seat — click to take back control'
      : 'let the AI play this seat (auto turn)';
    dialog.querySelector('#regent-off').classList.toggle('hidden', !on);
    for (const b of dialog.querySelectorAll('.regent-stance')) {
      b.classList.toggle('chosen', b.dataset.stance === myRegent());
    }
  }

  btn.addEventListener('click', () => {
    if (myRegent() !== undefined) { setRegent(null); return; } // quick take-back
    dialog.classList.toggle('hidden');
    refresh();
  });
  for (const b of dialog.querySelectorAll('.regent-stance')) {
    b.addEventListener('click', () => { setRegent(b.dataset.stance); dialog.classList.add('hidden'); });
  }
  dialog.querySelector('#regent-off').addEventListener('click', () => { setRegent(null); dialog.classList.add('hidden'); });
  dialog.querySelector('.panel-close').addEventListener('click', () => dialog.classList.add('hidden'));

  session.onChange(() => { refresh(); drive(); });
  refresh();

  // e2e: ?regentdemo=<stance> shows the Auto Turn state for screenshots —
  // set the flag WITHOUT driving, so the frame is frozen for capture
  const demo = PARAMS.get('regentdemo');
  if (demo) {
    if (local) session.setRegent(ctx.HUMAN, demo);
    refresh();
    if (ctx.hud) ctx.hud.refresh(); // repaint the End-Turn "Auto Turn" state
  }
  if (PARAMS.get('regentdialog') === '1') { dialog.classList.remove('hidden'); refresh(); }

  return {
    isRegent() { return myRegent() !== undefined; },
    stance() { return myRegent(); }
  };
}
