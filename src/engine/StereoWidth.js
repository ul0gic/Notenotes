export function normalizeStereoWidth(width = 0) {
  const value = Number(width) || 0;
  return Math.max(0, Math.min(1, value));
}

export function panForVoice(index = 0, voiceCount = 1, width = 0, layerOffset = 0) {
  const spread = normalizeStereoWidth(width);
  const voices = Math.max(1, Math.round(Number(voiceCount) || 1));
  const idx = Math.max(0, Math.min(voices - 1, Math.round(Number(index) || 0)));
  const base = voices <= 1 ? 0 : ((idx / (voices - 1)) * 2 - 1);
  const offset = Math.max(-1, Math.min(1, Number(layerOffset) || 0));
  const pan = Math.max(-1, Math.min(1, (base + offset * 0.35) * spread));
  return Object.is(pan, -0) ? 0 : pan;
}

export function stereoGainsForPan(pan = 0) {
  const p = Math.max(-1, Math.min(1, Number(pan) || 0));
  const angle = (p + 1) * Math.PI * 0.25;
  return {
    left: Math.cos(angle),
    right: Math.sin(angle),
  };
}
