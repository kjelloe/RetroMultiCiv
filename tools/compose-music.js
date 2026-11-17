// Writes client/music/pieces/<id>.json from the hand-written lines below.
// The notes are this game's own (method: client/music/README.md §5 — the scene
// sentence first, then tempo/metre, mode, bass, pads, melody last). Each melody
// is a list of bars, "note:beats" tokens, `r` for a rest; every bar must fill
// the metre exactly. Chords are per bar: "bass padLow padHigh". The ids, the era
// arc and the restraint rules come from specs/game-soundtrack-design.md (map
// tracks sit under thinking: sparse, low, no bombast; a small motif — scale
// degrees 1 2 5 4 — opens every map era so the eras read as one world ageing).
//   node tools/compose-music.js          write the pieces
//   node tools/compose-music.js --check  fail if a committed piece differs
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'client', 'music', 'pieces');
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midi(name) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + STEP[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

function melody(bars, beats, id) {
  const notes = [];
  bars.forEach((bar, i) => {
    let at = 0;
    for (const tok of bar.split(/\s+/)) {
      const [n, len] = tok.split(':');
      if (n !== 'r') notes.push([i * beats + at, midi(n), Number(len)]);
      at += Number(len);
    }
    if (Math.abs(at - beats) > 1e-9) throw new Error(`${id} bar ${i + 1} holds ${at} beats, not ${beats}`);
  });
  return notes;
}

const BASS = {
  hold: (r, b) => [[0, r, b]],
  halves: r => [[0, r, 2], [2, r + 7, 2]],
  quarters: r => [[0, r, 1], [1, r, 1], [2, r + 7, 1], [3, r, 1]],
  walk: r => [[0, r, 1], [1, r + 7, 1], [2, r + 12, 1], [3, r + 7, 1]],
  pulse8: r => [0, 0, 0, 0, 0, 0, 0, 12].map((s, k) => [k * 0.5, r + s, 0.5]),
  war8: r => [0, 0, 12, 0, 0, 10, 7, 12].map((s, k) => [k * 0.5, r + s, 0.5])
};

function chordsOf(spec) {
  return spec.prog.map(c => spec.chords[c].split(' ').map(midi));
}

// eighth-note arpeggio over the bar's chord, two octaves up from the bass
function arp(chords, fromBar) {
  return chords.map(([b, lo, hi], i) => (i < fromBar ? 'r:4'
    : [b + 24, lo + 12, hi + 12, b + 36, hi + 12, lo + 12, hi + 12, lo + 12].map(m => `${name(m)}:0.5`).join(' ')));
}
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function name(m) { return NAMES[m % 12] + (Math.floor(m / 12) - 1); }

function build(spec) {
  const beats = spec.beats;
  const chords = chordsOf(spec);
  const bars = chords.length;
  const tracks = [];
  for (const t of spec.lines) {
    if (t.bars.length !== bars) throw new Error(`${spec.id} ${t.patch} has ${t.bars.length} bars, the chords ${bars}`);
    tracks.push({ patch: t.patch, gain: t.gain, notes: melody(t.bars, beats, spec.id) });
  }
  for (const k of [1, 2]) {
    tracks.push({ patch: 'pad', gain: spec.pad, notes: chords.map((c, i) => [i * beats, c[k], beats]) });
  }
  const from = spec.bass.from || 0;
  const bass = [];
  chords.forEach((c, i) => { if (i >= from) for (const [at, m, len] of BASS[spec.bass.style](c[0], beats)) bass.push([i * beats + at, m, len]); });
  tracks.push({ patch: 'bass', gain: spec.bass.gain, notes: bass });
  for (const d of spec.drums || []) {
    const notes = [];
    for (let i = 0; i < bars; i++) {
      const hits = d.bars ? d.bars[i + 1] : d.hits;
      if (hits) for (const at of hits) notes.push([i * beats + at, d.midi, d.len || 0.25]);
    }
    tracks.push({ patch: 'drum', gain: d.gain, notes });
  }
  return { bpm: spec.bpm, beats, loop: true, tracks };
}

const EIGHTHS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];

