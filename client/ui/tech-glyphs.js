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
function gear(x, y, r) {
  return [
    ...ringOf(8, x, y, r, (px, py, a) => ({ p: 'bar', x: px, y: py, w: 9, h: 9, rot: (a * 180) / Math.PI })),
    { p: 'ring', x, y, r, w: 9 },
    { p: 'disc', x, y, r: 7 }
  ];
}
function coin(x, y, r, mark) {
  return [{ p: 'ring', x, y, r, w: 7 }, { p: 'ring', x, y, r: r - 8, w: 3 },
    { p: 'letter', ch: mark || '$', x, y, size: r * 1.1 }];
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
  'ceremonial-burial': [{ p: 'bar', x: 50, y: 60, w: 10, h: 40 }, { p: 'bar', x: 50, y: 40, w: 32, h: 10 }, { p: 'ring', x: 50, y: 30, r: 9, w: 5 }],   // FLAGGED: ankh/grave
  'code-of-laws': [{ p: 'poly', pts: [[50, 24], [50, 74]], w: 6 }, { p: 'poly', pts: [[24, 34], [76, 34]], w: 6 }, { p: 'arc', x: 30, y: 34, r: 14, a0: 0, a1: 180, w: 5 }, { p: 'arc', x: 70, y: 34, r: 14, a0: 0, a1: 180, w: 5 }, { p: 'bar', x: 50, y: 78, w: 34, h: 8 }],
  'currency': coin(50, 50, 26, '$'),   // FLAGGED: coin vs banking/trade cluster
  'mathematics': [{ p: 'poly', pts: [[26, 72], [74, 72], [26, 30]], close: true, w: 7 }, { p: 'poly', pts: [[34, 66], [40, 66], [40, 72]], close: true, w: 4 }],
  'trade': [{ p: 'poly', pts: [[24, 40], [70, 40]], w: 7 }, { p: 'poly', pts: [[60, 30], [72, 40], [60, 50]], close: true, fill: true }, { p: 'poly', pts: [[30, 64], [76, 64]], w: 7 }, { p: 'poly', pts: [[40, 54], [28, 64], [40, 74]], close: true, fill: true }],   // FLAGGED: exchange arrows
  'construction': [{ p: 'arc', x: 50, y: 60, r: 26, a0: 180, a1: 360, w: 8 }, { p: 'bar', x: 26, y: 72, w: 8, h: 28 }, { p: 'bar', x: 74, y: 72, w: 8, h: 28 }, { p: 'bar', x: 50, y: 34, w: 12, h: 10 }],   // FLAGGED: arch/keystone vs engineering
  'engineering': gear(50, 50, 26),   // FLAGGED: gear vs invention; aqueduct?
  'bridge-building': [{ p: 'arc', x: 50, y: 58, r: 24, a0: 180, a1: 360, w: 7 }, { p: 'bar', x: 50, y: 40, w: 60, h: 8 }, ...ringOf(3, 50, 58, 24, (px, py) => ({ p: 'poly', pts: [[px, 44], [px, py]], w: 4 }))],
  'map-making': [{ p: 'poly', pts: [[24, 32], [44, 40], [58, 32], [76, 40], [76, 72], [58, 64], [44, 72], [24, 64]], close: true, w: 6 }, { p: 'poly', pts: [[44, 40], [44, 72]], w: 4 }, { p: 'poly', pts: [[58, 32], [58, 64]], w: 4 }],   // FLAGGED: map vs navigation
  'horseback-riding': [{ p: 'arc', x: 50, y: 46, r: 24, a0: 200, a1: 520, w: 9 }, ...ringOf(6, 50, 46, 24, (px, py) => ({ p: 'disc', x: px, y: py, r: 3 }))],   // FLAGGED: horseshoe vs magnetism
  'monarchy': [{ p: 'poly', pts: [[26, 68], [30, 36], [42, 54], [50, 32], [58, 54], [70, 36], [74, 68]], close: true, fill: true }, { p: 'bar', x: 50, y: 74, w: 52, h: 8 }],
  'mysticism': [{ p: 'arc', x: 54, y: 50, r: 24, a0: 40, a1: 300, w: 12 }, star(70, 34, 9, 4)],
  'republic': [{ p: 'bar', x: 30, y: 56, w: 8, h: 40 }, { p: 'bar', x: 50, y: 56, w: 8, h: 40 }, { p: 'bar', x: 70, y: 56, w: 8, h: 40 }, { p: 'poly', pts: [[20, 34], [80, 34], [70, 26], [30, 26]], close: true, fill: true }, { p: 'bar', x: 50, y: 78, w: 56, h: 8 }],   // FLAGGED: columns vs democracy/philosophy
  'feudalism': [{ p: 'bar', x: 50, y: 62, w: 48, h: 34 }, { p: 'bar', x: 30, y: 40, w: 10, h: 16 }, { p: 'bar', x: 50, y: 40, w: 10, h: 16 }, { p: 'bar', x: 70, y: 40, w: 10, h: 16 }],

  // — renaissance —
  'astronomy': [star(50, 46, 16, 5), { p: 'ell', x: 50, y: 50, rx: 34, ry: 14, rot: 20, w: 5 }],
  'banking': [{ p: 'ring', x: 38, y: 42, r: 12, w: 5 }, { p: 'ring', x: 58, y: 50, r: 12, w: 5 }, { p: 'ring', x: 46, y: 62, r: 12, w: 5 }],   // FLAGGED: stacked coins vs currency
  'chemistry': [{ p: 'poly', pts: [[42, 28], [58, 28]], w: 6 }, { p: 'poly', pts: [[44, 30], [44, 46], [30, 74], [70, 74], [56, 46], [56, 30]], close: true, w: 6 }, { p: 'poly', pts: [[38, 60], [62, 60]], w: 6 }],
  'chivalry': [{ p: 'poly', pts: [[50, 26], [74, 36], [74, 58], [50, 78], [26, 58], [26, 36]], close: true, w: 6 }, { p: 'poly', pts: [[50, 36], [50, 68]], w: 5 }, { p: 'poly', pts: [[36, 48], [64, 48]], w: 5 }],   // FLAGGED: shield/heraldry
  'gunpowder': [{ p: 'disc', x: 50, y: 50, r: 10 }, ...ringOf(10, 50, 50, 30, (px, py, a) => ({ p: 'poly', pts: [[50 + Math.cos(a) * 14, 50 + Math.sin(a) * 14], [px, py]], w: 4 }))],
  'invention': [{ p: 'disc', x: 50, y: 40, r: 18, fill: false, w: 6 }, { p: 'poly', pts: [[42, 56], [58, 56], [56, 68], [44, 68]], close: true, w: 5 }, { p: 'bar', x: 50, y: 74, w: 18, h: 6 }, ...ringOf(5, 50, 40, 26, (px, py) => ({ p: 'poly', pts: [[50, 40], [px, py]], w: 3 }))],   // FLAGGED: lightbulb vs engineering gear
  'magnetism': [{ p: 'arc', x: 50, y: 42, r: 22, a0: 180, a1: 360, w: 12 }, { p: 'bar', x: 32, y: 66, w: 10, h: 18 }, { p: 'bar', x: 68, y: 66, w: 10, h: 18 }],   // FLAGGED: horseshoe magnet vs horseback
  'medicine': [{ p: 'bar', x: 50, y: 50, w: 16, h: 48, r: 3 }, { p: 'bar', x: 50, y: 50, w: 48, h: 16, r: 3 }],
  'metallurgy': [{ p: 'ring', x: 34, y: 66, r: 12, w: 6 }, { p: 'bar', x: 56, y: 50, w: 44, h: 14, r: 3, rot: -18 }, { p: 'disc', x: 78, y: 40, r: 6 }],   // FLAGGED: cannon
  'navigation': [star(50, 50, 30, 4, 8), { p: 'ring', x: 50, y: 50, r: 30, w: 4 }, { p: 'letter', ch: 'N', x: 50, y: 24, size: 18 }],
  'philosophy': [{ p: 'bar', x: 50, y: 56, w: 12, h: 40 }, { p: 'bar', x: 50, y: 34, w: 34, h: 8 }, { p: 'bar', x: 50, y: 78, w: 34, h: 8 }, { p: 'poly', pts: [[46, 40], [46, 72]], w: 3 }, { p: 'poly', pts: [[54, 40], [54, 72]], w: 3 }],
  'physics': [{ p: 'poly', pts: [[50, 24], [50, 50]], w: 5 }, { p: 'disc', x: 50, y: 62, r: 12 }, { p: 'arc', x: 50, y: 24, r: 20, a0: 60, a1: 120, w: 4 }],   // FLAGGED: pendulum vs prism
  'religion': [{ p: 'disc', x: 50, y: 50, r: 14 }, ...ringOf(8, 50, 50, 30, (px, py, a) => ({ p: 'poly', pts: [[50 + Math.cos(a) * 20, 50 + Math.sin(a) * 20], [px, py]], w: 5 }))],
  'theory-of-gravity': [{ p: 'disc', x: 50, y: 40, r: 12 }, { p: 'poly', pts: [[50, 28], [56, 22]], w: 4 }, { p: 'arc', x: 50, y: 66, r: 24, a0: 200, a1: 340, w: 5 }, { p: 'poly', pts: [[50, 54], [50, 74]], w: 4 }, { p: 'poly', pts: [[44, 68], [50, 76], [56, 68]], close: true, fill: true }],   // FLAGGED: apple + fall arc
  'university': [{ p: 'poly', pts: [[24, 42], [50, 32], [76, 42], [50, 52]], close: true, fill: true }, { p: 'poly', pts: [[50, 52], [50, 66]], w: 4 }, { p: 'disc', x: 50, y: 68, r: 4 }, { p: 'arc', x: 50, y: 42, r: 16, a0: 20, a1: 160, w: 4 }],

  // — industrial —
  'atomic-theory': atom(50, 50, 30),
  'combustion': [{ p: 'poly', pts: [[50, 24], [40, 44], [50, 40], [44, 60], [58, 38], [50, 42]], close: true, fill: true }, { p: 'poly', pts: [[38, 64], [62, 64], [58, 78], [42, 78]], close: true, w: 5 }],   // FLAGGED: flame vs piston
  'communism': [star(50, 50, 30, 5)],   // FLAGGED: star vs hammer-sickle
  'conscription': [{ p: 'poly', pts: [[30, 28], [70, 72]], w: 8 }, { p: 'poly', pts: [[70, 28], [30, 72]], w: 8 }, { p: 'disc', x: 30, y: 28, r: 5 }, { p: 'disc', x: 70, y: 28, r: 5 }],   // FLAGGED: crossed rifles
  'corporation': [{ p: 'bar', x: 34, y: 66, w: 14, h: 28 }, { p: 'bar', x: 50, y: 56, w: 14, h: 48 }, { p: 'bar', x: 66, y: 44, w: 14, h: 72 }, { p: 'poly', pts: [[26, 40], [46, 52], [66, 34]], w: 4 }],   // FLAGGED: growth bars
  'democracy': [{ p: 'bar', x: 50, y: 60, w: 40, h: 44, r: 3 }, { p: 'poly', pts: [[38, 60], [50, 46], [62, 60]], close: true, w: 5 }, { p: 'poly', pts: [[46, 40], [54, 30]], w: 5 }],   // FLAGGED: ballot box vs republic
  'electricity': [{ p: 'poly', pts: [[56, 22], [34, 54], [48, 54], [42, 78], [66, 44], [52, 44]], close: true, fill: true }],
  'explosives': [{ p: 'bar', x: 42, y: 58, w: 18, h: 42, r: 2, rot: -10 }, { p: 'bar', x: 58, y: 58, w: 18, h: 42, r: 2, rot: 10 }, { p: 'poly', pts: [[42, 30], [40, 20]], w: 3 }, { p: 'disc', x: 40, y: 18, r: 4 }],   // FLAGGED: TNT bundle
  'flight': [{ p: 'poly', pts: [[50, 30], [58, 50], [50, 46], [42, 50]], close: true, fill: true }, { p: 'poly', pts: [[20, 58], [80, 58], [50, 50]], close: true, fill: true }, { p: 'bar', x: 50, y: 68, w: 8, h: 20 }],   // FLAGGED: wing/plane vs advanced-flight
  'industrialization': [{ p: 'bar', x: 50, y: 66, w: 52, h: 34 }, { p: 'bar', x: 30, y: 44, w: 10, h: 30 }, { p: 'disc', x: 32, y: 32, r: 6 }, { p: 'disc', x: 42, y: 26, r: 7 }, { p: 'poly', pts: [[40, 54], [52, 46], [52, 54], [64, 46], [64, 54], [76, 46]], w: 4 }],
  'railroad': [{ p: 'poly', pts: [[34, 24], [26, 78]], w: 6 }, { p: 'poly', pts: [[66, 24], [74, 78]], w: 6 }, { p: 'bar', x: 46, y: 36, w: 40, h: 6 }, { p: 'bar', x: 48, y: 54, w: 44, h: 6 }, { p: 'bar', x: 50, y: 72, w: 48, h: 6 }],
  'refining': [{ p: 'poly', pts: [[30, 78], [40, 30], [60, 30], [70, 78]], close: true, w: 6 }, { p: 'poly', pts: [[36, 54], [64, 54]], w: 5 }, { p: 'disc', x: 50, y: 24, r: 6 }],   // FLAGGED: derrick vs barrel
  'steam-engine': [{ p: 'bar', x: 46, y: 58, w: 40, h: 26, r: 3 }, { p: 'disc', x: 66, y: 72, r: 10 }, { p: 'bar', x: 40, y: 40, w: 10, h: 16 }, { p: 'disc', x: 40, y: 28, r: 6 }, { p: 'disc', x: 48, y: 22, r: 5 }],
  'steel': [{ p: 'bar', x: 34, y: 50, w: 10, h: 48 }, { p: 'bar', x: 66, y: 50, w: 10, h: 48 }, { p: 'bar', x: 50, y: 50, w: 34, h: 10 }],

  // — modern —
  'advanced-flight': [{ p: 'poly', pts: [[50, 22], [56, 44], [80, 62], [56, 58], [50, 78], [44, 58], [20, 62], [44, 44]], close: true, fill: true }],   // FLAGGED: jet vs flight
  'automobile': [{ p: 'poly', pts: [[24, 60], [30, 46], [44, 40], [62, 40], [72, 52], [78, 54], [78, 62]], close: true, w: 6 }, { p: 'disc', x: 38, y: 64, r: 9 }, { p: 'disc', x: 66, y: 64, r: 9 }],
  'computers': [{ p: 'bar', x: 50, y: 46, w: 52, h: 36, r: 3 }, { p: 'bar', x: 50, y: 46, w: 40, h: 24, r: 2, fill: false, w2: 3 }, { p: 'bar', x: 50, y: 70, w: 20, h: 10 }, { p: 'bar', x: 50, y: 78, w: 34, h: 6 }],
  'electronics': [{ p: 'disc', x: 26, y: 50, r: 6 }, { p: 'poly', pts: [[26, 50], [42, 50]], w: 4 }, { p: 'bar', x: 54, y: 50, w: 24, h: 12, r: 2, fill: false, w2: 4 }, { p: 'poly', pts: [[66, 50], [78, 50]], w: 4 }, { p: 'disc', x: 78, y: 50, r: 6 }],   // FLAGGED: resistor/circuit
  'fusion-power': [{ p: 'disc', x: 50, y: 50, r: 12 }, ...ringOf(12, 50, 50, 30, (px, py, a) => ({ p: 'poly', pts: [[50 + Math.cos(a) * 16, 50 + Math.sin(a) * 16], [px, py]], w: 4 })), { p: 'ring', x: 50, y: 50, r: 22, w: 3 }],   // FLAGGED: bright core / two nuclei merging
  'future-tech': [star(50, 50, 30, 8, 12), { p: 'disc', x: 50, y: 50, r: 7 }],   // FLAGGED: burst/infinity — the endless sink
  'genetic-engineering': [{ p: 'poly', pts: [[38, 26], [62, 42], [38, 58], [62, 74]], w: 6 }, { p: 'poly', pts: [[62, 26], [38, 42], [62, 58], [38, 74]], w: 6 }, ...[34, 50, 66].map(y => ({ p: 'poly', pts: [[42, y], [58, y]], w: 3 }))],
  'labor-union': [{ p: 'arc', x: 42, y: 52, r: 16, a0: 300, a1: 500, w: 8 }, { p: 'arc', x: 58, y: 52, r: 16, a0: 120, a1: 320, w: 8 }, { p: 'disc', x: 50, y: 52, r: 5 }],   // FLAGGED: clasped hands / solidarity
  'mass-production': [{ p: 'bar', x: 50, y: 68, w: 60, h: 8 }, { p: 'disc', x: 30, y: 50, r: 10 }, { p: 'disc', x: 50, y: 50, r: 10 }, { p: 'disc', x: 70, y: 50, r: 10 }, ...[30, 50, 70].map(x => ({ p: 'poly', pts: [[x, 60], [x, 64]], w: 3 }))],
  'nuclear-fission': [...atom(50, 50, 28), { p: 'poly', pts: [[22, 22], [78, 78]], w: 4 }],   // FLAGGED: splitting atom
  'nuclear-power': [{ p: 'poly', pts: [[32, 78], [38, 48], [62, 48], [68, 78]], close: true, w: 6 }, { p: 'disc', x: 44, y: 34, r: 6 }, { p: 'disc', x: 54, y: 26, r: 7 }, { p: 'disc', x: 62, y: 36, r: 5 }],   // FLAGGED: cooling tower
  'plastics': [...ringOf(5, 50, 50, 22, (px, py) => ({ p: 'disc', x: px, y: py, r: 8 })), ...ringOf(5, 50, 50, 22, (px, py, a) => ({ p: 'poly', pts: [[px, py], [50 + Math.cos(a + 1.25) * 22, 50 + Math.sin(a + 1.25) * 22]], w: 4 }))],   // FLAGGED: polymer chain vs bottle
  'recycling': [...ringOf(3, 50, 50, 24, (px, py, a) => ({ p: 'poly', pts: [[px, py], [50 + Math.cos(a + 2.0) * 24, 50 + Math.sin(a + 2.0) * 24]], w: 7 })), ...ringOf(3, 50, 50, 24, (px, py, a) => ({ p: 'poly', pts: [[50 + Math.cos(a + 1.7) * 30, 50 + Math.sin(a + 1.7) * 30], [50 + Math.cos(a + 2.0) * 24, 50 + Math.sin(a + 2.0) * 24], [50 + Math.cos(a + 2.0) * 16, 50 + Math.sin(a + 2.0) * 16]], close: true, fill: true }))],
  'robotics': [{ p: 'bar', x: 50, y: 52, w: 44, h: 40, r: 6 }, { p: 'disc', x: 40, y: 48, r: 6 }, { p: 'disc', x: 60, y: 48, r: 6 }, { p: 'bar', x: 50, y: 66, w: 20, h: 6 }, { p: 'poly', pts: [[50, 32], [50, 24]], w: 4 }, { p: 'disc', x: 50, y: 22, r: 4 }],
  'rocketry': [{ p: 'poly', pts: [[50, 22], [60, 46], [60, 70], [40, 70], [40, 46]], close: true, w: 6 }, { p: 'poly', pts: [[40, 62], [28, 78], [40, 74]], close: true, fill: true }, { p: 'poly', pts: [[60, 62], [72, 78], [60, 74]], close: true, fill: true }, { p: 'disc', x: 50, y: 48, r: 6 }],
  'space-flight': [{ p: 'poly', pts: [[44, 24], [52, 40], [52, 60], [36, 60], [36, 40]], close: true, w: 5 }, { p: 'poly', pts: [[36, 54], [26, 68], [36, 64]], close: true, fill: true }, { p: 'ell', x: 56, y: 58, rx: 30, ry: 12, rot: -25, w: 5 }],
  'superconductor': [{ p: 'ell', x: 50, y: 62, rx: 28, ry: 10, w: 6 }, { p: 'disc', x: 50, y: 44, r: 12 }, { p: 'poly', pts: [[36, 54], [64, 54]], w: 4 }],   // FLAGGED: magnetic levitation / coil
  'electronics_dup': []
};
delete GLYPH['electronics_dup'];

// The motifs above tagged with a trailing "// FLAGGED" comment are provisional
// and want a design-pass concept from the ally (parallel to the blurbs). Kept
// as an explicit list so the tree can badge them and the architect can route.
export const FLAGGED = [
  'bronze-working', 'iron-working', 'ceremonial-burial', 'currency', 'trade',
  'construction', 'engineering', 'map-making', 'horseback-riding', 'republic',
  'banking', 'chivalry', 'invention', 'magnetism', 'metallurgy', 'physics',
  'theory-of-gravity', 'combustion', 'communism', 'conscription', 'corporation',
  'democracy', 'explosives', 'flight', 'refining', 'advanced-flight',
  'electronics', 'fusion-power', 'future-tech', 'labor-union', 'nuclear-fission',
  'nuclear-power', 'plastics', 'superconductor'
];

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
