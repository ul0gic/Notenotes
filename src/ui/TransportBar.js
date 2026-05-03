/**
 * TransportBar — UI component for the top transport controls.
 * Play/Pause, Stop, Record, BPM, Metronome, Beat Indicator, Loop controls.
 */

import { TransportState } from '../engine/Transport.js';

export class TransportBar {
  /**
   * @param {Transport} transport
   * @param {Metronome} metronome
   */
  constructor(transport, metronome) {
    this.transport = transport;
    this.metronome = metronome;
    this.el = null;
    this._beatDots = [];
    this.onSettingsClick = null;
  }

  /**
   * Render the transport bar and return the DOM element.
   * @returns {HTMLElement}
   */
  render() {
    this.el = document.createElement('div');
    this.el.className = 'transport-bar';
    this.el.id = 'transport-bar';

    this.el.innerHTML = `
      <div class="transport-bar__section">
        <button class="btn btn--icon" id="btn-stop" title="Stop" aria-label="Stop">
          <svg width="18" height="18" viewBox="0 0 18 18"><rect x="3" y="3" width="12" height="12" rx="2" fill="currentColor"/></svg>
        </button>
        <button class="btn btn--icon" id="btn-play" title="Play / Pause" aria-label="Play or Pause">
          <svg width="18" height="18" viewBox="0 0 18 18" id="play-icon">
            <polygon points="4,2 16,9 4,16" fill="currentColor"/>
          </svg>
        </button>
        <button class="btn btn--icon btn--record" id="btn-record" title="Record" aria-label="Record">
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="currentColor"/></svg>
        </button>
      </div>

      <div class="beat-indicator" id="beat-indicator">
        <div class="beat-indicator__dot" data-beat="0"></div>
        <div class="beat-indicator__dot" data-beat="1"></div>
        <div class="beat-indicator__dot" data-beat="2"></div>
        <div class="beat-indicator__dot" data-beat="3"></div>
      </div>

      <div class="transport-bar__bpm">
        <input type="number" id="bpm-input" value="${this.transport.bpm}" min="40" max="240" aria-label="BPM" />
        <span>BPM</span>
      </div>

      <div class="transport-bar__spacer"></div>

      <div class="transport-bar__section">
        <div class="metronome-toggle" id="metronome-toggle">
          <button class="btn btn--icon btn--ghost" id="btn-metronome" title="Metronome" aria-label="Toggle metronome">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L6 22h12L12 2z"/>
              <line x1="12" y1="8" x2="16" y2="4"/>
            </svg>
          </button>
        </div>
        <button class="btn btn--icon btn--ghost" id="btn-settings" title="Settings" aria-label="Open settings" style="margin-left:4px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    `;

    this._beatDots = this.el.querySelectorAll('.beat-indicator__dot');
    this._bindEvents();
    return this.el;
  }

  _bindEvents() {
    // Play/pause
    this.el.querySelector('#btn-play').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.transport.toggle();
    });

    // Stop
    this.el.querySelector('#btn-stop').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.transport.stop();
    });

    // Record
    this.el.querySelector('#btn-record').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.transport.state === TransportState.RECORDING) {
        this.transport.pause();
      } else {
        this.transport.record();
      }
    });

    // BPM input
    const bpmInput = this.el.querySelector('#bpm-input');
    bpmInput.addEventListener('change', () => {
      this.transport.bpm = parseInt(bpmInput.value, 10) || 120;
      bpmInput.value = this.transport.bpm;
    });

    // Metronome toggle
    this.el.querySelector('#btn-metronome').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const active = this.metronome.toggle();
      this.el.querySelector('#metronome-toggle').classList.toggle('is-active', active);
    });

    // Transport state changes → update play button icon
    this.transport.onStateChange((state) => {
      this._updatePlayButton(state);
      this._updateRecordButton(state);
    });

    // Beat events → update beat indicator
    this.transport.onBeat((beat) => {
      this._updateBeatIndicator(beat);
    });

    // On stop, clear beat indicator
    this.transport.onStateChange((state) => {
      if (state === TransportState.STOPPED) {
        this._clearBeatIndicator();
      }
    });

    // Settings button
    this.el.querySelector('#btn-settings')?.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.onSettingsClick) this.onSettingsClick();
    });
  }

  _updatePlayButton(state) {
    const btn = this.el.querySelector('#btn-play');
    const isPlaying = state === TransportState.PLAYING || state === TransportState.RECORDING;
    if (isPlaying) {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18">
        <rect x="3" y="2" width="4" height="14" rx="1" fill="currentColor"/>
        <rect x="11" y="2" width="4" height="14" rx="1" fill="currentColor"/>
      </svg>`;
    } else {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18">
        <polygon points="4,2 16,9 4,16" fill="currentColor"/>
      </svg>`;
    }
  }

  _updateRecordButton(state) {
    const btn = this.el.querySelector('#btn-record');
    btn.classList.toggle('is-active', state === TransportState.RECORDING);
  }

  _updateBeatIndicator(beat) {
    this._beatDots.forEach((dot, i) => {
      dot.classList.remove('is-active', 'is-accent');
      if (i === beat) {
        dot.classList.add(beat === 0 ? 'is-accent' : 'is-active');
      }
    });
  }

  _clearBeatIndicator() {
    this._beatDots.forEach(dot => {
      dot.classList.remove('is-active', 'is-accent');
    });
  }
}
