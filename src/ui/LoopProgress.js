/**
 * LoopProgress — Visual loop progress bar.
 * Thin animated bar showing current position within the loop.
 */

import { TransportState } from '../engine/Transport.js';

export class LoopProgress {
  /**
   * @param {Transport} transport
   */
  constructor(transport) {
    this.transport = transport;
    this.el = null;
    this._bar = null;
    this._animFrame = null;
    this._running = false;
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'loop-progress';
    this.el.id = 'loop-progress';
    this.el.innerHTML = `<div class="loop-progress__bar" id="loop-progress-bar"></div>`;
    this._bar = this.el.querySelector('#loop-progress-bar');

    // Start/stop animation based on transport state
    this.transport.onStateChange((state) => {
      if (state === TransportState.STOPPED) {
        this._stop();
      } else {
        this._start();
      }
    });

    return this.el;
  }

  _start() {
    if (this._running) return;
    this._running = true;
    this._animate();
  }

  _stop() {
    this._running = false;
    if (this._animFrame) {
      cancelAnimationFrame(this._animFrame);
      this._animFrame = null;
    }
    if (this._bar) {
      this._bar.style.width = '0%';
    }
  }

  _animate() {
    if (!this._running) return;

    const tick = this.transport.currentTick;
    const loopStart = this.transport.loopStartTick;
    const loopEnd = this.transport.loopEndTick;
    const loopLength = loopEnd - loopStart;

    if (loopLength > 0) {
      const relative = (tick - loopStart) % loopLength;
      const progress = (relative / loopLength) * 100;
      this._bar.style.width = `${Math.min(100, Math.max(0, progress))}%`;

      // Color change when recording
      const isRecording = this.transport.state === TransportState.RECORDING;
      this._bar.classList.toggle('is-recording', isRecording);
    }

    this._animFrame = requestAnimationFrame(() => this._animate());
  }
}
