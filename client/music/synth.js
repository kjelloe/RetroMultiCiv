// client/music/synth.js (copied unchanged from overworld, MIT, LICENSE-overworld) — the music's voices: WebAudio, browser only, no DOM. Two-operator FM: a modulating sine
// feeds the carrier's frequency through a gain node (depth = index * pitch, falling over `decay` seconds).
// The recipes below are plain data on purpose: fastengine's native Synth reads the same numbers and renders
// the same pieces offline.
//   patch: { carrier, mod?: { ratio, index, decay }, attack, decay, sustain, release, filter?: { type, freq } }
//   times in seconds; the envelope is attack, decay to `sustain` (a fraction of the gain), held to the
//   note's length, then released. A drum patch is { drum: true }: the midi number picks a recipe from DRUMS.
export const PATCHES = {
  lead: { carrier: 'square', mod: { ratio: 2, index: 1.2, decay: 0.3 }, attack: 0.012, decay: 0.15, sustain: 0.55, release: 0.14, filter: { type: 'lowpass', freq: 3200 } },
  pad: { carrier: 'triangle', mod: { ratio: 1, index: 0.5, decay: 1.8 }, attack: 0.4, decay: 0.5, sustain: 0.8, release: 0.9, filter: { type: 'lowpass', freq: 2400 } },
  bass: { carrier: 'sawtooth', mod: { ratio: 1, index: 0.8, decay: 0.12 }, attack: 0.008, decay: 0.2, sustain: 0.6, release: 0.1, filter: { type: 'lowpass', freq: 900 } },
  bell: { carrier: 'sine', mod: { ratio: 3.5, index: 2.6, decay: 0.7 }, attack: 0.002, decay: 1.4, sustain: 0.04, release: 0.6 },
  drum: { drum: true }
};

export const DRUMS = {
  36: { kind: 'kick', from: 160, to: 42, sweep: 0.12, decay: 0.3, level: 1 },
  38: { kind: 'snare', tone: 185, noise: { type: 'bandpass', freq: 1800 }, decay: 0.17, level: 0.7 },
  42: { kind: 'hat', noise: { type: 'highpass', freq: 7500 }, decay: 0.045, level: 0.35 }
};

const hertz = midi => 440 * 2 ** ((midi - 69) / 12);
const FLOOR = 0.0001;

function noiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < data.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; data[i] = s / 0x3fffffff - 1; }
  return buf;
}

export function createSynth(ctx, dest) {
  const noise = noiseBuffer(ctx);

  function envelope(out, at, peak, p, seconds) {
    const g = ctx.createGain();
    const hold = at + Math.max(seconds, p.attack + p.decay);
    const level = Math.max(peak * p.sustain, FLOOR);
    g.gain.setValueAtTime(FLOOR, at);
    g.gain.linearRampToValueAtTime(peak, at + p.attack);
    g.gain.exponentialRampToValueAtTime(level, at + p.attack + p.decay);
    g.gain.setValueAtTime(level, hold);
    g.gain.exponentialRampToValueAtTime(FLOOR, hold + p.release);
    g.connect(out);
    return { node: g, end: hold + p.release };
  }

  function voice(p, midi, at, seconds, gain, out) {
    const f = hertz(midi);
    const env = envelope(out, at, gain, p, seconds);
    let tail = env.node;
    if (p.filter) {
      const flt = ctx.createBiquadFilter();
      flt.type = p.filter.type;
      flt.frequency.value = p.filter.freq;
      flt.connect(env.node);
      tail = flt;
    }
    const car = ctx.createOscillator();
    car.type = p.carrier;
    car.frequency.value = f;
    car.connect(tail);
    const oscs = [car];
    if (p.mod) {
      const mod = ctx.createOscillator();
      const depth = ctx.createGain();
      mod.frequency.value = f * p.mod.ratio;
      depth.gain.setValueAtTime(p.mod.index * f, at);
      depth.gain.exponentialRampToValueAtTime(Math.max(p.mod.index * f * 0.1, FLOOR), at + p.mod.decay);
      mod.connect(depth);
      depth.connect(car.frequency);
      oscs.push(mod);
    }
    for (const o of oscs) { o.start(at); o.stop(env.end + 0.05); }
  }

  function drum(midi, at, gain, out) {
    const r = DRUMS[midi] ?? DRUMS[42];
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * r.level, at);
    g.gain.exponentialRampToValueAtTime(FLOOR, at + r.decay);
    g.connect(out);
    const end = at + r.decay + 0.05;
    if (r.kind === 'kick') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(r.from, at);
      o.frequency.exponentialRampToValueAtTime(r.to, at + r.sweep);
      o.connect(g);
      o.start(at); o.stop(end);
      return;
    }
    const src = ctx.createBufferSource();
    const flt = ctx.createBiquadFilter();
    flt.type = r.noise.type;
    flt.frequency.value = r.noise.freq;
    src.buffer = noise;
    src.connect(flt);
    flt.connect(g);
    src.start(at); src.stop(end);
    if (r.tone) {
      const o = ctx.createOscillator();
      o.frequency.value = r.tone;
      o.connect(g);
      o.start(at); o.stop(end);
    }
  }

  return {
    note(patch, midi, atTime, seconds, gain, out = dest) {
      const p = PATCHES[patch];
      if (p.drum) drum(midi, atTime, gain, out);
      else voice(p, midi, atTime, seconds, gain, out);
    }
  };
}
