/**
 * Audio voice stress harness — runs the REAL WebAudioSynth against a mock
 * Web Audio graph to prove that rapid note retriggering (the gesture that
 * crashes Windows Chrome with STATUS_BREAKPOINT on sampled instruments) keeps
 * the live node count bounded and never throws from AudioParam scheduling.
 *
 * The mock models the lifecycle bits that matter: start()/stop() ordering,
 * the 'ended' event (fired when a virtual clock passes a source's stop time),
 * and the spec violations Chrome throws on (curve duration <= 0, non-finite
 * values, exponential ramp to 0, stop-before-start, double start). It records
 * AudioParam automation so we can flag overlap hazards.
 *
 * Run: node tests/audioVoiceStress.mjs
 */
import assert from 'node:assert/strict';

let NODE_SEQ = 0;

class MockParam {
  constructor(ctx, owner, name) {
    this.ctx = ctx;
    this.owner = owner;
    this.name = name;
    this.value = 0;
    this._auto = []; // { kind:'point'|'curve', start, end }
  }
  _finite(label, v) {
    if (!Number.isFinite(v)) throw new TypeError(`${this.name}.${label}: non-finite value ${v}`);
  }
  _overlapWarn(label, start, end) {
    for (const a of this._auto) {
      // open-interval overlap (boundaries are legal in the spec)
      if (start < a.end && a.start < end) {
        this.ctx._overlaps.push(`${this.owner}.${this.name}: ${label}[${start.toFixed(4)},${end.toFixed(4)}] vs ${a.kind}[${a.start.toFixed(4)},${a.end.toFixed(4)}]`);
      }
    }
  }
  setValueAtTime(v, t) {
    this._finite('setValueAtTime', v); this._finite('setValueAtTime', t);
    this._overlapWarn('setValueAtTime', t, t);
    this._auto.push({ kind: 'point', start: t, end: t });
    this.value = v; return this;
  }
  setValueCurveAtTime(curve, t, dur) {
    if (!(dur > 0)) throw new RangeError(`${this.name}.setValueCurveAtTime: duration must be > 0 (got ${dur})`);
    if (!curve || curve.length < 2) throw new Error(`${this.name}.setValueCurveAtTime: curve needs >= 2 points`);
    for (const x of curve) this._finite('setValueCurveAtTime', x);
    this._finite('setValueCurveAtTime', t);
    this._overlapWarn('setValueCurveAtTime', t, t + dur);
    this._auto.push({ kind: 'curve', start: t, end: t + dur });
    this.value = curve[curve.length - 1]; return this;
  }
  setTargetAtTime(target, t, timeConstant) {
    this._finite('setTargetAtTime', target); this._finite('setTargetAtTime', t);
    if (!(timeConstant >= 0)) throw new RangeError(`${this.name}.setTargetAtTime: timeConstant must be >= 0 (got ${timeConstant})`);
    this._overlapWarn('setTargetAtTime', t, t);
    this._auto.push({ kind: 'point', start: t, end: t });
    this.value = target; return this;
  }
  exponentialRampToValueAtTime(v, t) {
    this._finite('exponentialRampToValueAtTime', v); this._finite('exponentialRampToValueAtTime', t);
    if (v === 0) throw new RangeError(`${this.name}.exponentialRampToValueAtTime: value must be non-zero`);
    this._auto.push({ kind: 'point', start: t, end: t });
    this.value = v; return this;
  }
  linearRampToValueAtTime(v, t) {
    this._finite('linearRampToValueAtTime', v); this._finite('linearRampToValueAtTime', t);
    this._auto.push({ kind: 'point', start: t, end: t });
    this.value = v; return this;
  }
  cancelScheduledValues(t) {
    this._finite('cancelScheduledValues', t);
    this._auto = this._auto.filter(a => a.start < t);
    return this;
  }
  cancelAndHoldAtTime(t) {
    this._finite('cancelAndHoldAtTime', t);
    // Drop events scheduled at/after t, and truncate any curve that spans t so a
    // value scheduled exactly at t sits on the (legal) boundary, not inside it.
    this._auto = this._auto
      .filter(a => a.start < t)
      .map(a => (a.kind === 'curve' && a.end > t) ? { kind: 'curve', start: a.start, end: t } : a);
    return this;
  }
}