const PIECES = [
  {
    // the setup screen: a map unrolled by candlelight, all of history ahead, curious rather than proud
    id: 'intro-title', bpm: 88, beats: 4, pad: 0.17, // D Dorian
    chords: { Dm: 'D2 F3 A3', C: 'C2 E3 G3', G: 'G2 B3 D4', F: 'F2 A3 C4', Am: 'A1 C3 E3' },
    prog: ['Dm', 'C', 'G', 'Dm', 'Dm', 'F', 'C', 'G', 'Am', 'G', 'F', 'C', 'Dm', 'C', 'G', 'Dm'],
    bass: { style: 'halves', gain: 0.4 },
    lines: [
      { patch: 'lead', gain: 0.36, bars: [
        'D4:1 E4:1 A4:1.5 G4:0.5', 'G4:2 E4:1 r:1', 'D4:1 G4:1.5 A4:0.5 B4:1', 'A4:3 r:1',
        'D4:1 E4:1 A4:1.5 G4:0.5', 'C5:2 A4:1 F4:1', 'G4:1 E4:1 C4:1 E4:1', 'D4:3 r:1',
        'E5:1.5 D5:0.5 C5:1 A4:1', 'B4:2 G4:1 r:1', 'A4:1 C5:1 D5:1.5 C5:0.5', 'G4:3 r:1',
        'D5:1.5 C5:0.5 A4:1 F4:1', 'E4:1 G4:1 C5:2', 'B4:1 A4:1 G4:1 E4:1', 'D4:3 r:1'] },
      { patch: 'bell', gain: 0.2, bars: [
        'r:4', 'r:4', 'r:4', 'r:3 A4:1', 'r:4', 'r:4', 'r:4', 'r:3 D5:1',
        'r:4', 'r:4', 'r:4', 'r:3 E5:1', 'r:4', 'r:4', 'r:4', 'r:3 D5:1'] }
    ]
  },
  {
    // the fast-forward: centuries turning over like pages, a figure that gains a layer and resets
    id: 'loading-age', bpm: 120, beats: 4, pad: 0.15, // C Lydian
    chords: { C: 'C2 E3 G3', D: 'D2 F#3 A3', Am: 'A1 C3 E3', Em: 'E2 G3 B3', Bm: 'B1 D3 F#3' },
    prog: ['C', 'D', 'C', 'D', 'Am', 'D', 'Em', 'D', 'C', 'D', 'C', 'D', 'Am', 'Bm', 'Em', 'D'],
    bass: { style: 'pulse8', gain: 0.32, from: 4 },
    lines: [
      { patch: 'bell', gain: 0.16, arp: 0 },
      { patch: 'lead', gain: 0.3, bars: [
        'r:4', 'r:4', 'r:4', 'r:4', 'r:4', 'r:4', 'r:4', 'r:4',
        'E4:2 G4:2', 'F#4:3 A4:1', 'B4:2 C5:2', 'D5:4', 'E5:2 C5:2', 'D5:2 B4:2', 'G4:2 B4:2', 'A4:3 r:1'] }
    ],
    drums: [{ midi: 42, gain: 0.1, len: 0.1, hits: [0, 1, 2, 3] }]
  },
  {
    // a river valley at dawn, a few huts, nobody in a hurry, and nobody knows what is over the hill
    id: 'map-ancient', bpm: 66, beats: 3, pad: 0.15, // A Dorian
    chords: { Am: 'A2 C4 E4', G: 'G2 B3 D4', D: 'D2 A3 F#4', Em: 'E2 G3 B3', C: 'C2 G3 E4' },
    prog: ['Am', 'Am', 'G', 'Am', 'D', 'D', 'Am', 'Am', 'Em', 'G', 'D', 'Am',
      'Am', 'C', 'G', 'Am', 'D', 'D', 'Em', 'Em', 'C', 'G', 'D', 'Am'],
    bass: { style: 'hold', gain: 0.32 },
    lines: [
      { patch: 'bell', gain: 0.22, bars: [
        'A4:1 B4:1 E5:1', 'D5:2 r:1', 'B4:1.5 A4:0.5 G4:1', 'E4:3',
        'r:1 F#4:1 A4:1', 'D5:2 r:1', 'C5:1 B4:1 A4:1', 'r:3',
        'r:1 G4:1 B4:1', 'D5:1.5 B4:0.5 A4:1', 'F#4:2 r:1', 'E4:3',
        'A4:1 B4:1 E5:1', 'D5:2 r:1', 'B4:1.5 D5:0.5 G4:1', 'A4:3',
        'r:1 A4:1 F#4:1', 'E4:1 D4:2', 'r:1 B3:1 E4:1', 'G4:3',
        'r:1 E4:1 G4:1', 'D5:1 B4:1 G4:1', 'F#4:1.5 E4:0.5 D4:1', 'E4:2 r:1'] }
    ]
  },
  {
    // a walled town on market day seen from the hill: the world being mapped and argued about, with craft
    id: 'map-renaissance', bpm: 92, beats: 4, pad: 0.14, // G Mixolydian
    chords: { G: 'G2 B3 D4', F: 'F2 A3 C4', C: 'C2 G3 E4', Am: 'A2 C4 E4', Dm: 'D2 A3 F4', Em: 'E2 G3 B3' },
    prog: ['G', 'G', 'F', 'G', 'C', 'G', 'Am', 'Dm', 'G', 'F', 'C', 'G', 'Em', 'Am', 'F', 'G'],
    bass: { style: 'halves', gain: 0.34 },
    lines: [
      { patch: 'bell', gain: 0.21, bars: [
        'G4:1 A4:1 D5:1.5 C5:0.5', 'B4:2 G4:1 r:1', 'F4:1 A4:1 C5:1 A4:1', 'G4:3 r:1',
        'E4:1 G4:1 C5:1.5 B4:0.5', 'D5:2 B4:1 r:1', 'C5:1 A4:1 E4:1 A4:1', 'F4:3 r:1',
        'G4:1 A4:1 D5:1.5 C5:0.5', 'A4:1 F4:1 C5:2', 'E5:1.5 D5:0.5 C5:1 G4:1', 'B4:3 r:1',
        'B4:1 G4:1 E4:1 G4:1', 'A4:1.5 C5:0.5 E5:2', 'D5:1 C5:1 A4:1 F4:1', 'G4:3 r:1'] },
      { patch: 'lead', gain: 0.15, bars: [
        'D4:2 B3:2', 'C4:2 D4:2', 'C4:2 A3:2', 'B3:4', 'C4:2 E4:2', 'D4:2 B3:2', 'A3:2 C4:2', 'D4:2 A3:2',
        'B3:2 D4:2', 'C4:4', 'G3:2 E4:2', 'D4:4', 'E4:2 B3:2', 'C4:2 A3:2', 'A3:2 C4:2', 'B3:2 D4:2'] }
    ]
  },
  {
    // smoke over the rail yards at dusk: work that never stops, the old valley tune now on a machine
    id: 'map-industrial', bpm: 80, beats: 4, pad: 0.14, // E Aeolian
    chords: { Em: 'E2 G3 B3', C: 'C2 G3 E4', D: 'D2 A3 F#4', Am: 'A1 C4 E4', Bm: 'B1 F#3 D4', G: 'G2 B3 D4' },
    prog: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'Am', 'Bm', 'C', 'C', 'G', 'D', 'Em', 'Am', 'Bm', 'Em'],
    bass: { style: 'quarters', gain: 0.34 },
    lines: [
      { patch: 'bell', gain: 0.2, bars: [
        'E4:1 F#4:1 B4:1 A4:1', 'G4:1 E4:1 B3:2', 'r:2 C4:1 E4:1', 'D4:3 r:1',
        'E4:1 F#4:1 B4:1 A4:1', 'A4:1 G4:1 B4:2', 'r:2 A4:1 C5:1', 'B4:3 r:1',
        'G4:2 E4:1 G4:1', 'C5:3 r:1', 'B4:1 A4:1 G4:1 D4:1', 'F#4:3 r:1',
        'E4:1 F#4:1 B4:1 A4:1', 'A4:1.5 G4:0.5 E4:2', 'F#4:2 D4:1 F#4:1', 'E4:3 r:1'] }
    ],
    drums: [{ midi: 42, gain: 0.08, len: 0.1, hits: [0.5, 1.5, 2.5, 3.5] }]
  },
  {
    // a city grid seen from above at night: the world fully known, lights and distance, little breath
    id: 'map-modern', bpm: 76, beats: 4, pad: 0.15, // F Lydian
    chords: { F: 'F2 A3 C4', G: 'G2 B3 D4', Am: 'A2 C4 E4', C: 'C2 G3 E4', Em: 'E2 G3 B3', Dm: 'D2 A3 F4' },
    prog: ['F', 'G', 'F', 'G', 'Am', 'G', 'F', 'C', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'F'],
    bass: { style: 'hold', gain: 0.32 },
    lines: [
      { patch: 'bell', gain: 0.19, bars: [
        'F4:1 G4:1 C5:1 B4:1', 'r:1 D5:1 B4:1 G4:1', 'E5:2 C5:1 r:1', 'D5:3 r:1',
        'r:1 E5:1 C5:1 A4:1', 'B4:2 D5:1 r:1', 'C5:1 A4:1 G4:1 F4:1', 'E4:3 r:1',
        'F4:1 G4:1 C5:1 B4:1', 'D5:2 B4:1 r:1', 'G4:1 B4:1 E5:2', 'C5:3 r:1',
        'r:1 F4:1 A4:1 D5:1', 'B4:2 G4:2', 'E4:1 G4:1 C5:2', 'A4:3 r:1'] },
      { patch: 'lead', gain: 0.11, bars: [
        'r:4', 'r:4', 'r:4', 'r:4', 'r:4', 'r:4', 'r:4', 'r:4',
        'A4:4', 'B4:4', 'B4:4', 'A4:4', 'F4:4', 'G4:4', 'G4:4', 'A4:4'] }
    ]
  },
  {
    // the same valley at dusk: the dawn tune answered from the other side of the hill
    id: 'map-ancient-b', bpm: 66, beats: 3, pad: 0.15, // A Dorian
    chords: { Am: 'A2 C4 E4', G: 'G2 B3 D4', D: 'D2 A3 F#4', Em: 'E2 G3 B3', C: 'C2 G3 E4' },
    prog: ['Am', 'G', 'Am', 'Em', 'D', 'Am', 'G', 'Am', 'C', 'G', 'D', 'Am', 'Em', 'D', 'G', 'Am'],
    bass: { style: 'hold', gain: 0.32 },
    lines: [
      { patch: 'bell', gain: 0.22, bars: [
        'E5:1 D5:1 B4:1', 'A4:2 r:1', 'r:1 C5:1 E5:1', 'D5:1.5 B4:0.5 G4:1',
        'F#4:3', 'r:1 A4:1 B4:1', 'D5:2 B4:1', 'A4:3',
        'r:1 G4:1 C5:1', 'B4:1.5 A4:0.5 G4:1', 'A4:2 F#4:1', 'E4:3',
        'r:1 B4:1 E5:1', 'D5:1 A4:2', 'B4:1 G4:1 D4:1', 'E4:2 r:1'] }
    ]
  },
  {
    // the town's guild hall at evening: the argument goes on, quieter, in two voices
    id: 'map-renaissance-b', bpm: 92, beats: 4, pad: 0.14, // G Mixolydian
    chords: { G: 'G2 B3 D4', F: 'F2 A3 C4', C: 'C2 G3 E4', Am: 'A2 C4 E4', Dm: 'D2 A3 F4', Em: 'E2 G3 B3' },
    prog: ['C', 'G', 'F', 'G', 'Em', 'Am', 'Dm', 'G', 'C', 'F', 'G', 'Em', 'Am', 'F', 'C', 'G'],
    bass: { style: 'halves', gain: 0.34 },
    lines: [
      { patch: 'bell', gain: 0.21, bars: [
        'E5:1 D5:1 C5:1 G4:1', 'A4:1 B4:1 D5:2', 'C5:1.5 A4:0.5 F4:1 A4:1', 'G4:3 r:1',
        'B4:1 E5:1 D5:1 B4:1', 'C5:2 A4:1 r:1', 'D5:1 F5:1 E5:1 D5:1', 'B4:3 r:1',
        'G4:1 A4:1 D5:1.5 C5:0.5', 'A4:2 C5:2', 'D5:1 B4:1 G4:1 B4:1', 'E5:3 r:1',
        'C5:1 E5:1 A4:2', 'F4:1 A4:1 C5:1 F5:1', 'E5:1.5 D5:0.5 C5:1 E5:1', 'D5:3 r:1'] },
      { patch: 'lead', gain: 0.15, bars: [
        'G3:2 C4:2', 'D4:2 G3:2', 'A3:2 C4:2', 'B3:2 D4:2', 'G3:2 B3:2', 'E4:2 C4:2', 'A3:4', 'D4:2 B3:2',
        'E4:2 C4:2', 'C4:2 A3:2', 'B3:2 D4:2', 'G3:2 B3:2', 'A3:2 E4:2', 'C4:4', 'G3:2 E4:2', 'B3:4'] }
    ]
  },
  {
    // the night shift: the valley's first tune again, in A, carried by the machine
    id: 'map-industrial-b', bpm: 80, beats: 4, pad: 0.14, // E Aeolian
    chords: { Em: 'E2 G3 B3', C: 'C2 G3 E4', D: 'D2 A3 F#4', Am: 'A1 C4 E4', Bm: 'B1 F#3 D4', G: 'G2 B3 D4' },
    prog: ['Am', 'Em', 'C', 'D', 'Am', 'Em', 'Bm', 'Em', 'G', 'D', 'C', 'Em', 'Am', 'Bm', 'C', 'D'],
    bass: { style: 'walk', gain: 0.3 },
    lines: [
      { patch: 'bell', gain: 0.2, bars: [
        'A4:1 B4:1 E5:1 D5:1', 'B4:2 G4:1 E4:1', 'r:1 E4:1 G4:1 C5:1', 'A4:3 r:1',
        'A4:1 B4:1 E5:1 D5:1', 'E5:1.5 D5:0.5 B4:2', 'r:2 D5:1 F#4:1', 'G4:3 r:1',
        'D5:1 B4:1 G4:1 B4:1', 'A4:2 F#4:2', 'G4:1 E4:1 C5:2', 'B4:3 r:1',
        'C5:1 B4:1 A4:1 E4:1', 'F#4:2 D4:2', 'E4:1 G4:1 B4:1 C5:1', 'A4:3 r:1'] }
    ],
    drums: [{ midi: 42, gain: 0.08, len: 0.1, hits: [0.5, 1.5, 2.5, 3.5] }]
  },
  {
    // the same city before dawn: fewer lights, the long tones first, the bell later
    id: 'map-modern-b', bpm: 76, beats: 4, pad: 0.15, // F Lydian
    chords: { F: 'F2 A3 C4', G: 'G2 B3 D4', Am: 'A2 C4 E4', C: 'C2 G3 E4', Em: 'E2 G3 B3', Dm: 'D2 A3 F4' },
    prog: ['Dm', 'G', 'F', 'C', 'Dm', 'Em', 'F', 'G', 'Am', 'G', 'F', 'Em', 'Dm', 'G', 'C', 'F'],
    bass: { style: 'hold', gain: 0.32 },
    lines: [
      { patch: 'bell', gain: 0.19, bars: [
        'r:1 A4:1 D5:1 F5:1', 'B4:2 D5:1 r:1', 'F4:1 G4:1 C5:1 B4:1', 'G4:3 r:1',
        'r:1 F4:1 A4:1 D5:1', 'E5:2 B4:1 r:1', 'C5:1 A4:1 F4:1 A4:1', 'B4:3 r:1',
        'r:1 C5:1 E5:1 A4:1', 'D5:2 B4:2', 'F4:1 G4:1 C5:1 B4:1', 'G4:3 r:1',
        'r:1 D5:1 A4:1 F4:1', 'G4:2 B4:1 r:1', 'E4:1 G4:1 C5:2', 'A4:3 r:1'] },
      { patch: 'lead', gain: 0.11, bars: [
        'A4:4', 'B4:4', 'C5:4', 'G4:4', 'F4:4', 'G4:4', 'A4:4', 'B4:4',
        'r:4', 'r:4', 'r:4', 'r:4', 'r:4', 'r:4', 'r:4', 'r:4'] }
    ]
  },
  {
    // the space programme: high, open, almost weightless — the calmest piece of the set
    id: 'map-space', bpm: 60, beats: 4, pad: 0.13, // C Lydian
    chords: { C: 'C2 G3 E4', D: 'D2 A3 F#4', Em: 'E2 B3 G4', Am: 'A1 C4 E4', Bm: 'B1 D4 F#4' },
    prog: ['C', 'D', 'C', 'D', 'Em', 'D', 'C', 'D', 'C', 'D', 'Am', 'D', 'C', 'Bm', 'Em', 'D'],
    bass: { style: 'hold', gain: 0.26 },
    lines: [
      { patch: 'bell', gain: 0.17, bars: [
        'C5:2 D5:2', 'G5:3 F#5:1', 'r:4', 'r:2 A4:2', 'r:1 B4:1 E5:2', 'D5:4', 'r:4', 'F#5:2 r:2',
        'C5:2 D5:2', 'G5:3 F#5:1', 'r:2 E5:2', 'D5:4', 'r:4', 'r:1 F#5:1 D5:2', 'B4:4', 'A4:2 r:2'] }
    ]
  },
  {
    // a border river at night, two armies watching each other: tense and steady, never loud
    id: 'map-war', bpm: 100, beats: 4, pad: 0.15, // D Phrygian
    chords: { D: 'D2 A3 D4', Eb: 'Eb2 Bb3 Eb4', Bb: 'Bb1 D4 F4', C: 'C2 Eb4 G4' },
    prog: ['D', 'D', 'D', 'Eb', 'D', 'D', 'Bb', 'C', 'D', 'D', 'D', 'Eb', 'Bb', 'C', 'Eb', 'D'],
    bass: { style: 'war8', gain: 0.36 },
    lines: [
      { patch: 'lead', gain: 0.28, bars: [
        'D5:0.5 Eb5:0.5 D5:0.5 A4:0.5 C5:1 Bb4:1', 'A4:0.5 Bb4:0.5 A4:0.5 F4:0.5 G4:1 A4:1',
        'D5:0.5 Eb5:0.5 D5:0.5 A4:0.5 C5:1 D5:1', 'Eb5:1.5 D5:0.5 Bb4:1 G4:1',
        'D5:0.5 Eb5:0.5 D5:0.5 A4:0.5 C5:1 Bb4:1', 'A4:0.5 Bb4:0.5 A4:0.5 F4:0.5 G4:1 A4:1',
        'F5:0.5 G5:0.5 F5:0.5 D5:0.5 Eb5:1 D5:1', 'C5:1 Eb5:1 G5:2',
        'A5:0.5 G5:0.5 F5:0.5 Eb5:0.5 D5:1 A4:1', 'Bb4:0.5 A4:0.5 G4:0.5 A4:0.5 D5:2',
        'A5:0.5 G5:0.5 F5:0.5 Eb5:0.5 D5:1 F5:1', 'G5:1 F5:0.5 Eb5:0.5 D5:1 Eb5:1',
        'D5:1 F5:1 Bb4:1 D5:1', 'Eb5:1 G5:1 C5:1 Eb5:1',
        'Bb4:0.5 C5:0.5 D5:0.5 Eb5:0.5 F5:1 G5:1', 'A5:1 Eb5:1 D5:2'] }
    ],
    drums: [
      { midi: 36, gain: 0.34, hits: [0, 2] },
      { midi: 42, gain: 0.12, len: 0.1, hits: EIGHTHS },
      { midi: 38, gain: 0.2, bars: { 8: [3, 3.5], 16: [2, 3, 3.5] } }
    ]
  },
  {
    // the last banner raised over a quiet world: pride, and relief — heard once
    id: 'end-victory', bpm: 84, beats: 4, pad: 0.17, // Bb Ionian
    chords: { Bb: 'Bb1 D4 F4', Eb: 'Eb2 G3 Bb3', F: 'F2 A3 C4', Gm: 'G2 Bb3 D4', Cm: 'C2 Eb4 G4', Dm: 'D2 F3 A3' },
    prog: ['Bb', 'Eb', 'Bb', 'F', 'Gm', 'Eb', 'F', 'Bb', 'Eb', 'F', 'Dm', 'Gm', 'Cm', 'Eb', 'F', 'Bb'],
    bass: { style: 'halves', gain: 0.42 },
    lines: [
      { patch: 'lead', gain: 0.42, bars: [
        'F4:1 Bb4:1 D5:2', 'Eb5:1.5 D5:0.5 C5:1 Bb4:1', 'D5:1 F5:1 Bb5:2', 'A5:2 F5:1 r:1',
        'G5:1.5 F5:0.5 D5:1 Bb4:1', 'C5:1 Eb5:1 G5:2', 'F5:1 Eb5:1 D5:1 C5:1', 'D5:3 r:1',
        'G4:1 Bb4:1 Eb5:2', 'F5:1.5 Eb5:0.5 D5:1 C5:1', 'A4:1 D5:1 F5:2', 'G5:2 D5:1 r:1',
        'Eb5:1 G5:1 C6:1.5 Bb5:0.5', 'G5:2 Eb5:2', 'F5:1 G5:1 A5:1 C6:1', 'Bb5:3 r:1'] },
      { patch: 'bell', gain: 0.2, bars: [
        'r:4', 'r:4', 'r:4', 'r:3 C6:1', 'r:4', 'r:4', 'r:4', 'r:3 F5:1',
        'r:4', 'r:4', 'r:4', 'r:3 Bb4:1', 'r:4', 'r:4', 'r:4', 'r:3 D6:1'] }
    ],
    drums: [{ midi: 36, gain: 0.28, hits: [0] }]
  },
  {
    // rain on an empty capital; what was built is someone else's now — sad, not ominous
    id: 'end-defeat', bpm: 56, beats: 4, pad: 0.17, // F Aeolian
    chords: { Fm: 'F2 Ab3 C4', Db: 'Db2 Ab3 F4', Eb: 'Eb2 G3 Bb3', Cm: 'C2 Eb4 G4', Bbm: 'Bb1 Db4 F4' },
    prog: ['Fm', 'Fm', 'Db', 'Eb', 'Fm', 'Bbm', 'Cm', 'Cm', 'Db', 'Db', 'Fm', 'Eb', 'Bbm', 'Db', 'Cm', 'Fm'],
    bass: { style: 'hold', gain: 0.34 },
    lines: [
      { patch: 'bell', gain: 0.22, bars: [
        'r:1 C5:1 F5:2', 'Eb5:1 C5:1 r:2', 'r:2 Db5:1 F5:1', 'Eb5:3 r:1',
        'r:1 Ab5:1 G5:1 F5:1', 'F5:2 Db5:1 r:1', 'r:2 Eb5:1 G5:1', 'C5:4',
        'r:1 F5:1 Ab5:2', 'Ab5:1 F5:1 r:2', 'r:1 C6:1 Ab5:1 F5:1', 'G5:2 Eb5:1 r:1',
        'r:1 Db5:1 F5:2', 'Eb5:1 Db5:1 C5:2', 'r:2 G4:1 Bb4:1', 'C5:3 r:1'] }
    ]
  }
];

function render(spec) {
  for (const l of spec.lines) if (l.arp !== undefined) l.bars = arp(chordsOf(spec), l.arp);
  const piece = build(spec);
  // one track per line keeps a diff readable
  return '{ "bpm": ' + piece.bpm + ', "beats": ' + piece.beats + ', "loop": true,\n  "tracks": [\n'
    + piece.tracks.map(t => '    ' + JSON.stringify(t)).join(',\n') + '\n  ] }\n';
}

const check = process.argv.includes('--check');
let stale = 0;
for (const spec of PIECES) {
  const file = path.join(OUT, spec.id + '.json');
  const text = render(spec);
  if (check) {
    const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (now !== text) { console.log(`stale ${spec.id}.json`); stale++; }
  } else {
    fs.writeFileSync(file, text);
    console.log(`wrote ${spec.id}.json`);
  }
}
if (stale > 0) process.exit(1);
