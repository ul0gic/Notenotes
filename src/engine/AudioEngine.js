/**
 * AudioEngine — Singleton managing the master AudioContext.
 * All audio routing flows through here.
 */

let instance = null;

export class AudioEngine {
  constructor() {
    if (instance) return instance;
    instance = this;

    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {GainNode|null} */
    this.masterGain = null;
    /** @type {DynamicsCompressorNode|null} */
    this.limiter = null;
    this._initialized = false;
    this._mediaRoutePrimed = false;
    this._mediaRoutePrimePromise = null;
  }

  static getInstance() {
    if (!instance) {
      instance = new AudioEngine();
    }
    return instance;
  }

  /**
   * Initialize the AudioContext. Must be called from a user gesture.
   */
  async init() {
    if (this._initialized) return;
    this.initSync();
  }

  /**
   * Synchronous init — AudioContext must be created in the same call stack
   * as the user gesture event for Chrome's autoplay policy.
   */
  initSync() {
    if (this._initialized) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 44100,
      latencyHint: 'interactive'
    });

    // Immediately resume if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.unlockGesture();

    // Master output chain: source → masterGain → limiter → destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.8;

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -3;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.1;

    this.masterGain.connect(this.limiter);
    this.limiter.connect(this.ctx.destination);

    this._initialized = true;
    console.log('[AudioEngine] Initialized. Sample rate:', this.ctx.sampleRate);
  }

  /**
   * Resume the AudioContext if suspended (browser autoplay policy).
   */
  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Best-effort browser audio unlock. iOS WebKit sometimes needs real graph
   * activity on the same gesture as the user's note press, not only context
   * creation. Safe to call repeatedly from pointer/touch handlers.
   */
  unlockGesture() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    try {
      const source = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      source.frequency.value = 440;
      gain.gain.setValueAtTime(0.00001, now);
      gain.gain.exponentialRampToValueAtTime(0.000001, now + 0.04);
      source.connect(gain);
      gain.connect(this.ctx.destination);
      source.start(now);
      source.stop(now + 0.04);
    } catch (e) { /* non-critical unlock nudge */ }
  }

  get mediaRoutePrimed() {
    return this._mediaRoutePrimed;
  }

  markMediaRoutePrimed() {
    this._mediaRoutePrimed = true;
  }

  /**
   * iOS Safari can report a running AudioContext while still muting app audio
   * until the page has opened the system media route. This intentionally uses
   * the same user-permission path as Mic In, then closes the stream immediately.
   */
  async primeMediaRoute() {
    if (this._mediaRoutePrimed) return true;
    if (this._mediaRoutePrimePromise) return this._mediaRoutePrimePromise;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    this._mediaRoutePrimePromise = navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        this._mediaRoutePrimed = true;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notenotes-audio-state-changed', {
            detail: { state: this.ctx?.state || 'unknown', mediaRoutePrimed: true },
          }));
        }
        return true;
      })
      .finally(() => {
        this._mediaRoutePrimePromise = null;
      });

    return this._mediaRoutePrimePromise;
  }

  /**
   * Get the current audio time.
   * @returns {number}
   */
  get currentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /**
   * Get the master output node to connect instruments to.
   * @returns {GainNode}
   */
  get output() {
    return this.masterGain;
  }

  /**
   * Set master volume (0–1).
   * @param {number} value
   */
  setVolume(value) {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, value)),
        this.ctx.currentTime,
        0.01
      );
    }
  }

  /**
   * Create a fresh GainNode connected to master.
   * Used for instrument/track sub-mixes.
   * @returns {GainNode}
   */
  createTrackBus() {
    const gain = this.ctx.createGain();
    gain.connect(this.masterGain);
    return gain;
  }

  setTrackBusPan(gain, pan = 0) {
    if (!gain || !this.ctx || !this.masterGain || !this.ctx.createStereoPanner) return;
    const value = Math.max(-1, Math.min(1, Number(pan) || 0));
    if (!gain._notenotesPanner) {
      try { gain.disconnect(this.masterGain); } catch (_) {}
      gain._notenotesPanner = this.ctx.createStereoPanner();
      gain.connect(gain._notenotesPanner);
      gain._notenotesPanner.connect(this.masterGain);
    }
    gain._notenotesPanner.pan.setTargetAtTime(value, this.currentTime, 0.01);
  }
}
