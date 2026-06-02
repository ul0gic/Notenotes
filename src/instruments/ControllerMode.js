/**
 * ControllerMode - Labs home for global gamepad state and modifier slots.
 * Face buttons / D-pad can be learned globally; shoulders and triggers are
 * held musical modifiers; sticks stay continuous pitch/mod controls.
 */

import { getScaleNotes, normalizeMusicalContext, SCALES } from '../engine/MusicTheory.js';
import { normalizeSoundTraits } from './WebAudioSynth.js';
import {
  CONTROLLER_NOTE_MODIFIERS,
  controllerModifierLabel,
  controllerModifierPickerGroups,
  normalizeControllerModifier,
} from '../engine/ControllerModifiers.js';
import { ChoicePicker } from '../ui/ChoicePicker.js';

const MODIFIER_SLOTS = [
  { key: 'leftBumper', short: 'LB', label: 'Left bumper', buttonIndex: 4, defaultValue: 'octaveDown' },
  { key: 'leftTrigger', short: 'LT', label: 'Left trigger', buttonIndex: 6, defaultValue: 'none' },
  { key: 'rightBumper', short: 'RB', label: 'Right bumper', buttonIndex: 5, defaultValue: 'octaveUp' },
  { key: 'rightTrigger', short: 'RT', label: 'Right trigger', buttonIndex: 7, defaultValue: 'none' },
];

const SLOT_BY_KEY = Object.fromEntries(MODIFIER_SLOTS.map(slot => [slot.key, slot]));

export class ControllerMode {
  constructor(synth, project, modManager, gamepadInput = null) {
    this.synth = synth;
    this._project = project;
    this._modManager = modManager;
    this._gamepadInput = gamepadInput;
    this.el = null;
    this._activeMidis = new Map();
    this._activePadNotes = new Map();
    this._onNoteOn = null;
    this._onNoteOff = null;
    this._onBeforeNoteOn = null;
    this.onToneAssignmentChanged = null; // kept for CreativeMode save wiring
    this.onToneOverrideChanged = null;   // kept for active modifier indicator wiring

    this.scaleName = 'major';
    this.rootNote = 'C';
    this.octave = 4;
    this.padMode = 'single';
    this._notes = [];
    this._fullScaleNotes = [];

    this._modifierValues = {
      leftBumper: 0,
      leftTrigger: 0,
      rightBumper: 0,
      rightTrigger: 0,
    };
    this._inputUnsubscribers = [];
    this._pitchBend = 0;
    this._modulation = 0;
  }

  set project(p) {
    this._project = p;
    this.setProjectKey(p?.musicalContext);
    this._controllerModifierAssignments();
    this._syncModifierSelects();
    this._updateModifierHelp();
    this._updateModifierStatus();
  }
  get project() { return this._project; }

  setProjectKey(context) {
    const next = normalizeMusicalContext(context);
    this.rootNote = next.root;
    this.scaleName = next.scale;
    this._updateNotes();
  }

  setNoteCallbacks(onNoteOn, onNoteOff) {
    this._onNoteOn = onNoteOn;
    this._onNoteOff = onNoteOff;
  }

  setBeforeNoteCallback(fn) {
    this._onBeforeNoteOn = fn;
  }

  _updateNotes() {
    this._fullScaleNotes = getScaleNotes(this.scaleName, this.rootNote, this.octave);
    const scaleDef = SCALES[this.scaleName];
    const count = scaleDef ? scaleDef.intervals.length : 7;
    this._notes = this._fullScaleNotes.slice(0, count);
  }

  _getChordMidis(startIndex) {
    const maxIdx = this._fullScaleNotes.length - 1;
    return [
      this._fullScaleNotes[startIndex],
      this._fullScaleNotes[Math.min(startIndex + 2, maxIdx)],
      this._fullScaleNotes[Math.min(startIndex + 4, maxIdx)],
    ].filter(Number.isFinite);
  }

