const TICKS_PER_BEAT = 480;
const SAMPLE_RATE = 44100;

function secondsPerTick(bpm = 120) {
  return 60 / Math.max(1, bpm) / TICKS_PER_BEAT;
}

function ticksPerBar(projectOrSnippet = {}) {
  const sig = projectOrSnippet.timeSignature || { beats: 4, subdivision: 4 };
  return TICKS_PER_BEAT * (sig.beats || 4);
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function ensureLength(samples, seconds) {
  const length = Math.max(1, Math.ceil(seconds * SAMPLE_RATE));
  return samples?.length >= length ? samples : new Float32Array(length);
}

function mixSample(buffer, index, value) {
  if (index >= 0 && index < buffer.length) {
    buffer[index] = Math.max(-1, Math.min(1, buffer[index] + value));
  }
}

function renderTone(buffer, startSec, durationSec, midi, velocity = 0.8) {
  const start = Math.max(0, Math.floor(startSec * SAMPLE_RATE));
  const end = Math.min(buffer.length, Math.ceil((startSec + durationSec + 0.18) * SAMPLE_RATE));
  const freq = midiToFreq(midi);
  const amp = 0.22 * velocity;
  const attack = Math.max(1, Math.floor(0.008 * SAMPLE_RATE));
  const release = Math.max(1, Math.floor(0.12 * SAMPLE_RATE));
  const noteSamples = Math.max(1, Math.floor(durationSec * SAMPLE_RATE));

  for (let i = start; i < end; i++) {
    const n = i - start;
    const phase = (n / SAMPLE_RATE) * freq;
    const wave = Math.sin(phase * Math.PI * 2) * 0.65 + Math.sign(Math.sin(phase * Math.PI * 4)) * 0.18;
    const attackGain = Math.min(1, n / attack);
    const releaseStart = noteSamples;
    const releaseGain = n <= releaseStart ? 1 : Math.max(0, 1 - ((n - releaseStart) / release));
    mixSample(buffer, i, wave * amp * attackGain * releaseGain);
  }
}

function renderKick(buffer, startSec, velocity = 0.9) {
  const start = Math.max(0, Math.floor(startSec * SAMPLE_RATE));
  const len = Math.floor(0.42 * SAMPLE_RATE);
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 9);
    const freq = 45 + 95 * Math.exp(-t * 22);
    mixSample(buffer, start + i, Math.sin(2 * Math.PI * freq * t) * env * 0.9 * velocity);
  }
}

function renderNoiseHit(buffer, startSec, kind = 'snare', velocity = 0.75) {
  const start = Math.max(0, Math.floor(startSec * SAMPLE_RATE));
  const lenSec = kind === 'hihat' ? 0.11 : kind === 'cymbal' ? 0.45 : 0.22;
  const len = Math.floor(lenSec * SAMPLE_RATE);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * (kind === 'cymbal' ? 7 : 16));
    const noise = (Math.random() * 2 - 1);
    last = kind === 'snare' || kind === 'clap' ? (last * 0.55 + noise * 0.45) : noise;
    const body = kind === 'snare' ? Math.sin(2 * Math.PI * 190 * t) * 0.25 : 0;
    mixSample(buffer, start + i, (last * 0.55 + body) * env * velocity);
  }
}

function renderHit(buffer, hit, startSec, secPerTick) {
  const time = startSec + (hit.startTick || 0) * secPerTick;
  const velocity = hit.velocity || 0.8;
  if (hit.type === 'kick') renderKick(buffer, time, velocity);
  else renderNoiseHit(buffer, time, hit.type || 'snare', velocity);
}

function renderSnippetEvents(buffer, snippet, startSec, bpm) {
  const secPerTick = secondsPerTick(snippet.bpm || bpm);
  for (const note of snippet.notes || []) {
    renderTone(
      buffer,
      startSec + (note.startTick || 0) * secPerTick,
      Math.max(secPerTick, (note.durationTick || TICKS_PER_BEAT) * secPerTick),
      note.pitch || 60,
      note.velocity || 0.8,
    );
  }
  for (const hit of snippet.hits || []) {
    renderHit(buffer, hit, startSec, secPerTick);
  }
}

async function decodeAudioUrl(audioUrl) {
  if (!audioUrl) return null;
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new Ctx(1, 1, SAMPLE_RATE);
  return ctx.decodeAudioData(arrayBuffer.slice(0));
}

function mixAudioBuffer(target, decoded, startSec) {
  if (!decoded) return;
  const offset = Math.max(0, Math.floor(startSec * SAMPLE_RATE));
  const channels = decoded.numberOfChannels || 1;
  for (let ch = 0; ch < channels; ch++) {
    const data = decoded.getChannelData(ch);
    const gain = 0.7 / channels;
    for (let i = 0; i < data.length; i++) {
      mixSample(target, offset + i, data[i] * gain);
    }
  }
}

function normalize(buffer) {
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) peak = Math.max(peak, Math.abs(buffer[i]));
  if (peak <= 0.98) return buffer;
  const gain = 0.98 / peak;
  for (let i = 0; i < buffer.length; i++) buffer[i] *= gain;
  return buffer;
}

function encodeWav(samples) {
  normalize(samples);
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;
  const writeString = (s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint32(offset, SAMPLE_RATE, true); offset += 4;
  view.setUint32(offset, SAMPLE_RATE * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true); offset += 4;

  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function snippetToWavBlob(snippet, project = {}) {
  const bpm = snippet?.bpm || project?.bpm || 120;
  let durationSec = Math.max(1, (snippet?.durationTicks || ticksPerBar(snippet)) * secondsPerTick(bpm)) + 0.75;
  let decoded = null;
  if (snippet?.type === 'audio') {
    decoded = await decodeAudioUrl(snippet.audioUrl);
    durationSec = Math.max(durationSec, decoded?.duration || 0);
  }
  const samples = ensureLength(null, durationSec);
  if (decoded) mixAudioBuffer(samples, decoded, 0);
  else renderSnippetEvents(samples, snippet || {}, 0, bpm);
  return encodeWav(samples);
}

export async function projectToWavBlob(project) {
  const bpm = project?.bpm || 120;
  const secPerTick = secondsPerTick(bpm);
  const barTicks = ticksPerBar(project);
  let maxTick = barTicks;
  for (const track of project?.tracks || []) {
    for (const clip of track.clips || []) {
      const snippet = clip.snippet;
      if (!snippet) continue;
      maxTick = Math.max(maxTick, (clip.startBar || 0) * barTicks + (snippet.durationTicks || barTicks));
    }
  }

  const samples = ensureLength(null, maxTick * secPerTick + 1);
  const audioMixes = [];
  for (const track of project?.tracks || []) {
    for (const clip of track.clips || []) {
      const snippet = clip.snippet;
      if (!snippet) continue;
      const startSec = (clip.startBar || 0) * barTicks * secPerTick;
      if (snippet.type === 'audio') {
        audioMixes.push(decodeAudioUrl(snippet.audioUrl).then(decoded => mixAudioBuffer(samples, decoded, startSec)));
      } else {
        renderSnippetEvents(samples, snippet, startSec, bpm);
      }
    }
  }
  await Promise.all(audioMixes);
  return encodeWav(samples);
}
