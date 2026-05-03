/**
 * MicroPiano — Condensed 12-key (1 octave) chromatic piano.
 * Designed for quick chromatic ideas on small touchscreens.
 */

import { midiToNoteName, NOTE_NAMES } from '../engine/MusicTheory.js';

export class MicroPiano {
  /**
   * @param {WebAudioSynth} synth
   */
  constructor(synth) {
    this.synth = synth;
    this.el = null;
    this.octave = 4;
    this._activeKeys = new Set();

    this._onNoteOn = null;
    this._onNoteOff = null;
  }

  setNoteCallbacks(onNoteOn, onNoteOff) {
    this._onNoteOn = onNoteOn;
    this._onNoteOff = onNoteOff;
  }

  /** Get the 12 MIDI notes for the current octave */
  get _notes() {
    const base = (this.octave + 1) * 12;
    return Array.from({ length: 12 }, (_, i) => base + i);
  }

  /**
   * Render the piano UI.
   * @returns {HTMLElement}
   */
  render() {
    this.el = document.createElement('div');
    this.el.className = 'micropiano';
    this.el.id = 'micropiano';

    this.el.innerHTML = `
      <div class="micropiano__controls">
        <button class="btn btn--icon btn--ghost" id="mp-oct-down" aria-label="Octave down">▼</button>
        <span class="micropiano__oct-display" id="mp-oct-display">Oct ${this.octave}</span>
        <button class="btn btn--icon btn--ghost" id="mp-oct-up" aria-label="Octave up">▲</button>
      </div>
      <div class="micropiano__keyboard" id="mp-keyboard">
        ${this._renderKeys()}
      </div>
    `;

    this._bindEvents();
    return this.el;
  }

  _renderKeys() {
    // White and black key pattern for one octave
    const keyPattern = [
      { white: true,  name: 'C' },
      { white: false, name: 'C#' },
      { white: true,  name: 'D' },
      { white: false, name: 'D#' },
      { white: true,  name: 'E' },
      { white: true,  name: 'F' },
      { white: false, name: 'F#' },
      { white: true,  name: 'G' },
      { white: false, name: 'G#' },
      { white: true,  name: 'A' },
      { white: false, name: 'A#' },
      { white: true,  name: 'B' },
    ];

    const notes = this._notes;
    return keyPattern.map((key, i) => {
      const midi = notes[i];
      const cls = key.white ? 'micropiano__key--white' : 'micropiano__key--black';
      return `<button class="micropiano__key ${cls}" data-midi="${midi}" data-index="${i}"
                aria-label="${key.name}${this.octave}">
                <span class="micropiano__key-label">${key.name}</span>
              </button>`;
    }).join('');
  }

  _refreshKeys() {
    const kb = this.el.querySelector('#mp-keyboard');
    kb.innerHTML = this._renderKeys();
    this._bindKeyEvents();
  }

  _bindEvents() {
    // Octave controls
    this.el.querySelector('#mp-oct-down').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.octave > 2) {
        this.octave--;
        this.el.querySelector('#mp-oct-display').textContent = `Oct ${this.octave}`;
        this._refreshKeys();
      }
    });

    this.el.querySelector('#mp-oct-up').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.octave < 6) {
        this.octave++;
        this.el.querySelector('#mp-oct-display').textContent = `Oct ${this.octave}`;
        this._refreshKeys();
      }
    });

    this._bindKeyEvents();
  }

  _bindKeyEvents() {
    const keys = this.el.querySelectorAll('.micropiano__key');
    keys.forEach(key => {
      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        key.setPointerCapture(e.pointerId);
        const midi = parseInt(key.dataset.midi, 10);
        this.synth.noteOn(midi);
        key.classList.add('is-active');
        this._activeKeys.add(midi);
        if (this._onNoteOn) this._onNoteOn(midi, 0.8);
      });

      key.addEventListener('pointerup', (e) => {
        e.preventDefault();
        const midi = parseInt(key.dataset.midi, 10);
        this.synth.noteOff(midi);
        key.classList.remove('is-active');
        this._activeKeys.delete(midi);
        if (this._onNoteOff) this._onNoteOff(midi);
      });

      key.addEventListener('pointercancel', () => {
        const midi = parseInt(key.dataset.midi, 10);
        this.synth.noteOff(midi);
        key.classList.remove('is-active');
        this._activeKeys.delete(midi);
        if (this._onNoteOff) this._onNoteOff(midi);
      });
    });
  }
}
