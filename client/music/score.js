// client/music/score.js — the music's pure half: validate a score, list the notes in a beat window.
// Copied from overworld (MIT, LICENSE-overworld) with two changes: a gain of 0 is refused (fastengine's
// loader refuses it too) and overworld's themeFor is not carried (the theme rule is shared/music-theme.js).
// No WebAudio, no DOM: node:test loads it, and fastengine's port mirrors it.
//
// A score is client/music/pieces/<theme>.json, one piece per theme:
//   { "bpm": 96, "beats": 4, "loop": true,
//     "tracks": [ { "patch": "lead" | "pad" | "bass" | "bell" | "drum", "gain": 0.5, "notes": [[beat, midi, beats], ...] } ] }
// `beat` is the start in beats from the piece's start (fractions allowed), `midi` the pitch (a drum: 36 kick,
// 38 snare, 42 hat), `beats` the length. A track is one voice: its notes never overlap. The piece is as long as
// its last note's bar (`beats` per bar), and a loop wraps there.
export const PATCH_NAMES = ['lead', 'pad', 'bass', 'bell', 'drum'];
export const MIDI_MIN = 24, MIDI_MAX = 96;
const EPS = 1e-9;

const fail = (where, why) => { throw new Error(`score ${where}: ${why}`); };
const isNum = v => typeof v === 'number' && Number.isFinite(v);

function checkTrack(t, i) {
  const where = `track ${i}`;
  if (!PATCH_NAMES.includes(t.patch)) fail(where, `unknown patch ${t.patch}`);
  if (!isNum(t.gain) || t.gain <= 0 || t.gain > 1) fail(where, 'gain outside (0, 1]');
  if (!Array.isArray(t.notes) || t.notes.length === 0) fail(where, 'no notes');
  const notes = t.notes.map(n => {
    if (!Array.isArray(n) || n.length !== 3 || !n.every(isNum)) fail(where, `bad note ${JSON.stringify(n)}`);
    const [beat, midi, len] = n;
    if (beat < 0 || len <= 0) fail(where, `bad time in ${JSON.stringify(n)}`);
    if (!Number.isInteger(midi) || midi < MIDI_MIN || midi > MIDI_MAX) fail(where, `pitch outside ${MIDI_MIN}..${MIDI_MAX} in ${JSON.stringify(n)}`);
    return { beat, midi, len };
  }).sort((a, b) => a.beat - b.beat);
  for (let k = 1; k < notes.length; k++) if (notes[k - 1].beat + notes[k - 1].len > notes[k].beat + EPS) fail(where, `overlap at beat ${notes[k].beat}`);
  return { patch: t.patch, gain: t.gain, notes };
}

export function loadScore(json) {
  if (!isNum(json.bpm) || json.bpm <= 0) fail('piece', 'bad bpm');
  if (!Number.isInteger(json.beats) || json.beats < 1) fail('piece', 'bad beats');
  if (typeof json.loop !== 'boolean') fail('piece', 'loop must be true or false');
  if (!Array.isArray(json.tracks) || json.tracks.length === 0) fail('piece', 'no tracks');
  const tracks = json.tracks.map(checkTrack);
  const end = Math.max(...tracks.map(t => t.notes.at(-1).beat + t.notes.at(-1).len));
  const lengthBeats = Math.ceil(end / json.beats - EPS) * json.beats;
  return { bpm: json.bpm, beats: json.beats, loop: json.loop, tracks, lengthBeats, secondsPerBeat: 60 / json.bpm };
}

// The note-ons with a start in [fromBeat, toBeat). A looping piece repeats: a note of the second pass is
// reported at its start plus the length, so the times keep rising across the wrap.
export function eventsBetween(piece, fromBeat, toBeat) {
  const out = [];
  const L = piece.lengthBeats;
  const first = piece.loop ? Math.floor(fromBeat / L) : 0;
  const last = piece.loop ? Math.floor((toBeat - EPS) / L) : 0;
  for (let pass = first; pass <= last; pass++) {
    piece.tracks.forEach((t, track) => {
      for (const n of t.notes) {
        const beat = n.beat + pass * L;
        if (beat >= fromBeat && beat < toBeat) out.push({ beat, track, patch: t.patch, midi: n.midi, beats: n.len, gain: t.gain });
      }
    });
  }
  return out.sort((a, b) => a.beat - b.beat || a.track - b.track);
}

// A hidden tab throttles requestAnimationFrame to about 1 Hz, so the timer that drives the player needs a longer window.
export const lookAhead = hidden => (hidden ? 1 : 0.2);
