// XII.6 Part C — procedural tech GLYPHS, one house-style system across three
// surfaces (the tech tree, the discovery card, the research readout). The
// factions.js / asset-recipes idiom: every glyph = a shared era-colored FRAME
// + a per-tech MOTIF drawn from a small vocabulary of 2D primitives. The motif
// table (GLYPH) is PURE DATA (a 0..100 box, y-down) so it ports to Roblox the
// way the emblems + asset-recipes do; only the renderer here is DOM/canvas.
// Glyphs are cached by id+size. `FLAGGED` marks the motifs that are a
// provisional guess and want a design-pass concept from the ally (the blurb
// author) — the tree keeps NAME LABELS regardless, so nothing blocks on art.

const ERA = {
  ancient:     { edge: '#b9975b', fill: '#241d11', ink: '#ecdcb4' },
  renaissance: { edge: '#6ba368', fill: '#152418', ink: '#cdeac7' },
  industrial:  { edge: '#6f8bb0', fill: '#131d28', ink: '#d2e2f3' },
  modern:      { edge: '#9b7fc9', fill: '#1d1830', ink: '#e2d4f5' }
};

// --- primitive builders (return plain-data primitive lists) -----------------
function star(x, y, r, points, inner) {
  const pts = []; const ri = inner == null ? r * 0.45 : inner;
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const rad = i % 2 === 0 ? r : ri;
    pts.push([Math.round((x + Math.cos(a) * rad) * 10) / 10, Math.round((y + Math.sin(a) * rad) * 10) / 10]);
  }
  return { p: 'poly', pts, close: true, fill: true };
}
function ringOf(count, cx, cy, r, make) {
  const out = [];
  for (let i = 0; i < count; i++) { const a = (Math.PI * 2 * i) / count; out.push(make(cx + Math.cos(a) * r, cy + Math.sin(a) * r, a)); }
  return out;
}
function atom(x, y, s) {
  return [
    { p: 'ell', x, y, rx: s, ry: s * 0.4, rot: 0, w: 5 },
    { p: 'ell', x, y, rx: s, ry: s * 0.4, rot: 60, w: 5 },
    { p: 'ell', x, y, rx: s, ry: s * 0.4, rot: 120, w: 5 },
    { p: 'disc', x, y, r: 8 }
  ];
}
function wheelSpoked(x, y, r) {
  return [{ p: 'ring', x, y, r, w: 8 }, { p: 'disc', x, y, r: 7 },
    ...ringOf(8, x, y, r, (px, py) => ({ p: 'poly', pts: [[x, y], [px, py]], w: 5 }))];
}

