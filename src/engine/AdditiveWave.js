/**
 * AdditiveWave — shared, dependency-free helpers for additive ("custom" wave)
 * synth voices. Used by BOTH the live engine (WebAudioSynth builds a
 * `PeriodicWave` from these coefficients) and the offline exporter (WavExporter
 * evaluates the same harmonic sum sample-by-sample). Keeping the math in one
 * place is what guarantees the WAV export matches what you hear live.
 *
 * A recipe is an array of harmonic amplitudes, fundamental first:
 *   organ drawbars  → [1, .6, .8, .4, 0, .3, 0, .2]
 *   Rhodes/e-piano  → [1, 0, 0, .45, 0, .2]
 *   clarinet (odd)  → [1, 0, .5, 0, .33, 0, .25]
 */
const TWO_PI = Math.PI * 2;

/**
 * Normalize a harmonic recipe so the synthesized peak is bounded (|wave| <= 1):
 * dividing by the sum of absolute amplitudes is a safe, deterministic bound that
 * BOTH the PeriodicWave path and the offline evaluator can apply identically.
 * @param {number[]} partials
 * @returns {number[]}
 */
export function normalizedHarmonics(partials) {
  const list = (Array.isArray(partials) && partials.length)
    ? partials.map((a) => Number(a) || 0)
    : [1];
  let sum = 0;
  for (const a of list) sum += Math.abs(a);
  if (!(sum > 0)) return [1];
  return list.map((a) => a / sum);
}

/**
 * Build the (real, imag) coefficient arrays for `BaseAudioContext.createPeriodicWave`.
 * Harmonics are placed on the imaginary (sine) terms; index 0 (DC) stays 0.
 * Call createPeriodicWave with `{ disableNormalization: true }` so the browser
 * uses these coefficients verbatim — matching the offline `additiveSample`.
 * @param {number[]} partials
 * @returns {{ real: Float32Array, imag: Float32Array }}
 */
export function periodicWaveCoefficients(partials) {
  const norm = normalizedHarmonics(partials);
  const real = new Float32Array(norm.length + 1);
  const imag = new Float32Array(norm.length + 1);
  for (let i = 0; i < norm.length; i++) imag[i + 1] = norm[i];
  return { real, imag };
}

/**
 * Evaluate the additive waveform at a phase (in cycles). `normHarmonics` MUST be
 * the output of `normalizedHarmonics` so it matches the PeriodicWave exactly.
 * @param {number[]} normHarmonics
 * @param {number} phaseCycles
 * @returns {number}
 */
export function additiveSample(normHarmonics, phaseCycles) {
  let value = 0;
  for (let k = 0; k < normHarmonics.length; k++) {
    const amp = normHarmonics[k];
    if (amp) value += amp * Math.sin(TWO_PI * (k + 1) * phaseCycles);
  }
  return value;
}
