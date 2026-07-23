// A77 sound design v1: the pure event → SOUND-ID map. Kept DOM-free and
// audio-free (like turnlog-classes.js, the classification it rides) so it
// unit-tests headless and the Roblox port consumes the SAME map (docs/13 sound
// row). It only decides WHICH cue an event earns — from the viewer's vantage,
// so combat WINS sound triumphant and LOSSES sad (the user's explicit pair);
// sound.js turns the id into audio, honoring the ⚙ volume/mute split. null = a
// silent event.
//
// `viewer` is the viewpoint pid; `cityOwner(cityId) -> pid|null` resolves city
// events (the same lookup turnlog-classes takes), so this stays pure.
export function soundForEvent(e, viewer, cityOwner) {
  switch (e.type) {
    case 'combatResolved': {
      const iWon = (e.winner === 'attacker' && e.attackerOwner === viewer)
        || (e.winner === 'defender' && e.defenderOwner === viewer);
      const iLost = (e.winner === 'attacker' && e.defenderOwner === viewer)
        || (e.winner === 'defender' && e.attackerOwner === viewer);
      if (iWon) return 'combat-win';
      if (iLost) return 'combat-loss';
      return 'combat-distant'; // a battle in view but not mine — a faint clash
    }
    case 'cityCaptured':
      if (e.to === viewer) return 'capture-win';
      if (e.from === viewer) return 'capture-loss';
      return 'capture-distant';
    case 'cityFounded':
      return cityOwner(e.cityId) === viewer ? 'found' : null;
    case 'cityGrew':
      return cityOwner(e.cityId) === viewer ? 'grow' : null;
    case 'cityStarved':
      return cityOwner(e.cityId) === viewer ? 'starve' : null;
    case 'settlerRefused': // XV §7: the capital banked a settler — turnlog-only (the warn-modal already alerted); deliberate silence
      return null;
    case 'unitRehomed': // XIV §45b: a minor upkeep action — turnlog-only, deliberate silence
      return null;
    case 'seatClaimed': // late-join §3: a seat takeover — the join-reveal banner handles it (spec §4); deliberate silence
      return null;
    case 'buildingBuilt':
      return cityOwner(e.cityId) === viewer ? 'build' : null;
    case 'cityDisorder':
      return cityOwner(e.cityId) === viewer ? 'disorder' : null;
    case 'cityOrderRestored':
      return cityOwner(e.cityId) === viewer ? 'order' : null;
    case 'techDiscovered':
      // rivals' discoveries never reach a fogged seat (engine filterEvents)
      return e.playerId === viewer ? 'tech' : null;
    case 'wonderBuilt':
      return 'wonder'; // world news — Civ 1 announces wonders to everyone
    case 'ageChanged':
      return 'age'; // the historian's fanfare
    case 'playerDefeated':
      return e.playerId === viewer ? 'defeat' : 'elimination';
    case 'barbariansSpawned':
      return 'barbarian';
    case 'gameOver':
      return e.winner === viewer ? 'victory' : 'gameover';
    case 'governmentChanged':
      return e.playerId === viewer ? 'government' : null;
    case 'regentTurn': // synthetic client event (session regency, B11)
      return 'regent';
    case 'ssPartBuilt': // A76 presentation pass: own parts get the assembly cue
      return e.playerId === viewer ? 'ship-part' : null;
    case 'shipLaunched': // the race is public — everyone hears the launch
      return 'ship-launch';
    case 'shipDestroyed':
      return 'ship-down';
    case 'spaceVictory':
      // silent BY DESIGN: the gameOver event in the same batch carries the
      // victory/gameover cue — a second cue here would double-fire
      return null;
    case 'tradeRouteEstablished':
      // A89: own-seat only; a dedicated caravan cue is a later presentation pass
      return e.playerId === viewer ? 'build' : null;
    case 'unitUpgraded': // N11: own-seat; reuse the build cue (dedicated cue = later pass)
      return e.playerId === viewer ? 'build' : null;
    case 'debugCommand': // A92: silent — a debug action needs no cue
      return null;
    case 'pollutionSpread': // A91: ambient fouling — silent (too frequent for a cue)
      return null;
    case 'cityMeltdown': // A91: own-city meltdown — reuse the disorder alarm
      return cityOwner(e.cityId) === viewer ? 'disorder' : null;
    case 'terrainWarmed': // A91b: global warming — silent (a turnlog world line carries it)
      return null;
    case 'disasterStruck': // disasters: own-city calamity — reuse the disorder alarm; rivals faint
      return cityOwner(e.cityId) === viewer ? 'disorder' : 'combat-distant';
    case 'triremeLost': // naval-truth: own trireme lost at sea — a muted combat-loss
      return e.owner === viewer ? 'combat-loss' : null;
    case 'cityNuked': // A91c: a nuclear strike on a city — reuse the combat-loss alarm for the owner
      return cityOwner(e.cityId) === viewer ? 'combat-loss' : 'combat-distant';
    case 'nukeFallout': // A91c: fallout fouling — silent (the cityNuked/strike cue carries it)
      return null;
    case 'hutEntered': // N13: own-seat village discovery cue (reuse 'found')
      return e.playerId === viewer ? 'found' : null;
    case 'ransomPaid': // N13: own-seat — a combat-win-flavoured payout
      return e.playerId === viewer ? 'combat-win' : null;
    case 'WAR_DECLARED': case 'PEACE_TREATY_SIGNED': case 'TREATY_BROKEN':
    case 'FIRST_CONTACT': // D3: the diplomacy/contact cues arrive in D2's presentation pass
      // D1/D3 are engine-only: audio cues land with the D2 treaty/audience UI.
      // Deliberately silent for now (explicit decision).
      return null;
    default:
      return null; // most events (moves, production set, rates) are silent
  }
}

// The catalogue of every cue the map can emit — the contract sound.js must
// cover and the Roblox row must mirror. A test asserts the map only ever
// returns ids from this set (drift guard).
export const SOUND_IDS = [
  'combat-win', 'combat-loss', 'combat-distant',
  'capture-win', 'capture-loss', 'capture-distant',
  'found', 'grow', 'starve', 'build', 'disorder', 'order',
  'tech', 'wonder', 'wonder-triumph', 'age', 'defeat', 'elimination', 'barbarian',
  'victory', 'gameover', 'government', 'regent',
  'ship-part', 'ship-launch', 'ship-down', // A76: the space-race cues
  // XIV §26: era-specific tech-discovery fanfares (played by the celebration
  // overlay via sound.js's era upgrade; listed here so soundboard.html shows them)
  'discovery-ancient', 'discovery-classical', 'discovery-industrial', 'discovery-modern'
];