// --- the motif table (0..100 box) -------------------------------------------
// Confident motifs carry no flag; FLAGGED ids get a provisional motif AND a
// note so the ally can supply the intended concept.
const GLYPH = {
  // — ancient —
  'alphabet': [{ p: 'letter', ch: 'A', x: 50, y: 52, size: 62 }],
  'writing': [{ p: 'poly', pts: [[30, 74], [70, 30]], w: 8 }, { p: 'poly', pts: [[24, 80], [34, 70], [30, 74]], close: true, fill: true }, { p: 'poly', pts: [[26, 78], [22, 82]], w: 4 }],
  'literacy': [{ p: 'poly', pts: [[22, 34], [50, 42], [78, 34], [78, 70], [50, 78], [22, 70]], close: true, w: 6 }, { p: 'poly', pts: [[50, 42], [50, 78]], w: 6 }],
  'wheel': wheelSpoked(50, 50, 30),
  'pottery': [{ p: 'poly', pts: [[38, 30], [62, 30], [58, 40], [70, 58], [62, 74], [38, 74], [30, 58], [42, 40]], close: true, w: 6 }, { p: 'poly', pts: [[40, 30], [60, 30]], w: 7 }],
  'masonry': [{ p: 'bar', x: 34, y: 38, w: 30, h: 14, r: 2 }, { p: 'bar', x: 66, y: 38, w: 30, h: 14, r: 2 }, { p: 'bar', x: 50, y: 54, w: 30, h: 14, r: 2 }, { p: 'bar', x: 34, y: 70, w: 30, h: 14, r: 2 }, { p: 'bar', x: 66, y: 70, w: 30, h: 14, r: 2 }],
  'bronze-working': [{ p: 'poly', pts: [[28, 60], [72, 60], [64, 44], [36, 44]], close: true, fill: true }],   // FLAGGED: ingot vs iron's anvil
  'iron-working': [{ p: 'bar', x: 50, y: 44, w: 46, h: 12, r: 3 }, { p: 'poly', pts: [[34, 50], [30, 66], [70, 66], [66, 50]], close: true, fill: true }, { p: 'bar', x: 50, y: 72, w: 30, h: 8 }],   // FLAGGED: anvil
  'ceremonial-burial': [{ p: 'arc', x: 50, y: 76, r: 24, a0: 180, a1: 360, w: 7 }, { p: 'bar', x: 50, y: 58, w: 14, h: 36, r: 5 }, { p: 'arc', x: 50, y: 30, r: 10, a0: 200, a1: 340, w: 4 }],   // grave mound + memorial stone + rising arc
  'code-of-laws': [{ p: 'poly', pts: [[50, 24], [50, 74]], w: 6 }, { p: 'poly', pts: [[24, 34], [76, 34]], w: 6 }, { p: 'arc', x: 30, y: 34, r: 14, a0: 0, a1: 180, w: 5 }, { p: 'arc', x: 70, y: 34, r: 14, a0: 0, a1: 180, w: 5 }, { p: 'bar', x: 50, y: 78, w: 34, h: 8 }],
  'currency': [{ p: 'ring', x: 50, y: 50, r: 27, w: 8 }, { p: 'bar', x: 50, y: 50, w: 20, h: 20, r: 2, fill: false, w2: 8 }],   // round coin, centered square hole
  'mathematics': [{ p: 'poly', pts: [[26, 72], [74, 72], [26, 30]], close: true, w: 7 }, { p: 'poly', pts: [[34, 66], [40, 66], [40, 72]], close: true, w: 4 }],
  'trade': [{ p: 'poly', pts: [[24, 42], [68, 42]], w: 6 }, { p: 'poly', pts: [[60, 34], [72, 42], [60, 50]], close: true, fill: true }, { p: 'poly', pts: [[76, 60], [32, 60]], w: 6 }, { p: 'poly', pts: [[40, 52], [28, 60], [40, 68]], close: true, fill: true }, { p: 'disc', x: 50, y: 51, r: 5 }],   // opposing arrows through a central dot
  'construction': [{ p: 'bar', x: 32, y: 72, w: 22, h: 14, r: 2 }, { p: 'bar', x: 46, y: 58, w: 22, h: 14, r: 2 }, { p: 'bar', x: 60, y: 44, w: 22, h: 14, r: 2 }, { p: 'arc', x: 54, y: 56, r: 26, a0: 200, a1: 340, w: 6 }],   // offset blocks rising into an arch
  'engineering': [{ p: 'bar', x: 30, y: 58, w: 8, h: 44 }, { p: 'bar', x: 70, y: 58, w: 8, h: 44 }, { p: 'bar', x: 50, y: 34, w: 48, h: 8 }, { p: 'poly', pts: [[30, 38], [50, 66], [70, 38]], w: 6 }],   // bridge truss: uprights + triangular brace
  'bridge-building': [{ p: 'arc', x: 50, y: 58, r: 24, a0: 180, a1: 360, w: 7 }, { p: 'bar', x: 50, y: 40, w: 60, h: 8 }, ...ringOf(3, 50, 58, 24, (px, py) => ({ p: 'poly', pts: [[px, 44], [px, py]], w: 4 }))],
  'map-making': [{ p: 'poly', pts: [[22, 34], [40, 40], [58, 34], [78, 40], [78, 68], [58, 62], [40, 68], [22, 62]], close: true, w: 6 }, { p: 'poly', pts: [[40, 40], [40, 68]], w: 3 }, { p: 'poly', pts: [[58, 34], [58, 62]], w: 3 }, { p: 'disc', x: 50, y: 52, r: 4 }],   // folded three-panel map + route dot
  'horseback-riding': [{ p: 'poly', pts: [[24, 60], [26, 50], [36, 34], [42, 30], [44, 20], [50, 30], [54, 36], [62, 64], [48, 66], [34, 64]], close: true, fill: true }, { p: 'poly', pts: [[26, 58], [14, 64]], w: 3 }, { p: 'poly', pts: [[52, 38], [60, 34]], w: 3 }, { p: 'poly', pts: [[55, 48], [64, 46]], w: 3 }],   // horse-head profile + rein + mane
  'monarchy': [{ p: 'poly', pts: [[26, 68], [30, 36], [42, 54], [50, 32], [58, 54], [70, 36], [74, 68]], close: true, fill: true }, { p: 'bar', x: 50, y: 74, w: 52, h: 8 }],
  'mysticism': [{ p: 'arc', x: 54, y: 50, r: 24, a0: 40, a1: 300, w: 12 }, star(70, 34, 9, 4)],
  'republic': [{ p: 'bar', x: 50, y: 30, w: 56, h: 8 }, { p: 'bar', x: 28, y: 58, w: 8, h: 38 }, { p: 'bar', x: 50, y: 58, w: 8, h: 38 }, { p: 'bar', x: 72, y: 58, w: 8, h: 38 }, { p: 'bar', x: 50, y: 80, w: 60, h: 8 }],   // three columns beneath a straight lintel
  'feudalism': [{ p: 'bar', x: 50, y: 62, w: 48, h: 34 }, { p: 'bar', x: 30, y: 40, w: 10, h: 16 }, { p: 'bar', x: 50, y: 40, w: 10, h: 16 }, { p: 'bar', x: 70, y: 40, w: 10, h: 16 }],

  // — renaissance —
  'astronomy': [star(50, 46, 16, 5), { p: 'ell', x: 50, y: 50, rx: 34, ry: 14, rot: 20, w: 5 }],
  'banking': [{ p: 'bar', x: 50, y: 52, w: 52, h: 46, r: 4, fill: false, w2: 7 }, { p: 'disc', x: 50, y: 40, r: 7 }, { p: 'disc', x: 50, y: 52, r: 7 }, { p: 'disc', x: 50, y: 64, r: 7 }],   // vault holding three stacked coins
  'chemistry': [{ p: 'poly', pts: [[42, 28], [58, 28]], w: 6 }, { p: 'poly', pts: [[44, 30], [44, 46], [30, 74], [70, 74], [56, 46], [56, 30]], close: true, w: 6 }, { p: 'poly', pts: [[38, 60], [62, 60]], w: 6 }],
  'chivalry': [{ p: 'poly', pts: [[50, 80], [28, 54], [30, 32], [70, 32], [72, 54]], close: true, w: 6 }, { p: 'poly', pts: [[32, 36], [66, 66]], w: 6 }, { p: 'poly', pts: [[40, 28], [42, 20], [46, 25], [50, 17], [54, 25], [58, 20], [60, 28]], close: true, fill: true }],   // heraldic kite shield, diagonal band, crown crest
  'gunpowder': [{ p: 'disc', x: 50, y: 50, r: 10 }, ...ringOf(10, 50, 50, 30, (px, py, a) => ({ p: 'poly', pts: [[50 + Math.cos(a) * 14, 50 + Math.sin(a) * 14], [px, py]], w: 4 }))],
  'invention': [{ p: 'disc', x: 50, y: 40, r: 18, fill: false, w: 6 }, { p: 'poly', pts: [[42, 56], [46, 62], [50, 56], [54, 62], [58, 56]], w: 4 }, { p: 'bar', x: 50, y: 68, w: 16, h: 5 }, { p: 'bar', x: 50, y: 74, w: 12, h: 4 }],   // lightbulb + zigzag filament/base
  'magnetism': [{ p: 'arc', x: 50, y: 40, r: 20, a0: 180, a1: 360, w: 11 }, { p: 'bar', x: 34, y: 62, w: 9, h: 20 }, { p: 'bar', x: 66, y: 62, w: 9, h: 20 }, { p: 'bar', x: 34, y: 74, w: 11, h: 7 }, { p: 'bar', x: 66, y: 74, w: 11, h: 7 }, { p: 'dots', pts: [[50, 72], [43, 80], [57, 80]], r: 3 }],   // U-magnet with pole tips pulling dots inward
  'medicine': [{ p: 'bar', x: 50, y: 50, w: 16, h: 48, r: 3 }, { p: 'bar', x: 50, y: 50, w: 48, h: 16, r: 3 }],
  'metallurgy': [{ p: 'poly', pts: [[34, 44], [66, 44], [60, 32], [40, 32]], close: true, fill: true }, { p: 'arc', x: 50, y: 56, r: 24, a0: 20, a1: 160, w: 6 }, { p: 'poly', pts: [[26, 58], [74, 58]], w: 5 }],   // faceted ingot above a crucible bowl
  'navigation': [{ p: 'disc', x: 50, y: 50, r: 6 }, { p: 'poly', pts: [[50, 50], [62, 26]], w: 5 }, { p: 'poly', pts: [[56, 30], [62, 26], [60, 34]], close: true, fill: true }, { p: 'poly', pts: [[50, 22], [50, 30]], w: 4 }, { p: 'poly', pts: [[50, 70], [50, 78]], w: 4 }, { p: 'poly', pts: [[22, 50], [30, 50]], w: 4 }, { p: 'poly', pts: [[70, 50], [78, 50]], w: 4 }],   // compass rose: needle + four cardinal points
  'philosophy': [{ p: 'bar', x: 50, y: 56, w: 12, h: 40 }, { p: 'bar', x: 50, y: 34, w: 34, h: 8 }, { p: 'bar', x: 50, y: 78, w: 34, h: 8 }, { p: 'poly', pts: [[46, 40], [46, 72]], w: 3 }, { p: 'poly', pts: [[54, 40], [54, 72]], w: 3 }],
  'physics': [{ p: 'poly', pts: [[50, 28], [68, 64], [32, 64]], close: true, w: 6 }, { p: 'poly', pts: [[16, 46], [42, 52]], w: 5 }, { p: 'poly', pts: [[58, 54], [84, 44]], w: 4 }, { p: 'poly', pts: [[58, 58], [84, 66]], w: 4 }],   // prism splitting a ray into two
  'religion': [{ p: 'disc', x: 50, y: 50, r: 14 }, ...ringOf(8, 50, 50, 30, (px, py, a) => ({ p: 'poly', pts: [[50 + Math.cos(a) * 20, 50 + Math.sin(a) * 20], [px, py]], w: 5 }))],
  'theory-of-gravity': [{ p: 'arc', x: 22, y: 24, r: 54, a0: 5, a1: 68, w: 4 }, { p: 'disc', x: 64, y: 58, r: 10 }, { p: 'bar', x: 50, y: 80, w: 60, h: 5 }],   // a mass descending a curved arc to a baseline
  'university': [{ p: 'poly', pts: [[24, 42], [50, 32], [76, 42], [50, 52]], close: true, fill: true }, { p: 'poly', pts: [[50, 52], [50, 66]], w: 4 }, { p: 'disc', x: 50, y: 68, r: 4 }, { p: 'arc', x: 50, y: 42, r: 16, a0: 20, a1: 160, w: 4 }],

  // — industrial —
  'atomic-theory': atom(50, 50, 30),
  'combustion': [{ p: 'bar', x: 50, y: 52, w: 32, h: 56, r: 3, fill: false, w2: 6 }, { p: 'bar', x: 50, y: 32, w: 14, h: 26, r: 2 }, { p: 'poly', pts: [[50, 60], [44, 72], [50, 68], [47, 80], [56, 66], [50, 70]], close: true, fill: true }],   // piston cylinder + flame in the lower chamber
  'communism': [star(50, 36, 20, 5), { p: 'bar', x: 50, y: 60, w: 52, h: 8 }, { p: 'bar', x: 38, y: 74, w: 16, h: 8 }, { p: 'bar', x: 62, y: 74, w: 16, h: 8 }],   // star above a broad bar on two supports
  'conscription': [{ p: 'bar', x: 40, y: 50, w: 6, h: 52, rot: -8 }, { p: 'bar', x: 52, y: 50, w: 6, h: 52 }, { p: 'bar', x: 64, y: 50, w: 6, h: 52, rot: 8 }, { p: 'poly', pts: [[36, 64], [52, 72], [36, 80]], close: true, fill: true }],   // three upright rifles behind a forward chevron
  'corporation': [{ p: 'bar', x: 50, y: 50, w: 16, h: 60 }, { p: 'bar', x: 30, y: 62, w: 14, h: 36 }, { p: 'bar', x: 70, y: 60, w: 14, h: 40 }, { p: 'bar', x: 50, y: 82, w: 60, h: 8 }],   // tall central tower flanked by two shorter
  'democracy': [{ p: 'bar', x: 50, y: 66, w: 44, h: 36, r: 3, fill: false, w2: 6 }, { p: 'bar', x: 50, y: 48, w: 26, h: 5 }, { p: 'bar', x: 53, y: 36, w: 18, h: 22, r: 2, rot: 14 }],   // a ballot dropping through a slot into a box
  'electricity': [{ p: 'poly', pts: [[56, 22], [34, 54], [48, 54], [42, 78], [66, 44], [52, 44]], close: true, fill: true }],
  'explosives': [{ p: 'bar', x: 38, y: 60, w: 11, h: 40, r: 2 }, { p: 'bar', x: 50, y: 60, w: 11, h: 40, r: 2 }, { p: 'bar', x: 62, y: 60, w: 11, h: 40, r: 2 }, { p: 'poly', pts: [[52, 40], [60, 28]], w: 3 }, star(62, 22, 7, 4)],   // three bundled bars, lit fuse, 4-point spark
  'flight': [{ p: 'bar', x: 50, y: 54, w: 12, h: 44, r: 4 }, { p: 'bar', x: 50, y: 46, w: 64, h: 10, r: 3 }, { p: 'disc', x: 50, y: 28, r: 7 }, { p: 'bar', x: 50, y: 76, w: 24, h: 7, r: 2 }],   // straight-wing propeller plane (top view)
  'industrialization': [{ p: 'bar', x: 50, y: 66, w: 52, h: 34 }, { p: 'bar', x: 30, y: 44, w: 10, h: 30 }, { p: 'disc', x: 32, y: 32, r: 6 }, { p: 'disc', x: 42, y: 26, r: 7 }, { p: 'poly', pts: [[40, 54], [52, 46], [52, 54], [64, 46], [64, 54], [76, 46]], w: 4 }],
  'railroad': [{ p: 'poly', pts: [[34, 24], [26, 78]], w: 6 }, { p: 'poly', pts: [[66, 24], [74, 78]], w: 6 }, { p: 'bar', x: 46, y: 36, w: 40, h: 6 }, { p: 'bar', x: 48, y: 54, w: 44, h: 6 }, { p: 'bar', x: 50, y: 72, w: 48, h: 6 }],
  'refining': [{ p: 'bar', x: 44, y: 52, w: 16, h: 56, r: 3, fill: false, w2: 6 }, { p: 'poly', pts: [[52, 42], [72, 42], [72, 54]], w: 5 }, { p: 'disc', x: 72, y: 61, r: 7 }, { p: 'poly', pts: [[52, 64], [28, 64], [28, 74]], w: 5 }, { p: 'disc', x: 28, y: 81, r: 7 }],   // distillation column with two output discs
  'steam-engine': [{ p: 'bar', x: 46, y: 58, w: 40, h: 26, r: 3 }, { p: 'disc', x: 66, y: 72, r: 10 }, { p: 'bar', x: 40, y: 40, w: 10, h: 16 }, { p: 'disc', x: 40, y: 28, r: 6 }, { p: 'disc', x: 48, y: 22, r: 5 }],
  'steel': [{ p: 'bar', x: 34, y: 50, w: 10, h: 48 }, { p: 'bar', x: 66, y: 50, w: 10, h: 48 }, { p: 'bar', x: 50, y: 50, w: 34, h: 10 }],

  // — modern —
  'advanced-flight': [{ p: 'poly', pts: [[50, 20], [58, 52], [50, 46], [42, 52]], close: true, fill: true }, { p: 'poly', pts: [[50, 46], [78, 66], [54, 60], [50, 72], [46, 60], [22, 66]], close: true, fill: true }, { p: 'poly', pts: [[38, 76], [36, 88]], w: 3 }, { p: 'poly', pts: [[50, 78], [50, 90]], w: 3 }, { p: 'poly', pts: [[62, 76], [64, 88]], w: 3 }],   // swept-wing jet + trailing speed lines
  'automobile': [{ p: 'poly', pts: [[24, 60], [30, 46], [44, 40], [62, 40], [72, 52], [78, 54], [78, 62]], close: true, w: 6 }, { p: 'disc', x: 38, y: 64, r: 9 }, { p: 'disc', x: 66, y: 64, r: 9 }],
  'computers': [{ p: 'bar', x: 50, y: 46, w: 52, h: 36, r: 3 }, { p: 'bar', x: 50, y: 46, w: 40, h: 24, r: 2, fill: false, w2: 3 }, { p: 'bar', x: 50, y: 70, w: 20, h: 10 }, { p: 'bar', x: 50, y: 78, w: 34, h: 6 }],
  'electronics': [{ p: 'bar', x: 50, y: 50, w: 36, h: 36, r: 3, fill: false, w2: 6 }, { p: 'disc', x: 50, y: 50, r: 5 }, ...[38, 46, 54, 62].map(x => ({ p: 'bar', x, y: 28, w: 4, h: 8 })), ...[38, 46, 54, 62].map(x => ({ p: 'bar', x, y: 72, w: 4, h: 8 })), ...[38, 46, 54, 62].map(y => ({ p: 'bar', x: 28, y, w: 8, h: 4 })), ...[38, 46, 54, 62].map(y => ({ p: 'bar', x: 72, y, w: 8, h: 4 }))],   // microchip: pins each side + central circuit dot
  'fusion-power': [{ p: 'disc', x: 32, y: 50, r: 8 }, { p: 'disc', x: 68, y: 50, r: 8 }, { p: 'disc', x: 50, y: 50, r: 11 }, { p: 'arc', x: 50, y: 50, r: 26, a0: 300, a1: 600, w: 5 }],   // two discs converging into a bright core, energy ring
  'future-tech': [{ p: 'arc', x: 50, y: 50, r: 20, a0: 300, a1: 590, w: 6 }, { p: 'arc', x: 28, y: 52, r: 26, a0: 250, a1: 350, w: 4 }, { p: 'arc', x: 72, y: 52, r: 26, a0: 190, a1: 290, w: 4 }],   // open broken ring curving out to two horizon arcs
  'genetic-engineering': [{ p: 'poly', pts: [[38, 26], [62, 42], [38, 58], [62, 74]], w: 6 }, { p: 'poly', pts: [[62, 26], [38, 42], [62, 58], [38, 74]], w: 6 }, ...[34, 50, 66].map(y => ({ p: 'poly', pts: [[42, y], [58, y]], w: 3 }))],
  'labor-union': [{ p: 'bar', x: 34, y: 54, w: 8, h: 34 }, { p: 'disc', x: 34, y: 34, r: 8 }, { p: 'bar', x: 50, y: 50, w: 8, h: 38 }, { p: 'disc', x: 50, y: 28, r: 8 }, { p: 'bar', x: 66, y: 54, w: 8, h: 34 }, { p: 'disc', x: 66, y: 34, r: 8 }, { p: 'bar', x: 50, y: 72, w: 48, h: 7 }],   // three raised fists linked at the wrist
  'mass-production': [{ p: 'bar', x: 50, y: 68, w: 60, h: 8 }, { p: 'disc', x: 30, y: 50, r: 10 }, { p: 'disc', x: 50, y: 50, r: 10 }, { p: 'disc', x: 70, y: 50, r: 10 }, ...[30, 50, 70].map(x => ({ p: 'poly', pts: [[x, 60], [x, 64]], w: 3 }))],
  'nuclear-fission': [{ p: 'disc', x: 34, y: 50, r: 13 }, { p: 'disc', x: 66, y: 50, r: 13 }, { p: 'dots', pts: [[50, 24], [24, 72], [76, 72]], r: 4 }],   // nucleus split into two, particles escaping
  'nuclear-power': [{ p: 'poly', pts: [[32, 78], [38, 48], [62, 48], [68, 78]], close: true, w: 6 }, { p: 'arc', x: 43, y: 36, r: 6, a0: 180, a1: 360, w: 3 }, { p: 'arc', x: 52, y: 30, r: 6, a0: 180, a1: 360, w: 3 }, { p: 'arc', x: 61, y: 36, r: 6, a0: 180, a1: 360, w: 3 }],   // cooling tower + rising heat arcs
  'plastics': [{ p: 'bar', x: 50, y: 62, w: 34, h: 44, r: 12 }, { p: 'bar', x: 50, y: 38, w: 14, h: 16, r: 2 }, { p: 'bar', x: 50, y: 28, w: 18, h: 8, r: 2 }],   // molded bottle: body, narrow neck, cap
  'recycling': [...ringOf(3, 50, 50, 24, (px, py, a) => ({ p: 'poly', pts: [[px, py], [50 + Math.cos(a + 2.0) * 24, 50 + Math.sin(a + 2.0) * 24]], w: 7 })), ...ringOf(3, 50, 50, 24, (px, py, a) => ({ p: 'poly', pts: [[50 + Math.cos(a + 1.7) * 30, 50 + Math.sin(a + 1.7) * 30], [50 + Math.cos(a + 2.0) * 24, 50 + Math.sin(a + 2.0) * 24], [50 + Math.cos(a + 2.0) * 16, 50 + Math.sin(a + 2.0) * 16]], close: true, fill: true }))],
  'robotics': [{ p: 'bar', x: 50, y: 52, w: 44, h: 40, r: 6 }, { p: 'disc', x: 40, y: 48, r: 6 }, { p: 'disc', x: 60, y: 48, r: 6 }, { p: 'bar', x: 50, y: 66, w: 20, h: 6 }, { p: 'poly', pts: [[50, 32], [50, 24]], w: 4 }, { p: 'disc', x: 50, y: 22, r: 4 }],
  'rocketry': [{ p: 'poly', pts: [[50, 22], [60, 46], [60, 70], [40, 70], [40, 46]], close: true, w: 6 }, { p: 'poly', pts: [[40, 62], [28, 78], [40, 74]], close: true, fill: true }, { p: 'poly', pts: [[60, 62], [72, 78], [60, 74]], close: true, fill: true }, { p: 'disc', x: 50, y: 48, r: 6 }],
  'space-flight': [{ p: 'poly', pts: [[44, 24], [52, 40], [52, 60], [36, 60], [36, 40]], close: true, w: 5 }, { p: 'poly', pts: [[36, 54], [26, 68], [36, 64]], close: true, fill: true }, { p: 'ell', x: 56, y: 58, rx: 30, ry: 12, rot: -25, w: 5 }],
  'superconductor': [{ p: 'ring', x: 50, y: 50, r: 26, w: 6 }, { p: 'disc', x: 50, y: 50, r: 9 }, { p: 'poly', pts: [[50, 24], [44, 32]], w: 4 }, { p: 'poly', pts: [[50, 24], [56, 32]], w: 4 }, { p: 'poly', pts: [[50, 76], [44, 68]], w: 4 }, { p: 'poly', pts: [[50, 76], [56, 68]], w: 4 }]
};

