/**
 * ScaleBoard — 7-Pad scale-locked instrument.
 * Prevents wrong notes by locking pads to the selected scale.
 * Includes octave up/down toggles.
 */

import { getScaleNotes, midiToNoteName, SCALES, NOTE_NAMES } from '../engine/MusicTheory.js';

export class ScaleBoard {
  /**
   * @param {WebAudioSynth} synth - The synth engine to play through
   */
  constructor(synth) {
    this.synth = synth;
    this.el = null;

    // State
    this.scaleName = 'major';
    this.rootNote = 'C';
    this.octave = 4;
    this._notes = [];
    this._activePads = new Set();

    // Callbacks for note recording
    this._onNoteOn = null;
    this._onNoteOff = null;
  }

  /** Set callbacks for note events (used by recording system) */
  setNoteCallbacks(onNoteOn, onNoteOff) {
    this._onNoteOn = onNoteOn;
    this._onNoteOff = onNoteOff;
  }

  /** Recalculate scale notes */
  _updateNotes() {
    this._notes = getScaleNotes(this.scaleName, this.rootNote, this.octave);
    // For 7-pad layout, take only first 7 notes
    if (this._notes.length > 7) {
      this._notes = this._notes.slice(0, 7);
    }
  }

  /**
   * Render the Scale Board UI.
   * @returns {HTMLElement}
   */
  render() {
    this._updateNotes();

    this.el = document.createElement('div');
    this.el.className = 'scaleboard';
    this.el.id = 'scaleboard';

    this.el.innerHTML = `
      <div class="scaleboard__controls">
        <div class="scaleboard__control-group">
          <label class="scaleboard__label">Root</label>
          <select class="scaleboard__select" id="sb-root" aria-label="Root note">
            ${NOTE_NAMES.map(n => `<option value="${n}" ${n === this.rootNote ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        <div class="scaleboard__control-group">
          <label class="scaleboard__label">Scale</label>
          <select class="scaleboard__select" id="sb-scale" aria-label="Scale type">
            ${Object.entries(SCALES).filter(([k]) => k !== 'chromatic').map(([key, s]) =>
              `<option value="${key}" ${key === this.scaleName ? 'selected' : ''}>${s.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="scaleboard__octave">
          <button class="btn btn--icon btn--ghost scaleboard__oct-btn" id="sb-oct-down" aria-label="Octave down">▼</button>
          <span class="scaleboard__oct-display" id="sb-oct-display">Oct ${this.octave}</span>
          <button class="btn btn--icon btn--ghost scaleboard__oct-btn" id="sb-oct-up" aria-label="Octave up">▲</button>
        </div>
      </div>
      <div class="scaleboard__pads" id="sb-pads">
        ${this._renderPads()}
      </div>
    `;

    this._bindEvents();
    return this.el;
  }

  _renderPads() {
    return this._notes.map((midi, i) => {
      const noteInfo = midiToNoteName(midi);
      return `
        <button class="scaleboard__pad" data-index="${i}" data-midi="${midi}"
                aria-label="Scale degree ${i + 1}, ${noteInfo.display}">
          <span class="scaleboard__pad-degree">${i + 1}</span>
          <span class="scaleboard__pad-note">${noteInfo.display}</span>
        </button>
      `;
    }).join('');
  }

  _refreshPads() {
    this._updateNotes();
    const padsContainer = this.el.querySelector('#sb-pads');
    padsContainer.innerHTML = this._renderPads();
    this._bindPadEvents();
  }

  _bindEvents() {
    // Root note selector
    this.el.querySelector('#sb-root').addEventListener('change', (e) => {
      this.rootNote = e.target.value;
      this._refreshPads();
    });

    // Scale selector
    this.el.querySelector('#sb-scale').addEventListener('change', (e) => {
      this.scaleName = e.target.value;
      this._refreshPads();
    });

    // Octave controls
    this.el.querySelector('#sb-oct-down').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.octave > 2) {
        this.octave--;
        this.el.querySelector('#sb-oct-display').textContent = `Oct ${this.octave}`;
        this._refreshPads();
      }
    });

    this.el.querySelector('#sb-oct-up').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.octave < 6) {
        this.octave++;
        this.el.querySelector('#sb-oct-display').textContent = `Oct ${this.octave}`;
        this._refreshPads();
      }
    });

    this._bindPadEvents();
  }

  _bindPadEvents() {
    const pads = this.el.querySelectorAll('.scaleboard__pad');
    pads.forEach(pad => {
      // Pointer down → note on
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pad.setPointerCapture(e.pointerId);
        const midi = parseInt(pad.dataset.midi, 10);
        this.synth.noteOn(midi);
        pad.classList.add('is-active');
        this._activePads.add(midi);
        if (this._onNoteOn) this._onNoteOn(midi, 0.8);
      });

      // Pointer up → note off
      pad.addEventListener('pointerup', (e) => {
        e.preventDefault();
        const midi = parseInt(pad.dataset.midi, 10);
        this.synth.noteOff(midi);
        pad.classList.remove('is-active');
        this._activePads.delete(midi);
        if (this._onNoteOff) this._onNoteOff(midi);
      });

      // Pointer cancel/leave → note off
      pad.addEventListener('pointercancel', (e) => {
        const midi = parseInt(pad.dataset.midi, 10);
        this.synth.noteOff(midi);
        pad.classList.remove('is-active');
        this._activePads.delete(midi);
        if (this._onNoteOff) this._onNoteOff(midi);
      });
    });
  }
}
