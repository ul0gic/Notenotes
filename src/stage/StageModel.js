export const STAGE_TRACK_LIMIT = 20;

export function stageIntensityForUnits(units = 0) {
  const value = Math.max(0, Number(units) || 0);
  if (value >= 4) {
    return { units: value, tier: 'sustain', opacity: 1, weight: 1, glow: 1 };
  }
  if (value >= 2) {
    return { units: value, tier: 'bright', opacity: 0.9, weight: 0.78, glow: 0.7 };
  }
  if (value >= 1) {
    return { units: value, tier: 'solid', opacity: 0.72, weight: 0.55, glow: 0.38 };
  }
  return { units: value, tier: 'spark', opacity: 0.35, weight: 0.28, glow: 0.12 };
}

export function stageTracksForCanvas(tracks = [], { maxTracks = STAGE_TRACK_LIMIT } = {}) {
  const limit = Math.max(1, Math.floor(Number(maxTracks) || STAGE_TRACK_LIMIT));
  const hasSolo = tracks.some(track => track?.solo && !track?.muted);
  return tracks
    .filter(track => track && !track.muted)
    .filter(track => !hasSolo || track.solo)
    .slice(0, limit)
    .map((track, index) => ({
      id: track.id || `track-${index}`,
      index,
      name: track.name || `Track ${index + 1}`,
      color: track.color || '#7bd88f',
      type: track.type || 'midi',
      sourceTrack: track,
    }));
}

export function stageUnitTicksForMeter(transportOrMeter = {}, fallbackTicks = 480) {
  const ticksPerPulse = Number(transportOrMeter?.ticksPerPulse);
  if (Number.isFinite(ticksPerPulse) && ticksPerPulse > 0) return ticksPerPulse;
  const ticksPerBeat = Number(transportOrMeter?.ticksPerBeat);
  if (Number.isFinite(ticksPerBeat) && ticksPerBeat > 0) return ticksPerBeat;
  return fallbackTicks;
}
