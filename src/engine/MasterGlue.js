export const MASTER_GLUE_DEFAULTS = Object.freeze({
  enabled: true,
  drive: 0.055,
  inputGain: 1,
  outputGain: 0.9,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizedOptions(options = {}) {
  return {
    enabled: options.enabled ?? MASTER_GLUE_DEFAULTS.enabled,
    drive: clamp(Number(options.drive ?? MASTER_GLUE_DEFAULTS.drive) || 0, 0, 0.24),
    inputGain: clamp(Number(options.inputGain ?? MASTER_GLUE_DEFAULTS.inputGain) || 1, 0.5, 2),
    outputGain: clamp(Number(options.outputGain ?? MASTER_GLUE_DEFAULTS.outputGain) || 1, 0.5, 1.2),
  };
}

export function masterGlueSample(sample, options = {}) {
  const { enabled, drive, inputGain, outputGain } = normalizedOptions(options);
  if (!enabled || drive <= 0) return clamp(Number(sample) || 0, -1, 1);
  const shapedInput = (Number(sample) || 0) * inputGain * (1 + drive * 5.5);
  const normalizer = Math.tanh(inputGain * (1 + drive * 5.5));
  return clamp((Math.tanh(shapedInput) / normalizer) * outputGain, -1, 1);
}

export function createMasterGlueCurve(length = 1024, options = {}) {
  const curve = new Float32Array(Math.max(16, Math.round(length)));
  const last = curve.length - 1;
  for (let i = 0; i < curve.length; i += 1) {
    const x = (i / last) * 2 - 1;
    curve[i] = masterGlueSample(x, options);
  }
  return curve;
}

function isStereoBuffer(buffer) {
  return !!buffer && !!buffer.left && !!buffer.right;
}

export function applyMasterGlue(buffer, options = {}) {
  if (!buffer) return buffer;
  if (isStereoBuffer(buffer)) {
    applyMasterGlue(buffer.left, options);
    applyMasterGlue(buffer.right, options);
    return buffer;
  }
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = masterGlueSample(buffer[i], options);
  }
  return buffer;
}
