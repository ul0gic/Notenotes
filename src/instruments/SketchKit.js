/**
 * SketchKit — Synthesized drum kit with selectable kits.
 * All sounds generated via Web Audio. Settings-driven pad count.
 * Supports multiple drum kit presets (Classic, 808, Electronic, Acoustic).
 */

import { AudioEngine } from '../engine/AudioEngine.js';

export const DRUM_KITS = {
  classic: {
    name: 'Classic',
    sounds: {
      kick:    { osc: 'sine',  freq0: 150, freq1: 40,  decay: 0.4,  vol: 1.0, clicks: false },
      snare:   { osc: 'triangle', noiseHp: 1000, bodyFreq: 200, bodyDecay: 0.12, noiseDecay: 0.15, vol: 0.8, clicks: false },
      clap:    { bpFreq: 2000, bpQ: 3, vol: 0.8, decay: 0.08, clicks: false },
      hihat:   { hpFreq: 7000, vol: 0.5, decay: 0.06, clicks: false },
      cymbal:  { hpFreq: 5000, vol: 0.4, decay: 0.4, clicks: false },
      tomlo:   { osc: 'triangle', freq0: 96, freq1: 48,  decay: 0.35, vol: 0.8, clicks: false },
      tommid:  { osc: 'triangle', freq0: 168, freq1: 84,  decay: 0.35, vol: 0.8, clicks: false },
      tomhi:   { osc: 'triangle', freq0: 264, freq1: 132,  decay: 0.3,  vol: 0.75, clicks: false },
      rim:     { bpFreq: 4000, bpQ: 8, rimFreq: 800, rimDecay: 0.03, noiseDecay: 0.08, vol: 0.9, clicks: true },
      shaker:  { hpFreq: 8000, vol: 0.25, decay: 0.2, steps: 8, clicks: false },
    }
  },
  eight08: {
    name: '808',
    sounds: {
      kick:    { osc: 'sine',  freq0: 56,  freq1: 28,  decay: 0.55, vol: 1.0, clicks: true },
      snare:   { osc: 'triangle', noiseHp: 1500, bodyFreq: 250, bodyDecay: 0.08, noiseDecay: 0.18, vol: 0.9, clicks: false },
      clap:    { bpFreq: 1800, bpQ: 4, vol: 0.9, decay: 0.1, clicks: true },
      hihat:   { hpFreq: 9000, vol: 0.4, decay: 0.04, clicks: false },
      cymbal:  { hpFreq: 6000, vol: 0.35, decay: 0.5, clicks: false },
      tomlo:   { osc: 'sine',  freq0: 75,  freq1: 38,  decay: 0.4,  vol: 0.85, clicks: true },
      tommid:  { osc: 'sine',  freq0: 130, freq1: 65,  decay: 0.35, vol: 0.85, clicks: true },
      tomhi:   { osc: 'sine',  freq0: 200, freq1: 110,  decay: 0.3,  vol: 0.8, clicks: true },
      rim:     { bpFreq: 3500, bpQ: 10, rimFreq: 1000, rimDecay: 0.02, noiseDecay: 0.06, vol: 0.95, clicks: true },
      shaker:  { hpFreq: 9000, vol: 0.2, decay: 0.15, steps: 10, clicks: false },
    }
  },
  electronic: {
    name: 'Electronic',
    sounds: {
      kick:    { osc: 'sawtooth', freq0: 120, freq1: 30,  decay: 0.3,  vol: 0.9, clicks: true },
      snare:   { osc: 'square', noiseHp: 2000, bodyFreq: 300, bodyDecay: 0.1, noiseDecay: 0.12, vol: 0.85, clicks: true },
      clap:    { bpFreq: 2500, bpQ: 6, vol: 0.85, decay: 0.06, clicks: true },
      hihat:   { hpFreq: 10000, vol: 0.4, decay: 0.03, clicks: true },
      cymbal:  { hpFreq: 7000, vol: 0.35, decay: 0.35, clicks: false },
      tomlo:   { osc: 'square', freq0: 90,  freq1: 40,  decay: 0.3,  vol: 0.8, clicks: true },
      tommid:  { osc: 'square', freq0: 160, freq1: 80,  decay: 0.28, vol: 0.75, clicks: true },
      tomhi:   { osc: 'square', freq0: 250, freq1: 120,  decay: 0.25, vol: 0.7, clicks: true },
      rim:     { bpFreq: 5000, bpQ: 12, rimFreq: 1200, rimDecay: 0.02, noiseDecay: 0.05, vol: 0.9, clicks: true },
      shaker:  { hpFreq: 10000, vol: 0.2, decay: 0.12, steps: 12, clicks: true },
    }
  },
  acoustic: {
    name: 'Acoustic',
    sounds: {
      kick:    { osc: 'sine',  freq0: 130, freq1: 35,  decay: 0.5,  vol: 1.0, clicks: false },
      snare:   { osc: 'triangle', noiseHp: 800, bodyFreq: 180, bodyDecay: 0.15, noiseDecay: 0.2, vol: 0.85, clicks: false },
      clap:    { bpFreq: 1500, bpQ: 2, vol: 0.75, decay: 0.1, clicks: false },
      hihat:   { hpFreq: 6000, vol: 0.35, decay: 0.08, clicks: false },
      cymbal:  { hpFreq: 4000, vol: 0.3, decay: 0.5, clicks: false },
      tomlo:   { osc: 'triangle', freq0: 100, freq1: 50,  decay: 0.4,  vol: 0.85, clicks: false },
      tommid:  { osc: 'triangle', freq0: 155, freq1: 77,  decay: 0.35, vol: 0.85, clicks: false },
      tomhi:   { osc: 'triangle', freq0: 230, freq1: 115,  decay: 0.3,  vol: 0.8, clicks: false },
      rim:     { bpFreq: 3000, bpQ: 6, rimFreq: 700, rimDecay: 0.04, noiseDecay: 0.1, vol: 0.9, clicks: true },
      shaker:  { hpFreq: 7000, vol: 0.2, decay: 0.25, steps: 7, clicks: false },
    }
  },
};