class MockNode {
  constructor(ctx, kind) {
    this.ctx = ctx;
    this.kind = kind;
    this.id = ++NODE_SEQ;
    this._connections = [];
    ctx._registerNode(this);
  }
  connect(dest) { this._connections.push(dest); return dest; }
  disconnect() { this._connections.length = 0; this.ctx._onDisconnect(this); }
}

class MockScheduledSource extends MockNode {
  constructor(ctx, kind) {
    super(ctx, kind);
    this._started = false;
    this._stopped = false;
    this._stopTime = Infinity;
    this._listeners = { ended: [] };
    this._endedFired = false;
  }
  addEventListener(type, cb, opts) {
    (this._listeners[type] ||= []).push({ cb, once: !!(opts && opts.once) });
  }
  removeEventListener(type, cb) {
    if (!this._listeners[type]) return;
    this._listeners[type] = this._listeners[type].filter(l => l.cb !== cb);
  }
  start(when = this.ctx.currentTime) {
    if (this._started) throw new Error(`${this.kind}.start called twice (node ${this.id})`);
    this._started = true;
    this._startTime = when;
    this.ctx._activeSources.add(this);
  }
  stop(when = this.ctx.currentTime) {
    if (!this._started) throw new Error(`${this.kind}.stop called before start (node ${this.id})`);
    // Chrome: the most recent stop() call is the one applied.
    this._stopped = true;
    this._stopTime = when;
  }
  _fireEnded() {
    if (this._endedFired) return;
    this._endedFired = true;
    this.ctx._activeSources.delete(this);
    for (const l of (this._listeners.ended || []).slice()) l.cb({ target: this });
  }
}

class MockBufferSource extends MockScheduledSource {
  constructor(ctx) { super(ctx, 'BufferSource'); this.buffer = null; this.loop = false; this.playbackRate = new MockParam(ctx, 'BufferSource', 'playbackRate'); this.playbackRate.value = 1; this.detune = new MockParam(ctx, 'BufferSource', 'detune'); }
}
class MockOscillator extends MockScheduledSource {
  constructor(ctx) { super(ctx, 'Oscillator'); this.type = 'sine'; this.frequency = new MockParam(ctx, 'Oscillator', 'frequency'); this.detune = new MockParam(ctx, 'Oscillator', 'detune'); }
  setPeriodicWave() {}
}
class MockGain extends MockNode { constructor(ctx) { super(ctx, 'Gain'); this.gain = new MockParam(ctx, 'Gain', 'gain'); this.gain.value = 1; } }
class MockBiquad extends MockNode { constructor(ctx) { super(ctx, 'Biquad'); this.type = 'lowpass'; this.frequency = new MockParam(ctx, 'Biquad', 'frequency'); this.Q = new MockParam(ctx, 'Biquad', 'Q'); this.detune = new MockParam(ctx, 'Biquad', 'detune'); } }
class MockShaper extends MockNode { constructor(ctx) { super(ctx, 'WaveShaper'); this.curve = null; this.oversample = 'none'; } }
class MockPanner extends MockNode { constructor(ctx) { super(ctx, 'StereoPanner'); this.pan = new MockParam(ctx, 'StereoPanner', 'pan'); } }
class MockDelay extends MockNode { constructor(ctx) { super(ctx, 'Delay'); this.delayTime = new MockParam(ctx, 'Delay', 'delayTime'); } }
class MockConvolver extends MockNode { constructor(ctx) { super(ctx, 'Convolver'); this.buffer = null; } }
class MockCompressor extends MockNode {
  constructor(ctx) {
    super(ctx, 'Compressor');
    for (const p of ['threshold', 'knee', 'ratio', 'attack', 'release']) this[p] = new MockParam(ctx, 'Compressor', p);
  }
}
class MockBuffer {
  constructor(channels, length, sampleRate) { this.numberOfChannels = channels; this.length = length; this.sampleRate = sampleRate; this.duration = length / sampleRate; this._data = Array.from({ length: channels }, () => new Float32Array(length)); }
  getChannelData(i) { return this._data[i]; }
}

