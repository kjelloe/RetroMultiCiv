// client/music/music.js — the player: one looping piece per theme, cross-faded, scheduled a short window ahead.
// Copied from overworld (MIT, LICENSE-overworld). Changes: the scores come in as an argument (fetched
// pieces/*.json, so the native client reads the same folder), the output node is an argument (the game's
// sound master), and the cross-fade is 4 s (specs/game-soundtrack-design.md §6).
// No DOM; `ctx` is any AudioContext-shaped object and `synth` is synth.js's (or a test's stub).
import { loadScore, eventsBetween, lookAhead } from './score.js';

export const FADE_SECONDS = 4;
const START_DELAY = 0.05;

export function createMusic(synth, ctx, SCORES, out = ctx.destination) {
  const master = ctx.createGain();
  master.connect(out);
  const pieces = new Map();
  let layers = [], current = null;

  const pieceOf = theme => {
    if (!pieces.has(theme)) pieces.set(theme, loadScore(SCORES[theme]));
    return pieces.get(theme);
  };

  function fadeOut(layer, now) {
    layer.node.gain.cancelScheduledValues(now);
    layer.node.gain.setValueAtTime(layer.node.gain.value, now);
    layer.node.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
    layer.endsAt = now + FADE_SECONDS;
  }

  function fadeAll(now) {
    for (const l of layers) if (l.endsAt === Infinity) fadeOut(l, now);
  }

  function play(theme) {
    if (theme === current || !SCORES[theme]) return;
    const now = ctx.currentTime;
    fadeAll(now);
    const node = ctx.createGain();
    node.gain.setValueAtTime(0, now);
    node.gain.linearRampToValueAtTime(1, now + FADE_SECONDS);
    node.connect(master);
    layers.push({ piece: pieceOf(theme), node, start: now + START_DELAY, nextBeat: 0, endsAt: Infinity });
    current = theme;
  }

  function stop() {
    fadeAll(ctx.currentTime);
    current = null;
  }

  function update(now = ctx.currentTime, hidden = false) {
    const horizon = now + lookAhead(hidden);
    for (const l of layers) {
      const spb = l.piece.secondsPerBeat;
      const from = Math.max(l.nextBeat, (now - l.start) / spb);
      const to = (horizon - l.start) / spb;
      if (to <= from) continue;
      for (const e of eventsBetween(l.piece, from, to)) synth.note(e.patch, e.midi, l.start + e.beat * spb, e.beats * spb, e.gain, l.node);
      l.nextBeat = to;
    }
    for (const l of layers) if (now > l.endsAt) l.node.disconnect();
    layers = layers.filter(l => now <= l.endsAt);
  }

  return {
    play, stop, update,
    get theme() { return current; },
    get volume() { return master.gain.value; },
    set volume(v) { master.gain.value = v; }
  };
}