const SOUNDS = [
  { id: 'kick',    icon: '💥', label: 'KICK' },
  { id: 'snare',   icon: '🥁', label: 'SNARE' },
  { id: 'clap',    icon: '👏', label: 'CLAP' },
  { id: 'hihat',   icon: '🔔', label: 'HI-HAT' },
  { id: 'cymbal',  icon: '✨', label: 'CYMBAL' },
  { id: 'tomlo',   icon: '🪘', label: 'TOM LO' },
  { id: 'tommid',  icon: '🪘', label: 'TOM MID' },
  { id: 'tomhi',   icon: '🪘', label: 'TOM HI' },
  { id: 'rim',     icon: '🥢', label: 'RIM' },
  { id: 'shaker',  icon: '🪇', label: 'SHAKER' },
];

export class SketchKit {
  constructor(project) {
    this.engine = AudioEngine.getInstance();
    this._project = project;
    this.el = null;
    this._output = null;
    this._kitId = 'classic';
    this._onHit = null;
    this._activePadTimers = new Map();

    window.addEventListener('settings-pads-changed', () => {
      if (this.el) this._refreshPads();
    });
  }

  set project(p) {
    this._project = p;
    if (this.el) this._refreshPads();
  }
  get project() { return this._project; }

  loadKit(kitId) {
    if (DRUM_KITS[kitId]) {
      this._kitId = kitId;
    }
  }

  get _activeKit() { return DRUM_KITS[this._kitId] || DRUM_KITS.classic; }

  setHitCallback(onHit) { this._onHit = onHit; }

  init() {
    this._output = this.engine.createTrackBus();
    this._output.gain.value = 0.7;
  }

