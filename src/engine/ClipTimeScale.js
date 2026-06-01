export const CLIP_TIME_SCALE_PRESETS = [
  { value: 0.5, label: 'Double-time', badge: '2x', description: 'Half as long; audio plays higher and faster.' },
  { value: 1, label: 'Normal', badge: '', description: 'Original timing.' },
  { value: 2, label: 'Half-time', badge: '1/2', description: 'Twice as long; audio plays lower and slower.' },
];

const SUPPORTED_TIME_SCALES = new Set(CLIP_TIME_SCALE_PRESETS.map(preset => preset.value));

export function normalizeClipTimeScale(value) {
  const scale = Number(value);
  return SUPPORTED_TIME_SCALES.has(scale) ? scale : 1;
}

export function clipBaseDurationBars(clip, ticksPerBar = 1920) {
  const durationTicks = Number(clip?.snippet?.durationTicks);
  if (Number.isFinite(durationTicks) && durationTicks > 0) {
    return Math.max(1 / Math.max(1, ticksPerBar), durationTicks / Math.max(1, ticksPerBar));
  }
  const timeScale = normalizeClipTimeScale(clip?.timeScale);
  const durationBars = Number(clip?.durationBars);
  if (Number.isFinite(durationBars) && durationBars > 0) {
    return Math.max(1 / Math.max(1, ticksPerBar), durationBars / timeScale);
  }
  return 1;
}

export function clipVisualDurationBars(clip, ticksPerBar = 1920) {
  return clipBaseDurationBars(clip, ticksPerBar) * normalizeClipTimeScale(clip?.timeScale);
}

export function clipTimeScaleBadgeItem(clip) {
  const scale = normalizeClipTimeScale(clip?.timeScale);
  if (scale === 1) return null;
  const preset = CLIP_TIME_SCALE_PRESETS.find(item => item.value === scale);
  return {
    id: 'timeScale',
    label: preset?.badge || `${scale}x`,
    title: preset?.label || 'Time scale',
  };
}

export function pushClipsRightForTimeScale(track, clip, nextTimeScale, ticksPerBar = 1920) {
  const clips = Array.isArray(track?.clips) ? track.clips : [];
  const timeScale = normalizeClipTimeScale(nextTimeScale);
  const startBar = Number(clip?.startBar) || 0;
  const oldDurationBars = Number(clip?.durationBars) || clipVisualDurationBars(clip, ticksPerBar);
  const nextDurationBars = clipBaseDurationBars(clip, ticksPerBar) * timeScale;
  const deltaBars = Math.max(0, nextDurationBars - oldDurationBars);
  const moved = [];

  clip.timeScale = timeScale;
  clip.durationBars = nextDurationBars;

  if (deltaBars <= 0) {
    return { oldDurationBars, newDurationBars: nextDurationBars, moved };
  }

  const oldEnd = startBar + oldDurationBars;
  const laterClips = clips
    .filter(other => other && other !== clip && (Number(other.startBar) || 0) >= oldEnd)
    .sort((a, b) => (Number(a.startBar) || 0) - (Number(b.startBar) || 0));

  for (const other of laterClips) {
    const from = Number(other.startBar) || 0;
    const to = from + deltaBars;
    other.startBar = to;
    moved.push({ clip: other, from, to });
  }

  return { oldDurationBars, newDurationBars: nextDurationBars, moved };
}
