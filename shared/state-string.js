// fe-R13: client-supplied text that can reach game state must obey
// statehash.js canonical()'s string rule (every UTF-16 code unit in 32..126),
// or the first hash of that state throws. The server checks at the door; the
// browser folds names to ASCII before sending so "Åse" joins as "Ase".

export function isStateString(s, maxLen) {
  if (typeof s !== 'string' || s.length > maxLen) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 32 || c > 126) return false;
  }
  return true;
}

// every string anywhere inside a client payload (keys included) passes the rule
export function onlyStateStrings(value, depth = 0) {
  if (depth > 8) return false;
  if (typeof value === 'string') return isStateString(value, 4096);
  if (Array.isArray(value)) return value.every(v => onlyStateStrings(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.keys(value).every(k => isStateString(k, 64) && onlyStateStrings(value[k], depth + 1));
  }
  return true;
}

// A116: a command payload must also be a value game state can hold — a safe
// integer, a boolean, an array or a plain object, never a float or null (the
// next hash of a state holding one throws, and containFault closes the game).
// Lobby options keep the looser onlyStateStrings: they configure, never store.
export function onlyStateValues(value, depth = 0) {
  if (depth > 8) return false;
  if (typeof value === 'string') return isStateString(value, 4096);
  if (typeof value === 'number') return Number.isSafeInteger(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every(v => onlyStateValues(v, depth + 1));
  if (value !== null && typeof value === 'object') {
    return Object.keys(value).every(k => isStateString(k, 64) && onlyStateValues(value[k], depth + 1));
  }
  return false;
}

// letters NFD does not decompose into base + combining mark
const FOLD = { 'ø': 'o', 'Ø': 'O', 'æ': 'ae', 'Æ': 'AE', 'œ': 'oe', 'Œ': 'OE', 'ß': 'ss',
  'ð': 'd', 'Ð': 'D', 'þ': 'th', 'Þ': 'Th', 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', 'ı': 'i' };

export function foldToAscii(s) {
  let out = '';
  for (const ch of s.normalize('NFD')) {
    if (FOLD[ch] !== undefined) out += FOLD[ch];
    else {
      const c = ch.charCodeAt(0);
      if (ch.length === 1 && c >= 32 && c <= 126) out += ch;
    }
  }
  return out;
}
