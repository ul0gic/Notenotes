/**
 * Metronome — Global click track available in all modes.
 * Uses oscillator-based clicks for zero-latency, sample-free operation.
 */

import { AudioEngine } from './AudioEngine.js';

export class Metronome {
  constructor(transport) {
    this.engine = AudioEngine.getInstance();
    this.transport = transport;

    this.enabled = false;
    this.volume = 0.5;

    /** @type {GainNode|null} */
    this._gainNode = null;
    this._unsubBeat = null;
  }

  /**
   * Initialize audio nodes. Call after AudioEngine.init().
   */
  init() {
    this._gainNode = this.engine.ctx.createGain();
    this._gainNode.gain.value = this.volume;
    this._gainNode.connect(this.engine.output);

    // Subscribe to beat events from transport
    this._unsubBeat = this.transport.onBeat((beat, time) => {
      if (this.enabled) {
        this._click(time, beat === 0);
      }
    });
  }

  /**
   * Toggle metronome on/off.
   */
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /**
   * Set metronome volume (0–1).
   * @param {number} value
   */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this._gainNode) {
      this._gainNode.gain.setTargetAtTime(this.volume, this.engine.currentTime, 0.01);
    }
  }

  /**
   * Play a click sound at the specified time.
   * @param {number} time - AudioContext time to play at
   * @param {boolean} accent - Whether this is an accented beat (beat 1)
   */
  _click(time, accent) {
    const ctx = this.engine.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.connect(env);
    env.connect(this._gainNode);

    if (accent) {
      // Accented click: higher pitch, slightly louder
      osc.frequency.setValueAtTime(1200, time);
      env.gain.setValueAtTime(0.8, time);
    } else {
      // Regular click
      osc.frequency.setValueAtTime(800, time);
      env.gain.setValueAtTime(0.5, time);
    }

    // Sharp envelope: quick attack, fast decay
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  }

  /**
   * Clean up subscriptions.
   */
  destroy() {
    if (this._unsubBeat) {
      this._unsubBeat();
      this._unsubBeat = null;
    }
  }
}
