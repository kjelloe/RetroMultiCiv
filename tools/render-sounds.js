// Render every synth cue (client/ui/sound.js RECIPES + TUNES) to 16-bit mono
// WAV files for manual upload as Roblox audio assets. The recipe table is
// imported from the REAL sound module, so the rendered files are the approved
// browser cues by construction (same oscillators, gains, envelopes) — zero
// licensing surface (all generated).
//
//   node tools/render-sounds.js [outDir=debugging/sounds-export]
//
// Synthesis mirrors sound.js render(): per note an oscillator of recipe.wave
// at freq, enveloped 0.0001 -> peak over 8ms (exponential attack) then
// -> 0.0001 at dur (exponential decay); peak = recipe.gain * MASTER (0.7,
// the browser default master volume). Tunes render one full loop.
const fs = require('fs');
const path = require('path');

const RATE = 44100;
const MASTER = 0.7; // browser default soundMaster 70%

function osc(wave, freq, t) {
  const ph = (t * freq) % 1;
  if (wave === 'sine') return Math.sin(2 * Math.PI * ph);
  if (wave === 'square') return ph < 0.5 ? 1 : -1;
  if (wave === 'sawtooth') return 2 * ph - 1;
  if (wave === 'triangle') return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
  return 0;
}

// exponential envelope value at time t within [t0, t1], from v0 to v1
function expRamp(v0, v1, t0, t1, t) {
  if (t <= t0) return v0;
  if (t >= t1) return v1;
  return v0 * Math.pow(v1 / v0, (t - t0) / (t1 - t0));
}

function renderRecipe(recipe) {
  let end = 0;
  for (const [, delay, dur] of recipe.notes) end = Math.max(end, delay + dur + 0.05);
  const n = Math.ceil(end * RATE);
  const buf = new Float64Array(n);
  const peak = recipe.gain * MASTER;
  for (const [freq, delay, dur] of recipe.notes) {
    const a0 = delay, a1 = delay + 0.008, d1 = delay + dur;
    const s0 = Math.floor(delay * RATE), s1 = Math.min(n, Math.ceil((d1 + 0.02) * RATE));
    for (let i = s0; i < s1; i++) {
      const t = i / RATE;
      const env = t < a1 ? expRamp(0.0001, Math.max(peak, 0.0002), a0, a1, t)
        : expRamp(Math.max(peak, 0.0002), 0.0001, a1, d1, t);
      buf[i] += osc(recipe.wave, freq, t - delay) * env;
    }
  }
  return buf;
}

function tuneToRecipe(tune) {
  // one full loop: each note at i*tempo for tempo*0.9, like playTune's tick
  return { wave: tune.wave, gain: tune.gain,
    notes: tune.notes.map((f, i) => [f, i * tune.tempo, tune.tempo * 0.9]) };
}

// Loudness floor (user feedback 2026-07-26: triangle/sine cues inaudible as
// standalone files — those waves carry far less RMS than square/saw at equal
// gain; the in-game mix masked it). Boost any file whose RMS over its
// SOUNDING samples (|v| > 0.001) is under TARGET_RMS up to the target,
// peak-clamped; louder files pass through untouched.
const TARGET_RMS = 0.09;
const PEAK_CLAMP = 0.85;
function loudnessFloor(samples) {
  let sum = 0, count = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > 0.001) { sum += samples[i] * samples[i]; count++; }
    if (a > peak) peak = a;
  }
  if (count === 0) return { samples, boost: 1 };
  const rms = Math.sqrt(sum / count);
  if (rms >= TARGET_RMS) return { samples, boost: 1 };
  let boost = TARGET_RMS / rms;
  if (peak * boost > PEAK_CLAMP) boost = PEAK_CLAMP / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= boost;
  return { samples, boost };
}

function writeWav(file, samples) {
  // soft-clip + convert to PCM16
  const n = samples.length;
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    let v = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

(async () => {
  const { RECIPES, TUNES } = await import('../client/ui/sound.js');
  const outDir = process.argv[2] || path.join(__dirname, '..', 'debugging', 'sounds-export');
  fs.mkdirSync(outDir, { recursive: true });
  const rows = [];
  for (const [id, recipe] of Object.entries(RECIPES)) {
    const { samples, boost } = loudnessFloor(renderRecipe(recipe));
    const file = path.join(outDir, `${id}.wav`);
    writeWav(file, samples);
    rows.push({ id, seconds: +(samples.length / RATE).toFixed(2), file: `${id}.wav`, boost });
  }
  for (const [name, tune] of Object.entries(TUNES)) {
    const { samples, boost } = loudnessFloor(renderRecipe(tuneToRecipe(tune)));
    const file = path.join(outDir, `tune-${name}.wav`);
    writeWav(file, samples);
    rows.push({ id: `tune-${name}`, seconds: +(samples.length / RATE).toFixed(2), file: `tune-${name}.wav`, boost });
  }
  for (const r of rows) console.log(`${r.file}  ${r.seconds}s${r.boost > 1 ? `  (boosted ${r.boost.toFixed(1)}x)` : ''}`);
  // The mix worksheet: assets are equal-loudness; the ORIGINAL browser mix is
  // exactly 1/boost — emit it as the recommended Roblox Sound.Volume so the
  // in-game balance reproduces the approved browser design.
  const ws = ['| cue | file | suggested Roblox Volume | assetId (fill at upload) |',
    '|---|---|---|---|'];
  for (const r of rows) {
    const vol = Math.max(0.15, Math.min(1, 1 / r.boost));
    ws.push(`| ${r.id} | ${r.file} | ${vol.toFixed(2)} | |`);
  }
  fs.writeFileSync(path.join(outDir, 'VOLUMES.md'),
    '# Roblox SoundId worksheet — equal-loudness assets + the browser mix as Volume\n\n'
    + 'Files are loudness-normalized for upload; the "suggested Roblox Volume" column\n'
    + 'restores the approved browser mix (it is the normalization inverted). Paste the\n'
    + 'assetIds in at upload time; this table then drops into roblox/acceptance/.\n\n'
    + ws.join('\n') + '\n');
  console.log('VOLUMES.md written (mix worksheet with suggested Sound.Volume per cue)');
  console.log(`\n${rows.length} files -> ${outDir}`);
})();
