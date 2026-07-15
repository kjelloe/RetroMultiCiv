// B11: the LOCAL regency drive loop, extracted DOM-free from regency.js so
// its mechanics unit-test in node (test/regent-driver.test.js). One driver
// per client; regency.js kicks it from onChange and after arming.
//
// getHuman is an accessor because ctx.HUMAN is the CURRENT VIEWPOINT and
// mutates in hotseat — never capture it (CLAUDE.md module policy).
export function createRegentDriver(session, getHuman) {
  let kicking = false;

  // While armed, play turn after turn. The pre-B11 one-shot version relied
  // on endTurn's final notify to re-kick — but that notify fires while the
  // previous kick is still awaiting (kicking === true), so the re-kick was
  // swallowed and the seat STALLED every turn until any manual command's
  // onChange poked it, which then swept the seat and auto-ended the turn
  // (the user's "when I moved them" report). The loop owns continuation
  // instead; take-back (regents cleared) is honored at every turn boundary.
  async function kick() {
    if (kicking) return;
    kicking = true;
    try {
      let guard = 10000; // no game outlives this many regent turns
      while (guard-- > 0) {
        const st = session.state;
        if (st.gameOver || st.activePlayer !== getHuman()) break;
        if (session.regents[getHuman()] === undefined) break;
        if (session.busy) break;
        await session.regentTurn();
        // yield a macrotask between turns so the HUD paints and a
        // take-back click can land (the A30 chunking convention)
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally { kicking = false; }
  }

  return {
    kick,
    get kicking() { return kicking; }
  };
}
