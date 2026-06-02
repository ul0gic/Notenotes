/**
 * Output volume helpers for project-level master and metronome settings.
 */

export const DEFAULT_MASTER_VOLUME = 0.8;
export const DEFAULT_METRONOME_VOLUME = 0.5;

export function normalizeVolume(value, fallback = DEFAULT_MASTER_VOLUME) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

export function projectMasterVolume(project) {
  return normalizeVolume(project?.settings?.masterVolume, DEFAULT_MASTER_VOLUME);
}

export function projectMetronomeVolume(project) {
  return normalizeVolume(project?.settings?.metronomeVolume, DEFAULT_METRONOME_VOLUME);
}
