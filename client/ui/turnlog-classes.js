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
    case 'airCrashed': // A72: air unit out of fuel (own-seat)
      return e.owner === viewer ? 'combat' : null;
    case 'revolutionStarted': case 'governmentChanged':
      return e.playerId === viewer ? 'cities' : 'rival';
    case 'techDiscovered':
      // rivals' discoveries never reach a fogged seat (engine filterEvents)
      return e.playerId === viewer ? 'research' : null;
    case 'playerDefeated': case 'wonderBuilt': case 'wonderLost':
    case 'barbariansSpawned': case 'gameOver': case 'ageChanged':
      return 'world';
    case 'saveCode': // synthetic client event (session-remote, A33)
      return 'saves';
    case 'regentTurn': // synthetic client event (session regency, B11)
      return 'regent';
    default:
      return null;
  }
}
