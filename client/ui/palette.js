// Accessibility palette pass (specs/palette-pass.md): a DISPLAY-TIME remap
// of the 14 stored civ colors. Civ colors live in GAME STATE (player.color),
// so the data never changes — displayColor(hex) is called at every seam
// where a civ color reaches rendering (three/factions.js, the renderer's
// label/tint reads, the DOM swatch sites). Identity by default: with the
// option off (or an unknown mode/color) the stored hex passes through
// UNTOUCHED, which is what keeps every golden byte-identical.
//
// The pref is read from localStorage LIVE on each call (not cached): the
// options panel writes the same store, and the setup screen renders before
// ctx.options exists. Modes are data-driven — P2 adds the
// 'deuteranopia-safe' table here and the options select grows it
// automatically.

const STORE_KEY = 'retromulticiv-options';

// mode -> { storedHex: displayedHex } — every table must cover exactly the
// 14 data/civs.json colors (the P2 node test pins that).
export const PALETTES = {};

export function paletteMode() {
  try {
    const mode = JSON.parse(localStorage.getItem(STORE_KEY) || '{}').civPalette;
    return typeof mode === 'string' && (mode === 'default' || PALETTES[mode] !== undefined)
      ? mode : 'default';
  } catch (e) {
    return 'default';
  }
}

export function displayColor(hex) {
  const table = PALETTES[paletteMode()];
  return table !== undefined && table[hex] !== undefined ? table[hex] : hex;
}

// a civ `visual` (data/civs.json: primary/secondary color fields + emblem
// glyph) with its COLORS remapped; the emblem glyph is the palette-
// independent identity channel and passes through untouched
export function displayVisual(visual) {
  if (!visual) return visual;
  const out = {};
  for (const k of Object.keys(visual)) {
    out[k] = (k === 'primary' || k === 'secondary') ? displayColor(visual[k]) : visual[k];
  }
  return out;
}
