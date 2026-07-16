// A72: air fuel — processed once per game turn at the wrap. Air units (data
// `fuel`: turns aloft allowed) must END the turn on a friendly base — a city, or
// a carrier they are aboard (A69) — or they burn a turn of fuel; past their fuel
// they crash. Omit-safe: the transient `aloft` counter exists only while an air
// unit is away from a base (cleared when based), so crafted-state hashes and the
// all-AI sim (which fields no air units) are untouched. No RNG.
import { cityAt, sortIds } from './combat.js';

function processAir(state, ruleset, events) {
  for (const id of sortIds(Object.keys(state.units))) {
    const u = state.units[id];
    const def = ruleset.units[u.type];
    if (!def || def.domain !== 'air') continue;
    if (def.fuel === undefined) continue; // no fuel model for this air unit yet
    // based on a carrier (A69 aboard) or standing in a friendly city: refuelled
    if (u.aboard !== undefined) { delete u.aloft; continue; }
    const city = cityAt(state, u.x, u.y);
    if (city && city.owner === u.owner) { delete u.aloft; continue; }
    const aloft = (u.aloft === undefined ? 0 : u.aloft) + 1;
    if (aloft > def.fuel) {
      delete state.units[id];
      events.push({ type: 'airCrashed', unitId: id, owner: u.owner, x: u.x, y: u.y });
    } else {
      u.aloft = aloft;
    }
  }
}

export { processAir };