// All ally motif concepts landed (specs/ally-glyph-request-2026-07-19.md,
// 2026-07-19) and are implemented above — no provisional motifs remain, so
// nothing is flagged. Kept as an exported (empty) list so the glyph-sheet's
// amber-marking code stays valid.
export const FLAGGED = [];

// --- renderer (DOM/canvas) --------------------------------------------------
function drawPrim(ctx, pr, ink) {
  ctx.strokeStyle = ink; ctx.fillStyle = ink;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (pr.p === 'disc') {
    ctx.lineWidth = pr.w || 6; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
    pr.fill === false ? ctx.stroke() : ctx.fill();
  } else if (pr.p === 'ring') {
    ctx.lineWidth = pr.w || 6; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2); ctx.stroke();
  } else if (pr.p === 'arc') {
    ctx.lineWidth = pr.w || 6; ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, (pr.a0 * Math.PI) / 180, (pr.a1 * Math.PI) / 180); ctx.stroke();
  } else if (pr.p === 'ell') {
    ctx.lineWidth = pr.w || 6; ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, pr.rx, pr.ry, ((pr.rot || 0) * Math.PI) / 180, 0, Math.PI * 2);
    pr.fill ? ctx.fill() : ctx.stroke();
  } else if (pr.p === 'bar') {
    ctx.save(); ctx.translate(pr.x, pr.y); if (pr.rot) ctx.rotate((pr.rot * Math.PI) / 180);
    const w = pr.w, h = pr.h, r = pr.r || 0;
    ctx.beginPath();
    if (r > 0) {
      ctx.moveTo(-w / 2 + r, -h / 2);
      ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r); ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
      ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r); ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r); ctx.closePath();
    } else ctx.rect(-w / 2, -h / 2, w, h);
    if (pr.fill === false) { ctx.lineWidth = pr.w2 || 4; ctx.stroke(); } else ctx.fill();
    ctx.restore();
  } else if (pr.p === 'poly') {
    ctx.lineWidth = pr.w || 6; ctx.beginPath();
    pr.pts.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]));
    if (pr.close) ctx.closePath();
    pr.fill ? ctx.fill() : ctx.stroke();
  } else if (pr.p === 'letter') {
    ctx.font = `700 ${pr.size}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pr.ch, pr.x, pr.y);
  }
}

// draw a glyph into a fresh (or supplied) canvas, sized `size` px. `era` picks
// the frame + ink palette. Returns the canvas.
export function drawGlyph(id, era, size, canvas) {
  const c = canvas || document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const pal = ERA[era] || ERA.ancient;
  const s = size / 100;
  ctx.save(); ctx.scale(s, s);
  // frame: an era-colored rounded badge
  ctx.fillStyle = pal.fill; ctx.strokeStyle = pal.edge; ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  const r = 20, a = 7, b = 93;
  ctx.beginPath();
  ctx.moveTo(a + r, a); ctx.arcTo(b, a, b, b, r); ctx.arcTo(b, b, a, b, r);
  ctx.arcTo(a, b, a, a, r); ctx.arcTo(a, a, b, a, r); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // motif
  const motif = GLYPH[id];
  if (motif && motif.length) { for (const pr of motif) drawPrim(ctx, pr, pal.ink); }
  else { drawPrim(ctx, { p: 'letter', ch: (id[0] || '?').toUpperCase(), x: 50, y: 52, size: 54 }, pal.ink); }
  ctx.restore();
  return c;
}

// cache by id+era+size → a data URL, so the tree's 68 nodes reuse one bitmap.
const _cache = {};
export function glyphDataURL(id, era, size) {
  const key = id + '|' + era + '|' + size;
  if (!_cache[key]) _cache[key] = drawGlyph(id, era, size).toDataURL();
  return _cache[key];
}

// convenience: an <img> element carrying the cached glyph (the tree/card/readout
// all take an <img> so the same bitmap is shared).
export function glyphImg(id, era, size) {
  const img = new Image(size, size);
  img.src = glyphDataURL(id, era, size);
  img.className = 'tech-glyph';
  img.alt = '';
  return img;
}

export function hasMotif(id) { return !!(GLYPH[id] && GLYPH[id].length); }
