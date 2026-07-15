// A47 replay theater: extract the MAJOR events from a round's event stream
// for the theater's feed. A global spectator sees ALL players' events
// (unfiltered — the game is over, everything is public), but only the
// headline classes: founded / tech / captured / wonder / eliminated /
// uprising / game end. Pure and DOM-free so it unit-tests headless.
//
// Each result: { icon, text, loc? } — loc {x,y} rides most events so the
// theater can fly the camera there on click. The caller prefixes turn+year.
export function majorEvents(events, state, ruleset) {
  const out = [];
  const who = pid => (state.players[pid] ? state.players[pid].name : pid);
  const cityName = cid => (state.cities[cid] ? state.cities[cid].name : cid);
  const cityLoc = cid => (state.cities[cid] ? { x: state.cities[cid].x, y: state.cities[cid].y } : null);
  for (const e of events || []) {
    switch (e.type) {
      case 'cityFounded':
        out.push({ icon: '🏛', text: `${who(state.cities[e.cityId] ? state.cities[e.cityId].owner : e.owner)} founds ${cityName(e.cityId)}`, loc: cityLoc(e.cityId) });
        break;
      case 'techDiscovered':
        out.push({ icon: '🔬', text: `${who(e.playerId)} discovers ${ruleset.techs[e.tech] ? ruleset.techs[e.tech].name : e.tech}` });
        break;
      case 'cityCaptured':
        out.push({ icon: '🏰', text: `${who(e.to)} captures ${cityName(e.cityId)} from ${who(e.from)}`, loc: cityLoc(e.cityId) });
        break;
      case 'wonderBuilt':
        out.push({ icon: '🏆', text: `${who(state.cities[e.cityId] ? state.cities[e.cityId].owner : e.owner)} completes ${ruleset.wonders[e.wonder] ? ruleset.wonders[e.wonder].name : e.wonder}`, loc: cityLoc(e.cityId) });
        break;
      case 'playerDefeated':
        out.push({ icon: '💀', text: `${who(e.playerId)} is eliminated` });
        break;
      case 'barbariansSpawned':
        out.push({ icon: '🏴', text: 'a barbarian uprising' });
        break;
      case 'ageChanged': {
        const ages = (ruleset.rules && ruleset.rules.ages) || [];
        const age = ages.find(a => a.id === e.age);
        out.push({ icon: '🌍', text: `the world enters the ${age ? age.name : e.age} Age` });
        break;
      }
      case 'gameOver':
        out.push({ icon: '🏁', text: `game over — ${who(e.winner)} wins` });
        break;
      default: break; // minor events (growth, production, disorder) stay out
    }
  }
  return out;
}
