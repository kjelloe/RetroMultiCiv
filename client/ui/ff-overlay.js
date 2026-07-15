// A56(a): the fast-forward interstitial — a center-screen year counter for the
// 10–20s silent gap while a later-age start (see shared/fastforward.js) plays
// the world's history as AI. Sweeps the year 4000 BC → the start year with the
// era name of the moment fading through; honors reduceAnimation (a plain
// progress line, no fades, no big counter); never delays the hand-off (main.js
// drives update() from the SAME slices that advance the sim, then removes it).
// Pure DOM + one Node-testable helper (no engine, no state).

// The era of a turn: the name of the highest starting-age whose turn threshold
// has been reached (ages are turn-keyed in data/rules.json, ascending). PURE.
export function eraNameForTurn(ages, turn) {
  let name = '';
  for (const a of ages || []) {
    if (turn >= a.turn) name = a.name;
  }
  return name;
}

export function formatYear(year) {
  return year < 0 ? (-year) + ' BC' : year + ' AD';
}

export function createFfOverlay(opts) {
  const reduce = opts && opts.reduceAnimation === true;
  const ages = (opts && opts.ages) || [];

  const el = document.createElement('div');
  el.id = 'ff-overlay';
  if (reduce) el.classList.add('ff-reduced');
  el.innerHTML = `
    <div id="ff-era"></div>
    <div id="ff-year"></div>
    <div id="ff-progress"></div>`;
  document.body.appendChild(el);
  const eraEl = el.querySelector('#ff-era');
  const yearEl = el.querySelector('#ff-year');
  const progEl = el.querySelector('#ff-progress');
  let lastEra = null;

  return {
    el,
    // called once per fast-forward slice — cheap enough to run every slice
    update(turn, targetTurn, year) {
      const era = eraNameForTurn(ages, turn);
      if (reduce) {
        // plain progress line only — no animated counter, no fades
        progEl.textContent = `Simulating history… ${formatYear(year)}`
          + (era ? ` · ${era} Age` : '') + ` · turn ${turn} / ${targetTurn}`;
        return;
      }
      if (era !== lastEra) {
        eraEl.textContent = era ? `${era} Age` : '';
        eraEl.classList.remove('ff-fade');
        void eraEl.offsetWidth; // reflow so the fade restarts on each new era
        eraEl.classList.add('ff-fade');
        lastEra = era;
      }
      yearEl.textContent = formatYear(year);
      progEl.textContent = `Simulating history… turn ${turn} / ${targetTurn}`;
    },
    // an aborted history (a to-be-human civ died, or the game ended): the
    // overlay STAYS and carries the reason, matching the deterministic UX
    fail(msg) {
      el.classList.add('ff-failed');
      eraEl.textContent = '';
      yearEl.textContent = '✗';
      progEl.textContent = msg;
    },
    remove() { el.remove(); }
  };
}