  get _padCount() {
    return Math.min(this.project?.settings?.drumPads || 10, SOUNDS.length);
  }

  _visibleSounds() {
    return SOUNDS.slice(0, this._padCount);
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'sketchkit';
    this.el.id = 'sketchkit';

    this.el.innerHTML = `
      <div class="sk-kit-selector" id="sk-kit-selector">
        <label class="sk-kit-selector__label">Kit</label>
        <select class="sk-kit-selector__select" id="sk-kit-select" aria-label="Drum kit">
          ${Object.entries(DRUM_KITS).map(([key, k]) =>
            `<option value="${key}" ${key === this._kitId ? 'selected' : ''}>${k.name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="sketchkit__pads" id="sk-pads" style="grid-template-columns:${this._gridColumns()};">
        ${this._renderPads()}
      </div>
    `;

    this._bindEvents();
    return this.el;
  }

  _gridColumns() {
    const cols = Math.ceil(Math.sqrt(this._padCount));
    return `repeat(${cols}, 1fr)`;
  }

  _renderPads() {
    return this._visibleSounds().map((s, i) => {
      const padClass = `sketchkit__pad--${s.id}`;
      return `
        <button class="sketchkit__pad ${padClass}" data-pad="${s.id}" data-index="${i}"
                aria-label="${s.label}">
          <span class="sketchkit__pad-icon">${s.icon}</span>
          <span class="sketchkit__pad-label">${s.label}</span>
        </button>
      `;
    }).join('');
  }

  _refreshPads() {
    const container = this.el.querySelector('#sk-pads');
    if (!container) return;
    container.style.gridTemplateColumns = this._gridColumns();
    container.innerHTML = this._renderPads();
    this._bindPadEvents();
  }

  _bindEvents() {
    this.el.querySelector('#sk-kit-select')?.addEventListener('change', (e) => {
      this.loadKit(e.target.value);
    });
    this._bindPadEvents();
  }

  _bindPadEvents() {
    this.el.querySelectorAll('.sketchkit__pad').forEach(pad => {
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const sid = pad.dataset.pad;
        this.triggerPad(sid);
      });
    });
  }

  visiblePadIds() {
    return [...(this.el?.querySelectorAll('.sketchkit__pad') || [])]
      .map(pad => pad.dataset.pad)
      .filter(Boolean);
  }

  triggerVisiblePad(index) {
    const sid = this.visiblePadIds()[index];
    if (sid) this.triggerPad(sid);
  }

  triggerPad(sid) {
    const pad = this.el?.querySelector(`.sketchkit__pad[data-pad="${sid}"]`);
    this._triggerSound(sid);
    if (pad) {
      pad.classList.add('is-active');
      const oldTimer = this._activePadTimers.get(sid);
      if (oldTimer) clearTimeout(oldTimer);
      const timer = setTimeout(() => {
        pad.classList.remove('is-active');
        this._activePadTimers.delete(sid);
      }, 120);
      this._activePadTimers.set(sid, timer);
    }
    if (this._onHit) this._onHit(sid);
  }

  _triggerSound(sid, atTime) {
    const ctx = this.engine.ctx;
    if (!ctx || !this._output) return;
    const t = atTime !== undefined ? atTime : ctx.currentTime;
    const p = this._activeKit.sounds[sid];
    if (!p) return;

    switch (sid) {
      case 'kick':
      case 'tomlo':
      case 'tommid':
      case 'tomhi':
        this._synthTone(ctx, t, p); break;
      case 'snare':
        this._synthSnare(ctx, t, p); break;
      case 'clap':
        this._synthClap(ctx, t, p); break;
      case 'hihat':
      case 'cymbal':
        this._synthHiHat(ctx, t, p, sid === 'cymbal'); break;
      case 'rim':
        this._synthRim(ctx, t, p); break;
      case 'shaker':
        this._synthShaker(ctx, t, p); break;
    }
  }

  _synthTone(ctx, t, p) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = p.osc;
    o.frequency.setValueAtTime(p.freq0, t);
    o.frequency.exponentialRampToValueAtTime(p.freq1, t + p.decay * 0.35);
    g.gain.setValueAtTime(p.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + p.decay);
    o.connect(g); g.connect(this._output);
    o.start(t); o.stop(t + p.decay);
    if (p.clicks) {
      const cO = ctx.createOscillator(), cG = ctx.createGain();
      cO.type = 'square'; cO.frequency.value = 800;
      cG.gain.setValueAtTime(p.vol * 0.4, t);
      cG.gain.exponentialRampToValueAtTime(0.001, t + 0.01);
      cO.connect(cG); cG.connect(this._output);
      cO.start(t); cO.stop(t + 0.01);
    }
  }

  _synthSnare(ctx, t, p) {
    const noiselen = p.noiseDecay, bs = ctx.sampleRate * noiselen;
    const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = p.noiseHp;
    const g = ctx.createGain(); g.gain.setValueAtTime(p.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + noiselen);
    n.connect(f); f.connect(g); g.connect(this._output); n.start(t);

    const o = ctx.createOscillator(); o.type = p.osc;
    o.frequency.setValueAtTime(p.bodyFreq, t);
    o.frequency.exponentialRampToValueAtTime(p.bodyFreq * 0.4, t + p.bodyDecay * 0.5);
    const bg = ctx.createGain(); bg.gain.setValueAtTime(p.vol * 0.7, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + p.bodyDecay);
    o.connect(bg); bg.connect(this._output); o.start(t); o.stop(t + p.bodyDecay);
  }

  _synthClap(ctx, t, p) {
    for (let i = 0; i < 3; i++) {
      const off = t + i * 0.012, bs = ctx.sampleRate * 0.04;
      const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < bs; j++) d[j] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(); n.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.value = p.bpFreq; f.Q.value = p.bpQ;
      const g = ctx.createGain(); g.gain.setValueAtTime(p.vol, off);
      g.gain.exponentialRampToValueAtTime(0.001, off + p.decay);
      n.connect(f); f.connect(g); g.connect(this._output); n.start(off);
    }
  }

  _synthHiHat(ctx, t, p, long) {
    const dur = long ? p.decay : (p.decay || 0.06);
    const bs = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = p.hpFreq;
    const g = ctx.createGain(); g.gain.setValueAtTime(p.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(this._output); n.start(t);
  }

  _synthRim(ctx, t, p) {
    const noiselen = p.noiseDecay, bs = ctx.sampleRate * noiselen;
    const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.value = p.bpFreq; f.Q.value = p.bpQ;
    const g = ctx.createGain(); g.gain.setValueAtTime(p.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + noiselen);
    n.connect(f); f.connect(g); g.connect(this._output); n.start(t);

    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(p.rimFreq, t);
    o.frequency.exponentialRampToValueAtTime(p.rimFreq * 0.25, t + p.rimDecay);
    const rg = ctx.createGain(); rg.gain.setValueAtTime(p.vol * 0.5, t);
    rg.gain.exponentialRampToValueAtTime(0.001, t + p.rimDecay * 2);
    o.connect(rg); rg.connect(this._output); o.start(t); o.stop(t + p.rimDecay * 2);
  }

  _synthShaker(ctx, t, p) {
    const dur = p.decay, steps = p.steps;
    for (let i = 0; i < steps; i++) {
      const off = t + i * (dur / steps);
      const bs = ctx.sampleRate * 0.015;
      const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < bs; j++) d[j] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(); n.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = p.hpFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(p.vol * (1 - i / steps), off);
      g.gain.exponentialRampToValueAtTime(0.001, off + 0.025);
      n.connect(f); f.connect(g); g.connect(this._output); n.start(off);
    }
  }
}
