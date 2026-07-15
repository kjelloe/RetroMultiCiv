// A78: the pure gate behind first-timer advice — DOM-free so Node unit-tests
// the "should this offer show?" decision directly. An advice id shows iff tips
// are enabled, the player is human (never the e2e/webdriver bot), and this id
// has not been acknowledged before (its first-visit flag in `seen`).
export const SEEN_KEY = 'retromulticiv-advice-seen';

export function adviceGate(id, seen, enabled, isBot) {
  if (isBot === true) return false;      // e2e / webdriver paths stay clean
  if (enabled === false) return false;   // ⚙ "show first-time tips" turned off
  if (typeof id !== 'string' || id === '') return false;
  return seen[id] !== true;              // once per id
}
