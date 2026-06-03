/**
 * Pure helper shared by the live synth and the WAV exporter: given a multi-zone
 * sample map ([{ rootMidi, buffer }]), pick the zone whose root is closest to the
 * played note. Kept dependency-free so the offline exporter can use it too.
 */
export function pickZone(sampleMap, midi) {
  if (!sampleMap || !sampleMap.length) return null;
  let best = sampleMap[0];
  let bestDist = Math.abs(midi - best.rootMidi);
  for (let i = 1; i < sampleMap.length; i++) {
    const dist = Math.abs(midi - sampleMap[i].rootMidi);
    if (dist < bestDist) { best = sampleMap[i]; bestDist = dist; }
  }
  return best;
}

/**
 * Fold a played note back toward the sampled range by whole octaves, so notes far
 * outside an instrument's natural octaves still sound (and stay in key) instead of
 * being pitch-shifted into near-silence. Notes within `marginSemitones` of the
 * sampled range keep their true pitch; only far-out notes get octave-folded.
 * `sampleMap` must be sorted ascending by rootMidi.
 */
export function playableMidi(sampleMap, midi, marginSemitones = 12) {
  if (!sampleMap || !sampleMap.length) return midi;
  const lo = sampleMap[0].rootMidi - marginSemitones;
  const hi = sampleMap[sampleMap.length - 1].rootMidi + marginSemitones;
  let m = midi;
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}
