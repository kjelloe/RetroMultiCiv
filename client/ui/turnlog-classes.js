// A39: pure event → filter-class mapping for the turn log. Kept DOM-free so
// the mapping unit-tests without a browser. Classes mirror the filter row:
// combat · cities · research · rival · saves — plus 'world', which has NO
// checkbox by design (rare + load-bearing: wonders, eliminations, barbarian
// uprisings always show). null = the log does not narrate this event type.
export const LOG_CLASSES = [
  { id: 'combat', label: '⚔ combat' },
  { id: 'cities', label: '🏛 cities' },
  { id: 'research', label: '🔬 research' },
  { id: 'rival', label: '👀 rivals' },
  { id: 'saves', label: '💾 saves' },
  { id: 'regent', label: '🤖 regent' }
];

// viewer: the viewpoint pid; cityOwner(cityId) -> pid|null resolves city
// events (a plain lookup the caller provides, so this stays pure).
export function classifyEvent(e, viewer, cityOwner) {
  switch (e.type) {
    case 'combatResolved':
      return e.attackerOwner === viewer || e.defenderOwner === viewer ? 'combat' : 'rival';
    case 'cityCaptured':
      return e.from === viewer || e.to === viewer ? 'cities' : 'rival';
    case 'cityFounded': case 'cityGrew': case 'cityStarved':
    case 'unitBuilt': case 'buildingBuilt':
    case 'cityDisorder': case 'cityOrderRestored':
      return cityOwner(e.cityId) === viewer ? 'cities' : 'rival';
    case 'improvementBuilt':
      return e.owner === viewer ? 'cities' : 'rival';
    case 'buildingSold': // B13/A63: obsolete building auto-sold (own-seat only)
      return e.playerId === viewer ? 'cities' : null;
    case 'wonderHelped': // A83: caravan helped a wonder (own-seat only)
      return e.playerId === viewer ? 'cities' : null;
    case 'unitLoaded': case 'unitUnloaded': case 'cargoLost': // A69: naval transport (own-seat)
    case 'airCrashed': case 'unitConsumed': // A72: air fuel crash / one-shot missile (own-seat)
      return e.owner === viewer ? 'combat' : null;
    case 'revolutionStarted': case 'governmentChanged':
      return e.playerId === viewer ? 'cities' : 'rival';
    case 'techDiscovered':
      // rivals' discoveries never reach a fogged seat (engine filterEvents)
      return e.playerId === viewer ? 'research' : null;
    case 'ssPartBuilt': // A76: own spaceship part completed (own-seat only)
      return e.playerId === viewer ? 'cities' : null;
    case 'tradeRouteEstablished': // A89: own caravan established a route (🐫, own-seat)
      return e.playerId === viewer ? 'cities' : null;
    case 'unitUpgraded': // N11: own unit upgraded in a city (own-seat only)
      return e.playerId === viewer ? 'cities' : null;
    case 'debugCommand': // A92: a debug command was used (world — the taint is public)
      return 'world';
    case 'hutEntered': // N13: own unit entered a village (own-seat)
      return e.playerId === viewer ? 'cities' : null;
    case 'ransomPaid': // N13: own unit killed a lone barbarian leader (own-seat)
      return e.playerId === viewer ? 'combat' : null;
    case 'playerDefeated': case 'wonderBuilt': case 'wonderLost':
    case 'barbariansSpawned': case 'gameOver': case 'ageChanged':
    case 'shipLaunched': case 'shipDestroyed': case 'spaceVictory': // A76: the space race is public
    // D2: war/peace/betrayal are load-bearing world news (the world hears the
    // headline; the two parties get the detail in the row text) — always shown
    case 'WAR_DECLARED': case 'PEACE_TREATY_SIGNED': case 'TREATY_BROKEN':
    case 'FIRST_CONTACT': // D3: engine first-contact event (D2's audience trigger)
      return 'world';
    case 'pollutionSpread': // A91: a tile fouled near a city — ambient, not logged (too frequent)
      return null;
    case 'cityMeltdown': // A91: a nuclear meltdown fouled a square — the owner hears it
      return cityOwner(e.cityId) === viewer ? 'cities' : 'rival';
    case 'terrainWarmed': // A91b: global warming degraded a tile — world news
      return 'world';
    case 'cityNuked': // A91c: a nuclear strike halved a city — the owner hears it, rivals see it
      return cityOwner(e.cityId) === viewer ? 'cities' : 'rival';
    case 'nukeFallout': // A91c: fallout fouled a ring tile — ambient (the strike row carries it)
      return null;
    case 'saveCode': // synthetic client event (session-remote, A33)
      return 'saves';
    case 'regentTurn': // synthetic client event (session regency, B11)
      return 'regent';
    default:
      return null;
  }
}
