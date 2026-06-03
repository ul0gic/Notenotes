/**
 * KarplusStrong — shared, dependency-free plucked-string renderer used by BOTH
 * the live engine and the WAV exporter, so a plucked instrument sounds identical
 * live and on export.
 *
 * Why render to a buffer instead of a live feedback DelayNode loop (as sketched
 * in the WIP notes)? Web Audio mutes any feedback cycle whose total delay is
 * under one render quantum (~2.9 ms at 44.1 kHz), which silences/detunes every
 * note above ~F4 — the "DelayNode quantises at high pitch" gotcha. Synthesizing
 * the Karplus–Strong recurrence straight into a Float32Array works at every
 * pitch, is cheap (a few-ms buffer fill on note-on), and is byte-identical to the
 * offline exporter because it IS the same code.
 *
 * The classic algorithm: fill a delay line of length N≈sampleRate/freq with
 * noise, then repeatedly output the line while replacing each sample with a
 * lightly low-passed, slightly attenuated average of itself and its neighbour.
 */

/** Small deterministic PRNG so the exporter can render a repeatable excitation. */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Render a plucked-string note into a Float32Array.
 * @param {object} opts
 * @param {number} opts.freq           fundamental frequency (Hz)
 * @param {number} opts.sampleRate
 * @param {number} opts.durationSec    total samples to render (incl. decay tail)
 * @param {number} [opts.decaySec=1.8] time to ~-60 dB
 * @param {number} [opts.damping=0.5]  0 = bright/long, 1 = dark/short
 * @param {number} [opts.velocity=1]
 * @param {() => number} [opts.random=Math.random] excitation source (seed for determinism)
 * @returns {Float32Array}
 */
export function renderKarplusStrong({
  freq,
  sampleRate,
  durationSec,
  decaySec = 1.8,
  damping = 0.5,
  velocity = 1,
  random = Math.random,
}) {
  const sr = sampleRate || 44100;
  const f = clamp(freq || 440, 20, sr / 2);
  const N = Math.max(2, Math.round(sr / f));
  const total = Math.max(1, Math.floor((durationSec || decaySec) * sr));
  const out = new Float32Array(total);

  // Excitation: white noise in the delay line, DC-removed so the string doesn't
  // start with an offset thump.
  const ring = new Float32Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) { ring[i] = random() * 2 - 1; mean += ring[i]; }
  mean /= N;
  for (let i = 0; i < N; i++) ring[i] -= mean;

  const period = N / sr;
  // Attenuation applied once per period so amplitude reaches ~-60 dB after decaySec.
  const loss = Math.exp(Math.log(0.001) * period / Math.max(0.05, decaySec));
  // Damping tilts the loop low-pass: more damping → heavier averaging (darker/shorter).
  const curWeight = clamp(1 - clamp(damping, 0, 1) * 0.5, 0.5, 1);
  const vel = clamp(velocity, 0, 1.5);

  let idx = 0;
  let prev = ring[N - 1];
  for (let n = 0; n < total; n++) {
    const cur = ring[idx];
    out[n] = cur * vel;
    ring[idx] = loss * (curWeight * cur + (1 - curWeight) * prev);
    prev = cur;
    idx = idx + 1 === N ? 0 : idx + 1;
  }
  return out;
}
