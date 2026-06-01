export const AUDIO_INPUT_CHANNEL_MODES = ['auto', 'mono', 'stereo'];

export function normalizeAudioInputChannelMode(mode, fallback = 'auto') {
  const value = String(mode || '').toLowerCase();
  if (AUDIO_INPUT_CHANNEL_MODES.includes(value)) return value;
  return AUDIO_INPUT_CHANNEL_MODES.includes(fallback) ? fallback : 'auto';
}

export function audioInputConstraints(deviceId = '', channelMode = 'auto') {
  const audio = {};
  const id = String(deviceId || '');
  if (id) audio.deviceId = { exact: id };

  const mode = normalizeAudioInputChannelMode(channelMode);
  if (mode === 'mono') audio.channelCount = { ideal: 1 };
  if (mode === 'stereo') audio.channelCount = { ideal: 2 };

  return { audio: Object.keys(audio).length ? audio : true };
}