  render() {
    this._updateNotes();

    this.el = document.createElement('div');
    this.el.className = 'controller-mode';
    this.el.id = 'controller-mode';

    this.el.innerHTML = `
      <header class="ctrlmode__header">
        <span class="ctrlmode__eyebrow">Labs</span>
        <h2 class="ctrlmode__title">Controller</h2>
        <p class="ctrlmode__lede">Assign held note modifiers to the four shoulder and trigger slots. Use the <strong>Controller</strong> button in the upper app toolbar to learn gamepad bindings and manage presets.</p>
      </header>
      <section class="ctrlmode__section ctrlmode__modifiers-section" aria-label="Controller modifier assignments">
        <div class="ctrlmode__modifier-grid">
          ${MODIFIER_SLOTS.map(slot => this._renderModifierSelect(slot)).join('')}
        </div>
        <p class="ctrlmode__trigger-help" id="ct-trigger-help" aria-live="polite"></p>
        <p class="ctrlmode__trigger-status" id="ct-trigger-status" aria-live="polite"></p>
      </section>
    `;

    this._bindEvents();
    this._updateModifierHelp();
    this._attachGamepadInput();

    return this.el;
  }

  _renderModifierSelect(slot) {
    const value = this._controllerModifierAssignments()[slot.key] || slot.defaultValue;
    return `
      <label class="ctrlmode__modifier-select">
        <span>${slot.short}</span>
        <small>${slot.label}</small>
        <button class="choice-picker-button ctrlmode__modifier-button" id="ct-mod-${slot.key}" type="button" aria-label="${slot.label} modifier" aria-haspopup="dialog" data-modifier-slot="${slot.key}">
          <span class="choice-picker-button__label">${this._escapeHtml(controllerModifierLabel(value))}</span>
          <span class="choice-picker-button__chevron" aria-hidden="true">▼</span>
        </button>
      </label>
    `;
  }

