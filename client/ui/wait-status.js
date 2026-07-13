// A26 waiting-for-player status: pure timer/threshold logic so Node can unit
// test it. The tracker watches whose turn it is; the elapsed clock resets on
// every turn change, and the slow-poke note fires ONCE per player-turn when
// the threshold is crossed (client-side narration only — nothing enters game
// state).
export function createWaitTracker() {
  let pid = null;
  let since = 0;
  let noted = false;
  return {
    // returns { waitingFor, elapsedSec, note } — waitingFor null when it is
    // the viewer's own turn (or nobody's); note true exactly once per wait
    // that crosses thresholdSec (0 disables the note)
    update(activePid, viewerPid, nowMs, thresholdSec) {
      if (activePid !== pid) {
        pid = activePid;
        since = nowMs;
        noted = false;
      }
      if (activePid === null || activePid === undefined || activePid === viewerPid) {
        return { waitingFor: null, elapsedSec: 0, note: false };
      }
      const elapsedSec = Math.floor((nowMs - since) / 1000);
      let note = false;
      if (!noted && thresholdSec > 0 && elapsedSec >= thresholdSec) {
        noted = true;
        note = true;
      }
      return { waitingFor: activePid, elapsedSec, note };
    }
  };
}

export function formatWait(name, elapsedSec) {
  return `⏳ ${name} is moving · ${elapsedSec}s`;
}

export function formatSlowNote(name, elapsedSec) {
  return `⏱ Waited ${elapsedSec}s for ${name}`;
}