class MockAudioContext {
  constructor() {
    this._now = 0;
    this.sampleRate = 44100;
    this.state = 'running';
    this._liveNodes = new Set();
    this._activeSources = new Set();
    this._createdByKind = {};
    this._totalCreated = 0;
    this._overlaps = [];
    this._disconnectCount = 0;
    this.destination = new MockNode(this, 'Destination');
  }
  get currentTime() { return this._now; }
  _registerNode(node) {
    this._liveNodes.add(node);
    this._createdByKind[node.kind] = (this._createdByKind[node.kind] || 0) + 1;
    this._totalCreated++;
  }
  _onDisconnect(node) { this._disconnectCount++; this._liveNodes.delete(node); }
  createBufferSource() { return new MockBufferSource(this); }
  createOscillator() { return new MockOscillator(this); }
  createGain() { return new MockGain(this); }
  createBiquadFilter() { return new MockBiquad(this); }
  createWaveShaper() { return new MockShaper(this); }
  createStereoPanner() { return new MockPanner(this); }
  createDelay() { return new MockDelay(this); }
  createConvolver() { return new MockConvolver(this); }
  createDynamicsCompressor() { return new MockCompressor(this); }
  createPeriodicWave() { return { _periodicWave: true }; }
  createBuffer(ch, len, sr) { return new MockBuffer(ch, len, sr); }
  resume() { this.state = 'running'; return Promise.resolve(); }
  /** Advance the virtual clock and fire 'ended' for any source whose stop time passed. */
  advance(seconds) {
    this._now += seconds;
    for (const src of [...this._activeSources]) {
      if (src._stopped && src._stopTime <= this._now) src._fireEnded();
    }
  }
}

// Install globals BEFORE importing the synth (AudioEngine reads window.AudioContext).
globalThis.window = { AudioContext: MockAudioContext, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
globalThis.AudioContext = MockAudioContext;

const { WebAudioSynth } = await import('../src/instruments/WebAudioSynth.js');

function makeSamplePatch(playbackMode = 'oneShot') {
  // Two zones, a few octaves apart, mirroring a built-in multi-sample pack.
  const mk = (rootMidi, durationSec) => {
    const sr = 44100;
    const buf = new MockBuffer(1, Math.floor(sr * durationSec), sr);
    return { rootMidi, buffer: buf };
  };
  const sampleMap = [mk(48, 2.4), mk(60, 2.2), mk(72, 1.8)];
  return {
    type: 'sample',
    name: 'Test Grand',
    family: 'sample',
    sampleMap,
    sampleBuffer: sampleMap[1].buffer,
    rootMidi: 60,
    playbackMode,
    gain: 0.5,
    envelope: { attack: 0.001, decay: 0.4, sustain: 1, release: 0.3 },
    filter: { type: 'lowpass', frequency: 9000, Q: 0.7 },
  };
}

function runStress(label, { patch, taps, sameNote = false, withRelease = true, advanceEvery = 1, advanceBy = 0.004 }) {
  const synth = new WebAudioSynth();
  synth.init();
  synth.loadPatch(patch);
  const ctx = synth.engine.ctx;
  ctx._overlaps = []; // reset per run (AudioEngine is a singleton; ctx is shared)

  const baseTotal = ctx._totalCreated;
  let peakActive = 0;
  let peakVoices = 0;
  let peakSounding = 0;
  let thrown = 0;
  let firstError = null;
  const notes = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76];

  for (let n = 0; n < taps; n++) {
    const midi = sameNote ? 60 : notes[n % notes.length];
    try {
      synth.noteOn(midi, 0.8);
      if (withRelease) synth.noteOff(midi);
    } catch (err) {
      thrown++;
      if (!firstError) firstError = err;
    }
    if (n % advanceEvery === 0) ctx.advance(advanceBy); // simulate real-time between taps
    peakActive = Math.max(peakActive, ctx._activeSources.size);
    peakVoices = Math.max(peakVoices, synth._voices.size);
    peakSounding = Math.max(peakSounding, synth.voiceStats().sounding);
  }
  // Let everything finish.
  ctx.advance(10);
  const leakedActive = ctx._activeSources.size;
  const leakedVoices = synth._voices.size;
  const created = ctx._totalCreated - baseTotal;

  console.log(`\n[${label}]`);
  console.log(`  taps=${taps} sameNote=${sameNote} withRelease=${withRelease}`);
  console.log(`  nodes created: ${created}  (per tap: ${(created / taps).toFixed(1)})`);
  console.log(`  peak active sources: ${peakActive}   peak _voices: ${peakVoices}   peak SOUNDING voices: ${peakSounding}`);
  console.log(`  AFTER flush -> active sources: ${leakedActive}   _voices: ${leakedVoices}   releasing: ${synth._releasing.size}`);
  console.log(`  scheduling exceptions: ${thrown}${firstError ? '  firstError=' + firstError.message : ''}`);
  console.log(`  automation overlap warnings: ${ctx._overlaps.length}`);
  if (ctx._overlaps.length) console.log('   e.g. ' + ctx._overlaps.slice(0, 3).join('\n        '));
  return { created, peakActive, peakVoices, peakSounding, leakedActive, leakedVoices, thrown, firstError, overlaps: ctx._overlaps.length };
}

