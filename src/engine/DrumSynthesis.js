/**
 * Shared procedural drum helpers for live SketchKit and WAV export.
 */

const DEFAULT_PROFILE = {
  smooth: 0.32,
  lowpass: 0.08,
  bright: 0.75,
  body: 0.25,
  transient: 0.15,
};

const DRUM_NOISE_PROFILES = {
  snare: { smooth: 0.58, lowpass: 0.08, bright: 0.45, body: 0.55, transient: 0.24 },
  clap: { smooth: 0.64, lowpass: 0.06, bright: 0.38, body: 0.62, transient: 0.28 },
  hihat: { smooth: 0.12, lowpass: 0.03, bright: 0.96, body: 0.08, transient: 0.18 },
  cymbal: { smooth: 0.22, lowpass: 0.035, bright: 0.9, body: 0.12, transient: 0.08 },
  rim: { smooth: 0.52, lowpass: 0.07, bright: 0.52, body: 0.42, transient: 0.34 },
  shaker: { smooth: 0.2, lowpass: 0.04, bright: 0.88, body: 0.14, transient: 0.2 },
};

export function drumNoiseProfile(kind = 'snare') {
  return DRUM_NOISE_PROFILES[kind] || DEFAULT_PROFILE;
}

export function createDrumNoiseState() {
  return { smooth: 0, low: 0 };
}

export function drumTransientEnvelope(kind = 'snare', t = 0, duration = 0.15) {
  const safeDuration = Math.max(0.01, duration);
  if (kind === 'cymbal') return Math.exp(-t * (5.5 / safeDuration));
  if (kind === 'hihat' || kind === 'shaker') return Math.exp(-t * (7 / safeDuration));
  if (kind === 'clap') return Math.exp(-t * (4.8 / safeDuration));
  return Math.exp(-t * (5.8 / safeDuration));
}

export function shapedDrumNoiseSample(kind, raw, state = createDrumNoiseState(), t = 0) {
  const profile = drumNoiseProfile(kind);
  const white = Math.max(-1, Math.min(1, Number(raw) || 0));
  state.smooth = state.smooth * profile.smooth + white * (1 - profile.smooth);
  state.low = state.low * (1 - profile.lowpass) + white * profile.lowpass;
  const bright = white - state.low;
  const transient = 1 + profile.transient * Math.exp(-Math.max(0, t) * 140);
  const shaped = (state.smooth * profile.body + bright * profile.bright) * transient;
  return Math.max(-1, Math.min(1, shaped));
}
