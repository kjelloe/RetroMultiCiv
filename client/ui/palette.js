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
//
// deuteranopia-safe (P2): curated by simulated-space distance — under the
// Viénot deuteranopia matrix the STORED set's worst pair sat at deltaE 2.1
// (americans/romans, near-identical); this table's worst pair is 17.4, every
// confusable resolved along the blue-yellow and lightness axes the
// deuteranope keeps. Six colors survive as identity; eight remap. The node
// test (test/palette.test.js) recomputes the simulation and pins the floor.
// TWO identity spaces live here, one flat lookup: the 14 data/civs.json
// `color` values (map labels, UI swatches, overlay tints — lowercase hex) AND
// the 14 `visual.primary` values (the unit discs / flags — the A14 art set,
// uppercase hex as stored). Both curated to a simulated-space floor: civ
// colors min 17.4 (was 2.1 — americans/romans near-identical), visual
// primaries min 16.2 (was 5.1 — russians/zulus). Visual SECONDARIES keep
// identity (they contrast within one flag, not across civs; the P3 audit
// covers their legibility on the new primaries).
export const PALETTES = {
  'deuteranopia-safe': {
    // — civ colors (player.color) —
    '#4b6bd8': '#1c2f8a', // americans: navy (was near-identical to romans' blue)
    '#6db3f2': '#c9e6ff', // french: near-white blue (clear of aztec cyan)
    '#d84a3b': '#66101f', // russians: deep crimson (clear of mongol orange)
    '#3bd875': '#0c5c38', // greeks: dark green (clear of german gray)
    '#d8b13b': '#8a6b1c', // egyptians: dark bronze (clear of chinese yellow)
    '#8a949e': '#6b7480', // germans: darker slate
    '#d83b8a': '#0f8a8a', // english: teal (pink is a deuteranope gray)
    '#b0632f': '#4a3120', // zulus: dark brown
    '#3b7dd8': '#3b7dd8', // romans (identity)
    '#3bc9d8': '#3bc9d8', // aztecs (identity)
    '#b13bd8': '#b13bd8', // babylonians (identity)
    '#d8d83b': '#d8d83b', // chinese (identity)
    '#d88fd8': '#d88fd8', // indians (identity)
    '#d8703b': '#d8703b', // mongols (identity)
    // — visual primaries (civs.json visual.primary, the unit discs) —
    '#218C8C': '#116363', // americans: deeper teal (was 6.3 from chinese purple)
    '#C9822B': '#e6a63b', // babylonians: brighter amber (was 9.0 from roman red)
    '#6B4BB3': '#fafa96', // chinese: pale yellow (the dark/lavender slots were full)
    '#2F6FB3': '#4a8fd0', // english: lighter blue (was 9.6 from greek navy)
    '#5F6872': '#8f99a3', // germans: lighter slate (was 5.5 from aztec green)
    '#1F4F99': '#0c2347', // greeks: near-black navy
    '#758A35': '#5c7a14', // indians: deeper olive
    '#66AFC2': '#8fd0e0', // mongols: paler cyan
    '#8E2F45': '#66101f', // russians: deep crimson (same slot as the map color — one civ, one hue)
    '#7A4B2A': '#8a5c33', // zulus: warmer tan (was 5.1 from russian maroon)
    '#3F8F4A': '#3F8F4A', // aztecs (identity)
    '#F0E6C8': '#F0E6C8', // egyptians (identity)
    '#C24C7A': '#C24C7A', // french (identity)
    '#B83C3C': '#B83C3C'  // romans (identity)
  }
};

// ?palette=<mode> — a screenshot/e2e override, captured at MODULE EVAL (the
// A45 trap: main.js canonicalizes the URL after boot). Never persisted.
const PARAM_MODE = typeof location !== 'undefined'
  ? new URLSearchParams(location.search).get('palette') : null;

export function paletteMode() {
  if (PARAM_MODE !== null && PALETTES[PARAM_MODE] !== undefined) return PARAM_MODE;
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