console.log('===== WebAudioSynth rapid-retrigger stress (mock AudioContext) =====');

// 1) The reported scenario: oneShot sample, fast tapping across notes (each tap = noteOn+noteOff).
const r1 = runStress('oneShot sample · fast melodic tapping', { patch: makeSamplePatch('oneShot'), taps: 600 });

// 2) oneShot sample, hammering the SAME pad (worst-case retrigger of one note).
const r2 = runStress('oneShot sample · same-note hammering', { patch: makeSamplePatch('oneShot'), taps: 600, sameNote: true });

// 3) oneShot sample, noteOn ONLY (fire-and-forget; no release) — relies purely on auto-stop.
const r3 = runStress('oneShot sample · noteOn-only (no release)', { patch: makeSamplePatch('oneShot'), taps: 600, withRelease: false });

// 4) gated sample (custom-instrument default) for comparison.
const r4 = runStress('gated sample · fast melodic tapping', { patch: makeSamplePatch('gated'), taps: 600 });

// 5) Baseline: synth patch, same brutal tapping (user says this does NOT crash).
const { PRESETS } = await import('../src/instruments/WebAudioSynth.js');
const r5 = runStress('SYNTH (modern_keys) · fast melodic tapping', { patch: PRESETS.modern_keys, taps: 600 });

// 6-8) The new Section A voice types must also stay bounded + leak-free.
const r6 = runStress('FM (fm_epiano) · fast melodic tapping', { patch: PRESETS.fm_epiano, taps: 600 });
const r7 = runStress('PLUCK (pluck_nylon) · fast melodic tapping', { patch: PRESETS.pluck_nylon, taps: 600 });
const r8 = runStress('ADDITIVE (add_organ) · fast melodic tapping', { patch: PRESETS.add_organ, taps: 600 });

console.log('\n===== assertions =====');

// MAX_SOUNDING_VOICES in WebAudioSynth is 16; allow a tiny slack for the
// transient between a noteOff (adds one releasing) and the next noteOn's cap
// enforcement, plus the few-ms retire tail.
const SOUNDING_CAP = 16;
const SOUNDING_SLACK = 4;

const all = { r1, r2, r3, r4, r5, r6, r7, r8 };
const sampleRuns = { r1, r2, r3, r4 };

for (const [k, r] of Object.entries(all)) {
  assert.equal(r.thrown, 0, `${k}: scheduling threw ${r.thrown} time(s) (${r.firstError && r.firstError.message})`);
  assert.equal(r.overlaps, 0, `${k}: ${r.overlaps} AudioParam overlap hazard(s)`);
  assert.equal(r.leakedActive, 0, `${k}: ${r.leakedActive} source node(s) never freed after flush (leak)`);
  assert.equal(r.leakedVoices, 0, `${k}: ${r.leakedVoices} voice(s) stuck in the held map after flush`);
  assert.ok(
    r.peakSounding <= SOUNDING_CAP + SOUNDING_SLACK,
    `${k}: peak sounding voices ${r.peakSounding} exceeded cap ${SOUNDING_CAP}(+${SOUNDING_SLACK}) — voice-stealing regressed`
  );
}

// The crash-specific guard: concurrently-playing sample SOURCE nodes must stay
// bounded under rapid retrigger. Pre-fix this was ~108; the cap keeps it ~20.
for (const [k, r] of Object.entries(sampleRuns)) {
  assert.ok(
    r.peakActive <= 32,
    `${k}: ${r.peakActive} concurrent sample sources (pre-fix ~108) — rapid-retrigger pile-up regressed`
  );
}

console.log('PASS rapid retrigger keeps sounding voices bounded (no STATUS_BREAKPOINT pile-up)');
console.log('PASS no AudioParam scheduling exceptions or overlap hazards');
console.log('PASS no node / voice leaks after playback finishes');
console.log('\nALL AUDIO STRESS CHECKS PASSED');
