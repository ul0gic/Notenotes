/**
 * Export parity / sanity test for the Section A voice types (FM, Karplus–Strong
 * pluck, additive). Drives the REAL offline exporter (debugRenderBuiltInPatchWav
 * → renderPatchTone → renderFmTone / renderPluckTone / additive path) and checks
 * each preset renders a valid, non-silent, finite WAV. Also unit-tests the shared
 * DSP modules that guarantee live↔export parity.
 *
 * Run: node --import ./tests/_loaders/registerCss.mjs tests/exportVoices.mjs
 * (the loader stubs *.css imports so the exporter's module graph loads in Node).
 */
import assert from 'node:assert/strict';

import { normalizedHarmonics, additiveSample, periodicWaveCoefficients } from '../src/engine/AdditiveWave.js';
import { renderKarplusStrong, mulberry32 } from '../src/engine/KarplusStrong.js';

const wav = await import('../src/export/WavExporter.js');

function pass(name) { console.log(`PASS ${name}`); }

async function wavStats(blob) {
  const buf = Buffer.from(await blob.arrayBuffer());
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF', 'missing RIFF header');
  assert.equal(buf.toString('ascii', 8, 12), 'WAVE', 'missing WAVE tag');
  const channels = buf.readUInt16LE(22);
  let maxAbs = 0;
  let sumSq = 0;
  let n = 0;
  for (let o = 44; o + 1 < buf.length; o += 2) {
    const s = buf.readInt16LE(o) / 32768;
    maxAbs = Math.max(maxAbs, Math.abs(s));
    sumSq += s * s;
    n += 1;
  }
  return { bytes: buf.length, channels, maxAbs, rms: Math.sqrt(sumSq / Math.max(1, n)), samples: n, buf };
}

// ---- Shared DSP modules (parity-critical) -------------------------------------

{
  const norm = normalizedHarmonics([2, 1, 1]); // sum |a| = 4
  const sumAbs = norm.reduce((s, a) => s + Math.abs(a), 0);
  assert.ok(Math.abs(sumAbs - 1) < 1e-9, 'normalizedHarmonics should sum |a| to 1');
  let peak = 0;
  for (let i = 0; i < 256; i++) peak = Math.max(peak, Math.abs(additiveSample(norm, i / 256)));
  assert.ok(peak > 0.1 && peak <= 1.0001, `additive peak out of range: ${peak}`);
  const { real, imag } = periodicWaveCoefficients([1, 0.5]);
  assert.equal(real.length, 3); // DC + 2 harmonics
  assert.equal(imag.length, 3);
  assert.equal(imag[0], 0, 'DC term must be 0');
  pass('AdditiveWave: normalization bounds the waveform and builds wave coefficients');
}

{
  const a = renderKarplusStrong({ freq: 220, sampleRate: 44100, durationSec: 1.5, decaySec: 1.2, damping: 0.5, random: mulberry32(7) });
  const energy = (arr, lo, hi) => { let s = 0; for (let i = lo; i < hi; i++) s += arr[i] * arr[i]; return s; };
  const q = Math.floor(a.length / 4);
  const front = energy(a, 0, q);
  const back = energy(a, a.length - q, a.length);
  assert.ok(front > back * 4, 'Karplus–Strong should decay (front-loaded energy)');
  let peak = 0; for (const s of a) peak = Math.max(peak, Math.abs(s));
  assert.ok(peak > 0.05 && peak <= 1.5, `KS peak out of range: ${peak}`);
  const b = renderKarplusStrong({ freq: 220, sampleRate: 44100, durationSec: 1.5, decaySec: 1.2, damping: 0.5, random: mulberry32(7) });
  assert.deepEqual(Array.from(a.slice(0, 256)), Array.from(b.slice(0, 256)), 'same seed must be deterministic');
  const c = renderKarplusStrong({ freq: 220, sampleRate: 44100, durationSec: 1.5, decaySec: 1.2, damping: 0.5, random: mulberry32(8) });
  assert.notDeepEqual(Array.from(a.slice(0, 256)), Array.from(c.slice(0, 256)), 'different seed must differ');
  pass('KarplusStrong: decays, bounded, and deterministic per seed');
}

// ---- Real exporter render of every new preset ---------------------------------

const NEW_PRESETS = [
  'fm_epiano', 'fm_bell', 'fm_glass_bass', 'fm_mallet',
  'pluck_nylon', 'pluck_harp', 'pluck_koto', 'pluck_kalimba',
  'add_organ', 'add_rhodes', 'add_clarinet', 'add_reed', 'add_glass',
];

for (const id of NEW_PRESETS) {
  const blob = wav.debugRenderBuiltInPatchWav(id, { midi: 60, durationSec: 1.0, velocity: 0.85 });
  const st = await wavStats(blob);
  assert.ok(st.samples > 0, `${id}: empty render`);
  assert.ok(st.maxAbs > 0.02, `${id}: render is silent (peak ${st.maxAbs.toFixed(4)})`);
  assert.ok(st.maxAbs <= 1.0001, `${id}: render overflowed (peak ${st.maxAbs.toFixed(4)})`);
  assert.ok(st.rms > 0.001, `${id}: render RMS too low (${st.rms.toFixed(5)})`);
}
pass(`exporter renders all ${NEW_PRESETS.length} new presets as valid non-silent WAV`);

// Buffer-rendered Karplus–Strong must work at HIGH pitch — the very case a live
// feedback DelayNode loop would mute (sub-render-quantum delay).
for (const midi of [84, 96, 100]) {
  const st = await wavStats(wav.debugRenderBuiltInPatchWav('pluck_nylon', { midi, durationSec: 0.8 }));
  assert.ok(st.maxAbs > 0.02, `pluck at midi ${midi} is silent (peak ${st.maxAbs.toFixed(4)})`);
}
pass('pluck stays audible at high pitch (no DelayNode quantization dropout)');

// Deterministic export: same patch + note → byte-identical WAV.
{
  const a = Buffer.from(await wav.debugRenderBuiltInPatchWav('pluck_harp', { midi: 67 }).arrayBuffer());
  const b = Buffer.from(await wav.debugRenderBuiltInPatchWav('pluck_harp', { midi: 67 }).arrayBuffer());
  assert.ok(a.equals(b), 'pluck export must be deterministic (seeded excitation)');
  const fa = Buffer.from(await wav.debugRenderBuiltInPatchWav('fm_bell', { midi: 72 }).arrayBuffer());
  const fb = Buffer.from(await wav.debugRenderBuiltInPatchWav('fm_bell', { midi: 72 }).arrayBuffer());
  assert.ok(fa.equals(fb), 'FM export must be deterministic');
  pass('export is deterministic (WAV parity holds run-to-run)');
}

console.log('\nALL EXPORT VOICE CHECKS PASSED');
