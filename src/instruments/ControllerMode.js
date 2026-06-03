/**
 * ControllerMode - Labs home for the tabbed Controller setup surface and the
 * runtime gamepad state. The visible Labs panel uses a small tab strip so
 * future labs (accessibility helpers, AI Seed settings, custom instrument
 * editor) can share the same Labs space without rendering everything at once.
 * Each tab's runtime state continues to function when its tab is not active:
 * modifier slot assignments, gamepad polling, and accessibility helpers all
 * read from their own data sources independent of the rendered DOM.
 *
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

const ACTIVE_TAB_STORAGE_KEY = 'notenotes.labs.activeTab';

// Labs tab registry. Order matters: the first entry is the default active
// tab, and the visible pill order in the tab strip follows this array.
//
// Schema:
//   id      - stable identifier; used as the data-tab attribute, the local
//             storage value, and the `ct-tab-<id>` element id.
//   label   - human-readable tab name. Not rendered as visible text on the
//             tab button (tabs are blank pills); used as the aria-label,
//             title attribute, and the panel placeholder's "Future: <label>"
//             tooltip on disabled tabs.
//   enabled - true = interactive, false = disabled placeholder. Disabled
//             tabs render a generic "Future" card and do not show their
//             specific identity in the panel.
//   body    - HTML for the description card shown at the top of an enabled
//             tab's panel. Only the Controller tab ships a body in this
//             slice; future enabled tabs should add their own.
//
// To add a new tab, append an entry here with enabled: false, then flip
// to true when the lab is ready. _renderActiveTabBody() handles the
// enabled-vs-disabled branch generically.
const TABS = [
  {
    id: 'controller',
    label: 'Controller',
    enabled: true,
    body: 'Assign held note modifiers to the four shoulder and trigger slots. Use the <strong>Controller</strong> button in the upper app toolbar to learn gamepad bindings and manage presets.',
  },
  {
    id: 'dynamics',
    label: 'Dynamics',
    enabled: true,
    body: 'Height Velocity (experimental). Split each pad and piano key into four height zones so where you strike sets how loud it plays. Off by default — existing instruments are unchanged until you turn it on.',
  },
  {
    id: 'accessibility',
    label: 'Accessibility',
    enabled: false,
  },
  {
    id: 'seed',
    label: 'Seed',
    enabled: false,
  },
  {
    id: 'custom',
    label: 'Custom',
    enabled: false,
  },
];

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
    this.onLabsChanged = null;           // Labs (Height Velocity) toggle -> autosave

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

    this._activeTab = this._loadActiveTab();
  }

  set project(p) {
    this._project = p;
    this.setProjectKey(p?.musicalContext);
    this._controllerModifierAssignments();
    this._syncModifierSelects();
    if (this._activeTab === 'controller') {
      this._updateModifierHelp();
      this._updateModifierStatus();
    }
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

    // The visible Labs layout is intentionally minimal:
    //   1. A single "Labs" title card (no active tab name in the header).
    //   2. A row of blank tab pills (no visible text on the pills).
    //   3. A single panel that shows the active tab's body.
    // Tab identity lives in the panel content and the pills' aria-label /
    // title attributes, not in the visible header.
    this.el.innerHTML = `
      <header class="ctrlmode__header">
        <h2 class="ctrlmode__title">Labs</h2>
      </header>
      <nav class="ctrlmode__tabs" role="tablist" aria-label="Labs sections">
        ${TABS.map(t => this._renderTabButton(t)).join('')}
      </nav>
      <section class="ctrlmode__panel" id="ct-tab-panel" role="tabpanel" aria-labelledby="ct-tab-${this._escapeHtml(this._activeTab)}">
        ${this._renderActiveTabBody()}
      </section>
    `;

    this._bindEvents();
    // Only attach gamepad input when the Controller tab is the active tab
    // at render time. _attachGamepadInput() is idempotent (it short-circuits
    // when already subscribed), so background polling does not double-bind
    // when the user returns to the Controller tab via _setActiveTab().
    if (this._activeTab === 'controller') {
      this._updateModifierHelp();
      this._attachGamepadInput();
    }

    return this.el;
  }

  // Renders a tab button as a BLANK PILL — no visible text. The active tab
  // is filled with the accent color, disabled tabs are outlined. The label
  // and "Future: <name>" tooltip live in the aria-label and title
  // attributes only, so the visible tab strip is a quiet row of markers
  // and the user identifies the active tab by position and color.
  _renderTabButton(tab) {
    const isActive = tab.id === this._activeTab;
    const classes = ['ctrlmode__tab'];
    if (isActive) classes.push('is-active');
    if (!tab.enabled) classes.push('is-disabled');

    // Disabled tabs get a "Future:" prefix on the tooltip so the user
    // understands the slot is a placeholder, not a broken button. The
    // visible card in the panel reinforces this with a "Future" title.
    const titleText = !tab.enabled ? `Future: ${tab.label}` : tab.label;
    const attrs = [
      `id="ct-tab-${tab.id}"`,
      'type="button"',
      'role="tab"',
      `aria-selected="${isActive ? 'true' : 'false'}"`,
      'aria-controls="ct-tab-panel"',
      `aria-label="${this._escapeHtml(titleText)}"`,
      `title="${this._escapeHtml(titleText)}"`,
      `data-tab="${tab.id}"`,
    ];
    if (!tab.enabled) {
      attrs.push('aria-disabled="true"');
      attrs.push('disabled');
    }

    return `<button class="${classes.join(' ')}" ${attrs.join(' ')}></button>`;
  }

  // Renders the body of the currently active tab. The disabled-tab branch
  // is generic: a single "Future" card with no per-tab identity in the
  // visible panel. Per-tab identity for disabled slots lives only in the
  // tab strip's aria-label and title attribute, which is why the
  // placeholder text is identical for all three disabled tabs.
  _renderActiveTabBody() {
    const tab = this._activeTabDef();
    if (!tab) return '';
    if (!tab.enabled) {
      return `
        <div class="ctrlmode__placeholder">
          <p class="ctrlmode__placeholder-title">Future</p>
          <p class="ctrlmode__placeholder-desc">This lab slot is reserved for a future Notenotes feature.</p>
        </div>
      `;
    }
    if (tab.id === 'controller') {
      return `
        <p class="ctrlmode__tab-content-desc">${tab.body}</p>
        <div class="ctrlmode__modifier-grid">
          ${MODIFIER_SLOTS.map(slot => this._renderModifierSelect(slot)).join('')}
        </div>
        <p class="ctrlmode__trigger-help" id="ct-trigger-help" aria-live="polite"></p>
        <p class="ctrlmode__trigger-status" id="ct-trigger-status" aria-live="polite"></p>
      `;
    }
    if (tab.id === 'dynamics') {
      const on = !!this._project?.settings?.labs?.heightVelocity;
      return `
        <p class="ctrlmode__tab-content-desc">${tab.body}</p>
        <label class="ctrlmode__toggle-row" style="display:flex;align-items:center;gap:10px;margin:10px 0;">
          <input type="checkbox" id="ct-height-velocity" ${on ? 'checked' : ''} />
          <span>Height Velocity</span>
        </label>
        <p class="ctrlmode__trigger-help">Strike higher on a pad or key for louder, lower for softer (four levels). Also available as the &ldquo;Velocity&rdquo; pad layout.</p>
      `;
    }
    return '';
  }

  _activeTabDef() {
    return TABS.find(t => t.id === this._activeTab) || TABS[0];
  }

  _setActiveTab(tabId) {
    const tab = TABS.find(t => t.id === tabId);
    if (!tab || !tab.enabled) return;
    if (tabId === this._activeTab) return;
    this._activeTab = tabId;
    this._saveActiveTab();

    // Update tab button states without rebuilding the strip. The header
    // title is intentionally not touched because it always says "Labs";
    // the active tab identity now lives in the filled pill and the
    // panel content, not in the header.
    this.el?.querySelectorAll('.ctrlmode__tab').forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    const panel = this.el?.querySelector('.ctrlmode__panel');
    if (panel) {
      panel.setAttribute('aria-labelledby', `ct-tab-${tabId}`);
      panel.innerHTML = this._renderActiveTabBody();
    }

    // When the user returns to the Controller tab, re-bind the modifier
    // slot pickers (their DOM nodes are recreated when the panel is
    // re-rendered) and refresh the help + status lines so the live
    // "Active: ..." indicator picks up the current modifier state.
    if (tabId === 'controller') {
      this._bindModifierEvents();
      this._updateModifierHelp();
      this._updateModifierStatus();
    }
    if (tabId === 'dynamics') {
      this._bindDynamicsEvents();
    }
  }

  _loadActiveTab() {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) : null;
      // Only restore enabled tabs. Flipping a stub to enabled: true later
      // should not auto-promote a stale saved value until the user actually
      // clicks that tab.
      if (saved && TABS.find(t => t.id === saved && t.enabled)) return saved;
    } catch (_) {
      // localStorage may be unavailable (private mode, locked-down iframes).
      // Falling through to the default keeps the constructor safe.
    }
    return 'controller';
  }

  _saveActiveTab() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, this._activeTab);
      }
    } catch (_) {
      // localStorage may refuse writes (quota, private mode, locked-down
      // iframes). The active tab is still correct in-memory for this
      // session; persistence is best-effort.
    }
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
    this.el.querySelectorAll('.ctrlmode__tab:not([disabled])').forEach((btn) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this._setActiveTab(btn.dataset.tab);
      });
    });
    this._bindModifierEvents();
    this._bindDynamicsEvents();
  }

  _bindDynamicsEvents() {
    const cb = this.el?.querySelector('#ct-height-velocity');
    if (!cb) return;
    cb.addEventListener('change', (e) => {
      if (!this._project) return;
      this._project.settings ||= {};
      this._project.settings.labs = { ...(this._project.settings.labs || {}), heightVelocity: e.target.checked };
      this.onLabsChanged?.();
      // Refresh pad + piano surfaces so the zones/gridlines apply immediately.
      window.dispatchEvent(new CustomEvent('settings-pads-changed'));
      window.dispatchEvent(new CustomEvent('settings-piano-changed'));
    });
  }

  _bindModifierEvents() {
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
