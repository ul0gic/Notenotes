/**
 * ModulationManager — Pitch bend and modulation control.
 * Bound to number keys 1-9 and controller analog sticks.
 */

import { AudioEngine } from './AudioEngine.js';

export class ModulationManager {
  constructor(synth) {
    this._synth = synth;
    this._pitchBend = 0;
    this._modulation = 0;
    this._onChange = null;
  }

  set onChange(fn) { this._onChange = fn; }

  get pitchBend() { return this._pitchBend; }
  get modulation() { return this._modulation; }

  get pitchPercent() { return Math.round(this._pitchBend * 100); }
  get modPercent() { return Math.round(this._modulation * 100); }

  setPitchBend(value) {
    this._pitchBend = Math.max(-1, Math.min(1, value));
    this._applyBend();
    if (this._onChange) this._onChange();
  }

  setModulation(value) {
    this._modulation = Math.max(0, Math.min(2, value));
    this._applyMod();
    if (this._onChange) this._onChange();
  }

  resetAll() {
    this.setPitchBend(0);
    this.setModulation(0);
    this._pitchRamp = 0;
    this._modRamp = 0;
  }

  handleKeyDown(key) {
    switch (key) {
      case '1': case 'Numpad1': this._modRamp = -0.02; break;
      case '3': case 'Numpad3': this._pitchRamp = -0.02; break;
      case '4': case 'Numpad4': this._modRamp = 0; this.setModulation(0); break;
      case '6': case 'Numpad6': this._pitchRamp = 0; this.setPitchBend(0); break;
      case '7': case 'Numpad7': this._modRamp = 0.02; break;
      case '9': case 'Numpad9': this._pitchRamp = 0.02; break;
    }
  }

  handleKeyUp(key) {
    switch (key) {
      case '1': case 'Numpad1': this._modRamp = 0; break;
      case '3': case 'Numpad3': this._pitchRamp = 0; break;
      case '7': case 'Numpad7': this._modRamp = 0; break;
      case '9': case 'Numpad9': this._pitchRamp = 0; break;
    }
  }

  startRamp() {
    if (this._rampTimer) return;
    this._pitchRamp = 0;
    this._modRamp = 0;
    this._rampTimer = setInterval(() => {
      if (this._pitchRamp) this.setPitchBend(this._pitchBend + this._pitchRamp);
      if (this._modRamp) this.setModulation(this._modulation + this._modRamp);
    }, 30);
  }

  stopRamp() {
    if (this._rampTimer) { clearInterval(this._rampTimer); this._rampTimer = null; }
  }

  _now() {
    return AudioEngine.getInstance().ctx?.currentTime || 0;
  }

  _applyBend() {
    const voices = this._synth?._voices;
    if (!voices || voices.size === 0) return;
    const bendCents = this._pitchBend * 200;
    const t = this._now();
    for (const [, voice] of voices) {
      if (voice.osc?.detune) {
        try { voice.osc.detune.setTargetAtTime(bendCents, t, 0.02); } catch (e) {}
      }
    }
  }

  _applyMod() {
    const voices = this._synth?._voices;
    if (!voices || voices.size === 0) return;
    const t = this._now();
    const freq = 400 + (this._modulation / 2) * 7600;
    for (const [, voice] of voices) {
      if (voice.filter?.frequency) {
        try { voice.filter.frequency.setTargetAtTime(freq, t, 0.05); } catch (e) {}
      }
    }
  }
}
