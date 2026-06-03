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
