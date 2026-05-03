/**
 * SketchKit — Synthesized drum kit.
 * All sounds generated via Web Audio. Settings-driven pad count.
 */

import { AudioEngine } from '../engine/AudioEngine.js';

const SOUNDS = [
  { id: 'kick',    icon: '💥', label: 'KICK',     sound: 'kick' },
  { id: 'snare',   icon: '🥁', label: 'SNARE',    sound: 'snare' },
  { id: 'clap',    icon: '👏', label: 'CLAP',     sound: 'clap' },
  { id: 'hihat',   icon: '🔔', label: 'HI-HAT',   sound: 'hihat' },
  { id: 'cymbal',  icon: '✨', label: 'CYMBAL',   sound: 'cymbal' },
  { id: 'tomlo',   icon: '🪘', label: 'TOM LO',   sound: 'tomlo' },
  { id: 'tommid',  icon: '🪘', label: 'TOM MID',  sound: 'tommid' },
  { id: 'tomhi',   icon: '🪘', label: 'TOM HI',   sound: 'tomhi' },
  { id: 'rim',     icon: '🥢', label: 'RIM',      sound: 'rim' },
  { id: 'shaker',  icon: '🪇', label: 'SHAKER',   sound: 'shaker' },
];

export class SketchKit {
  constructor(project) {
    this.engine = AudioEngine.getInstance();
    this._project = project;
    this.el = null;
    this._output = null;
    this._onHit = null;

    window.addEventListener('settings-pads-changed', () => {
      if (this.el) this._refreshPads();
    });
  }

  set project(p) {
    this._project = p;
    if (this.el) this._refreshPads();
  }
  get project() { return this._project; }

  setHitCallback(onHit) { this._onHit = onHit; }

  init() {
    this._output = this.engine.createTrackBus();
    this._output.gain.value = 0.7;
  }

  get _padCount() {
    return Math.min(
      this.project?.settings?.drumPads || 10,
      SOUNDS.length
    );
  }

  _visibleSounds() {
    return SOUNDS.slice(0, this._padCount);
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'sketchkit';
    this.el.id = 'sketchkit';

    this.el.innerHTML = `
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
    this._bindPadEvents();
  }

  _bindPadEvents() {
    this.el.querySelectorAll('.sketchkit__pad').forEach(pad => {
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const sound = pad.dataset.pad;
        this._triggerSound(sound);
        pad.classList.add('is-active');
        if (this._onHit) this._onHit(sound);
        setTimeout(() => pad.classList.remove('is-active'), 120);
      });
    });
  }

  _triggerSound(sound, atTime) {
    const ctx = this.engine.ctx;
    if (!ctx || !this._output) return;
    const t = atTime !== undefined ? atTime : ctx.currentTime;
    switch (sound) {
      case 'kick':    this._synthKick(ctx, t); break;
      case 'snare':   this._synthSnare(ctx, t); break;
      case 'clap':    this._synthClap(ctx, t); break;
      case 'hihat':   this._synthHiHat(ctx, t, false); break;
      case 'cymbal':  this._synthHiHat(ctx, t, true); break;
      case 'tomlo':   this._synthTom(ctx, t, 80); break;
      case 'tommid':  this._synthTom(ctx, t, 140); break;
      case 'tomhi':   this._synthTom(ctx, t, 220); break;
      case 'rim':     this._synthRim(ctx, t); break;
      case 'shaker':  this._synthShaker(ctx, t); break;
    }
  }

  _synthKick(ctx, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(g); g.connect(this._output);
    o.start(t); o.stop(t + 0.4);
  }

  _synthSnare(ctx, t) {
    const len = 0.15, bs = ctx.sampleRate * len;
    const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(f); f.connect(g); g.connect(this._output); n.start(t);
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.06);
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0.7, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(bg); bg.connect(this._output); o.start(t); o.stop(t + 0.12);
  }

  _synthClap(ctx, t) {
    for (let i = 0; i < 3; i++) {
      const off = t + i * 0.012, bs = ctx.sampleRate * 0.04;
      const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < bs; j++) d[j] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(); n.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.8, off);
      g.gain.exponentialRampToValueAtTime(0.001, off + 0.08);
      n.connect(f); f.connect(g); g.connect(this._output); n.start(off);
    }
  }

  _synthHiHat(ctx, t, long) {
    const dur = long ? 0.4 : 0.06, bs = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = long ? 5000 : 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(long ? 0.4 : 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(this._output); n.start(t);
  }

  _synthTom(ctx, t, freq) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq * 1.2, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.15);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g); g.connect(this._output);
    o.start(t); o.stop(t + 0.35);
  }

  _synthRim(ctx, t) {
    const len = 0.08, bs = ctx.sampleRate * len;
    const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bs; i++) d[i] = Math.random() * 2 - 1;
    const n = ctx.createBufferSource(); n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4000; f.Q.value = 8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    n.connect(f); f.connect(g); g.connect(this._output); n.start(t);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(800, t); o.frequency.exponentialRampToValueAtTime(200, t + 0.03);
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0.5, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(bg); bg.connect(this._output); o.start(t); o.stop(t + 0.06);
  }

  _synthShaker(ctx, t) {
    const dur = 0.2, steps = 8;
    for (let i = 0; i < steps; i++) {
      const off = t + i * (dur / steps);
      const bs = ctx.sampleRate * 0.015;
      const buf = ctx.createBuffer(1, bs, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < bs; j++) d[j] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(); n.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.25 * (1 - i / steps), off);
      g.gain.exponentialRampToValueAtTime(0.001, off + 0.025);
      n.connect(f); f.connect(g); g.connect(this._output); n.start(off);
    }
  }
}