  _bindEvents() {
    MODIFIER_SLOTS.forEach(slot => {
      this.el.querySelector(`#ct-mod-${slot.key}`)?.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._openModifierPicker(slot, e.currentTarget);
      });
    });
    this._syncModifierSelects();
  }

  _openModifierPicker(slot, anchor) {
    const assignments = this._controllerModifierAssignments();
    const picker = new ChoicePicker({
      title: `${slot.short} modifier`,
      groups: controllerModifierPickerGroups(),
      selectedValue: assignments[slot.key] || slot.defaultValue,
      searchPlaceholder: 'Search modifiers...',
      onSelect: (value) => this._setModifierAssignment(slot.key, value),
    });
    picker.open(anchor);
  }

  shiftOctave(delta) {
    const next = Math.max(1, Math.min(6, this.octave + delta));
    if (next === this.octave) return;
    this.octave = next;
    this._releaseAllNotes();
    this._updateNotes();
    // The visible Labs panel no longer renders the octave label; this method
    // exists for CreativeMode's keyboard octave-shift behavior when the user
    // is on the Labs tab. Kept so fallback button routing tracks the latest
    // octave the user asked for.
  }

  _releaseAllNotes() {
    for (const [midi] of this._activeMidis) {
      this.synth.noteOff(midi);
      if (this._onNoteOff) this._onNoteOff(midi);
    }
    this._activeMidis.clear();
    this._activePadNotes.clear();
  }

  _attachGamepadInput() {
    if (!this._gamepadInput || this._inputUnsubscribers.length) return;
    // The Labs Controller panel only displays the four modifier slot pickers,
    // so it does not render the gamepad status string. The Controller popover
    // (ControllerMapperPopover) is the surface that shows connection state.
    this._inputUnsubscribers = [
      this._gamepadInput.on('triggers', ({ buttons, axes }) => this._mapModifierControls(buttons, axes)),
      this._gamepadInput.on('axes', ({ axes }) => this._mapAxes(axes)),
    ];
  }

  handleFallbackButtonDown(idx) {
    const map = { 12: 0, 13: 1, 14: 2, 15: 3, 0: 4, 1: 5, 2: 6, 3: 0 };
    const deg = map[idx];
    if (deg !== undefined && deg >= 0 && deg < this._notes.length) this._triggerPad(deg);
  }

  handleFallbackButtonUp(idx) {
    const map = { 12: 0, 13: 1, 14: 2, 15: 3, 0: 4, 1: 5, 2: 6, 3: 0 };
    const deg = map[idx];
    if (deg !== undefined && deg >= 0 && deg < this._notes.length) this._releasePad(deg);
  }

  refreshBindings() {
    // No-op: the visible Labs panel no longer renders the bindings list.
    // The Controller popover (ControllerMapperPopover) is the surface where
    // bindings are created, edited, and cleared. The runtime gamepad routes
    // still read project.settings.controllerBindings directly.
  }

  _controllerModifierAssignments() {
    if (!this.project?.settings) return this._defaultModifierAssignments();
    const settings = this.project.settings;
    if (!settings.controllerModifierAssignments) {
      const legacy = settings.controllerToneAssignments || {};
      settings.controllerModifierAssignments = {
        leftBumper: 'octaveDown',
        leftTrigger: this._normalizeModifierAssignment(legacy.leftTrigger),
        rightBumper: 'octaveUp',
        rightTrigger: this._normalizeModifierAssignment(legacy.rightTrigger),
      };
    }

    const assignments = settings.controllerModifierAssignments;
    MODIFIER_SLOTS.forEach(slot => {
      assignments[slot.key] = this._normalizeModifierAssignment(assignments[slot.key] ?? slot.defaultValue);
    });
    return assignments;
  }

  _defaultModifierAssignments() {
    return Object.fromEntries(MODIFIER_SLOTS.map(slot => [slot.key, slot.defaultValue]));
  }

  _normalizeModifierAssignment(value) {
    return normalizeControllerModifier(value);
  }

  _syncModifierSelects() {
    const assignments = this._controllerModifierAssignments();
    MODIFIER_SLOTS.forEach(slot => {
      const button = this.el?.querySelector(`#ct-mod-${slot.key}`);
      const label = button?.querySelector('.choice-picker-button__label');
      if (label) label.textContent = controllerModifierLabel(assignments[slot.key] || slot.defaultValue);
    });
  }

  _setModifierAssignment(key, value) {
    if (!SLOT_BY_KEY[key]) return;
    const assignments = this._controllerModifierAssignments();
    assignments[key] = this._normalizeModifierAssignment(value);
    this._syncModifierSelects();
    this._updateModifierHelp();
    this._notifyModifierState();
    if (this.onToneAssignmentChanged) this.onToneAssignmentChanged(assignments);
    window.dispatchEvent(new CustomEvent('project-controller-modifier-assignments-changed', { detail: { assignments } }));
  }

  currentSoundTraits(baseTraits = null) {
    return normalizeSoundTraits(baseTraits || this.project?.settings?.soundTraits || {});
  }

  activeTriggerLabels() {
    return this._activeModifierEntries()
      .map(([key, fallback, assignment]) => this._modifierSlotLabel(key, fallback, assignment));
  }

  _activeModifierEntries() {
    const assignments = this._controllerModifierAssignments();
    return MODIFIER_SLOTS
      .map(slot => [slot.key, slot.short, assignments[slot.key]])
      .filter(([key, , value]) => this._modifierValues[key] > 0.02 && value && value !== 'none');
  }

  _activeControllerModifiers() {
    return this._activeModifierEntries()
      .map(([, , value]) => CONTROLLER_NOTE_MODIFIERS[value])
      .filter(Boolean);
  }

  _modifierSlotLabel(key, fallback, assignment = null) {
    const value = assignment || this._controllerModifierAssignments()[key];
    const modifier = CONTROLLER_NOTE_MODIFIERS[value];
    return modifier ? `${fallback} ${modifier.shortName || modifier.name}` : fallback;
  }

  hasActiveNoteModifiers() {
    return this._activeControllerModifiers().length > 0;
  }

  modifiedMidisForRoot(rootMidi) {
    const active = this._activeControllerModifiers();
    if (!active.length || !Number.isFinite(rootMidi)) return null;
    const midis = [];
    active.forEach(modifier => {
      this._midisForModifier(rootMidi, modifier).forEach(midi => {
        if (Number.isFinite(midi) && !midis.includes(midi)) midis.push(midi);
      });
    });
    return midis.length ? midis : null;
  }

  _midisForModifier(rootMidi, modifier) {
    if (modifier.scaleOffsets) {
      const scaleNotes = getScaleNotes(this.scaleName, this.rootNote, 0, 96);
      const scaleIndex = scaleNotes.findIndex(midi => midi === rootMidi);
      if (scaleIndex >= 0) {
        return modifier.scaleOffsets
          .map(offset => scaleNotes[scaleIndex + offset])
          .filter(Number.isFinite);
      }
      return (modifier.intervalFallback || []).map(offset => rootMidi + offset);
    }
    return (modifier.intervalOffsets || []).map(offset => rootMidi + offset);
  }

  _mapModifierControls(buttons, axes = []) {
    const next = {
      leftBumper: buttons[4]?.pressed ? 1 : 0,
      rightBumper: buttons[5]?.pressed ? 1 : 0,
      leftTrigger: this._triggerValue(buttons[6], axes[4]),
      rightTrigger: this._triggerValue(buttons[7], axes[5]),
    };
    let changed = false;
    for (const [key, value] of Object.entries(next)) {
      if (Math.abs(value - this._modifierValues[key]) > 0.02) {
        this._modifierValues[key] = value;
        changed = true;
      }
    }
    if (changed) this._notifyModifierState();
    this._updateModifierStatus();
  }

  _triggerValue(button, axisValue) {
    if (button?.pressed) return 1;
    if (typeof button?.value === 'number' && button.value > 0.02) return Math.max(0, Math.min(1, button.value));
    if (typeof axisValue === 'number') {
      const normalized = axisValue < 0 ? (axisValue + 1) / 2 : axisValue;
      return Math.max(0, Math.min(1, normalized));
    }
    return 0;
  }

  _notifyModifierState() {
    if (this.onToneOverrideChanged) {
      this.onToneOverrideChanged(this.currentSoundTraits(), this.activeTriggerLabels());
    }
    this._updateModifierStatus();
  }

  _updateModifierStatus() {
    const status = this.el?.querySelector('#ct-trigger-status');
    if (!status) return;
    const labels = this.activeTriggerLabels();
    status.textContent = labels.length ? `Active: ${labels.join(' + ')}` : '';
    status.classList.toggle('is-active', labels.length > 0);
  }

  _updateModifierHelp() {
    const help = this.el?.querySelector('#ct-trigger-help');
    if (!help) return;
    const assignments = this._controllerModifierAssignments();
    const activeNames = MODIFIER_SLOTS
      .map(slot => `${slot.short}: ${controllerModifierLabel(assignments[slot.key])}`)
      .join(' / ');
    help.innerHTML = `<strong>Held modifiers:</strong> hold a shoulder or trigger before pressing a learned button, fallback button, pad, or key. ${this._escapeHtml(activeNames)}`;
    help.classList.add('is-active');
  }

  _triggerPad(deg) {
    const midi = this._notes[deg];
    if (!Number.isFinite(midi)) return;
    const modified = this.modifiedMidisForRoot(midi);
    const midis = modified || (this.padMode === 'chords' ? this._getChordMidis(deg) : [midi]);
    if (midis.some(m => this._activeMidis.has(m))) return;
    midis.forEach(m => {
      this._activeMidis.set(m, true);
      if (this._onBeforeNoteOn) this._onBeforeNoteOn();
      this.synth.noteOn(m, 0.8);
      if (this._onNoteOn) this._onNoteOn(m, 0.8);
    });
    this._activePadNotes.set(deg, midis);
  }

  _releasePad(deg) {
    const midi = this._notes[deg];
    if (!Number.isFinite(midi)) return;
    const midis = this._activePadNotes.get(deg) || [midi];
    midis.forEach(m => {
      this._activeMidis.delete(m);
      this.synth.noteOff(m);
      if (this._onNoteOff) this._onNoteOff(m);
    });
    this._activePadNotes.delete(deg);
  }

  _mapAxes(axes) {
    if (axes.length < 4) return;
    const deadZone = 0.1;
    let ry = axes[3];
    let ly = -axes[1];

    if (Math.abs(ry) < deadZone) ry = 0;
    if (Math.abs(ly) < deadZone) ly = 0;

    const pitch = Math.round(ry * 100) / 100;
    const mod = ly < 0 ? Math.round(Math.abs(ly) * 200) / 100 : Math.round(ly * 100) / 100;

    if (pitch !== this._pitchBend || mod !== this._modulation) {
      this._pitchBend = pitch;
      this._modulation = mod;
      if (this._modManager) {
        this._modManager.setPitchBend(pitch);
        this._modManager.setModulation(mod);
      }
    }
  }

  _escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
