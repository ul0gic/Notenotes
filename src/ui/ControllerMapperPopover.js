import { BINDABLE_GAMEPAD_BUTTONS, gamepadButtonInfo } from '../engine/GamepadInputManager.js';
import { midiToNoteName } from '../engine/MusicTheory.js';
import { showToast } from './Toast.js';

export class ControllerMapperPopover {
  constructor({
    gamepadInput,
    getBindings,
    setBindings,
    getPresets,
    setPresets,
    onBindingsChanged,
  }) {
    this.gamepadInput = gamepadInput;
    this._getBindings = getBindings;
    this._setBindings = setBindings;
    this._getPresets = getPresets;
    this._setPresets = setPresets;
    this._onBindingsChanged = onBindingsChanged;
    this._popover = null;
    this._anchorButton = null;
    this._clickOutsideHandler = null;
    this._view = 'learn';
    this._learningButton = null;
  }

  open(anchor, buttonEl) {
    if (this._popover) {
      this.close();
      return;
    }
    this._view = 'learn';
    this._learningButton = null;
    const popover = document.createElement('div');
    popover.className = 'tone-popover controller-map-popover';
    popover.id = 'controller-map-popover';
    popover.innerHTML = this._render();
    anchor.appendChild(popover);
    buttonEl?.setAttribute('aria-expanded', 'true');
    this._popover = popover;
    this._anchorButton = buttonEl;
    this._bindEvents();
    this.refreshStatus();

    const handleOutside = (e) => {
      if (!this._popover) return;
      if (this._popover.contains(e.target)) return;
      if (buttonEl && buttonEl.contains(e.target)) return;
      if (this._learningButton !== null) return;
      this.close();
    };
    queueMicrotask(() => document.addEventListener('pointerdown', handleOutside, true));
    this._clickOutsideHandler = handleOutside;
  }

  close() {
    if (this._clickOutsideHandler) {
      document.removeEventListener('pointerdown', this._clickOutsideHandler, true);
      this._clickOutsideHandler = null;
    }
    this._popover?.remove();
    this._popover = null;
    this._learningButton = null;
    if (this._anchorButton) {
      this._anchorButton.setAttribute('aria-expanded', 'false');
      this._anchorButton = null;
    }
  }

  isOpen() {
    return !!this._popover;
  }

  refresh() {
    if (!this._popover) return;
    this._popover.innerHTML = this._render();
    this._bindEvents();
    this.refreshStatus();
  }

  refreshStatus() {
    const popover = this._popover;
    if (!popover || this._view !== 'learn' || this._learningButton !== null) return;
    const held = this.gamepadInput.heldBindableButton();
    const info = held === null ? null : gamepadButtonInfo(held);
    const status = popover.querySelector('#controller-map-status');
    if (status) status.innerHTML = `Currently holding: ${info ? `<strong>${escapeHtml(info.label)}</strong> (${escapeHtml(info.detail)})` : 'None'}`;
    const set = popover.querySelector('#controller-map-set');
    if (set) set.disabled = held === null;
  }

  handleLearnTarget(target) {
    if (this._learningButton === null || !target || !this._popover) return false;
    const index = String(this._learningButton);
    const button = gamepadButtonInfo(this._learningButton);
    const bindings = cloneControllerBindings(this._getBindings());
    const binding = normalizeControllerTarget(target);
    bindings[index] = binding;
    this._setBindings(bindings);
    this._learningButton = null;
    this._onBindingsChanged?.();
    this.refresh();
    showToast(`${button.short} to ${binding.label} bound`);
    return true;
  }

  _render() {
    if (this._view === 'list') return this._renderBindingList();
    const held = this.gamepadInput.heldBindableButton();
    const info = held === null ? null : gamepadButtonInfo(held);
    const learning = this._learningButton !== null ? gamepadButtonInfo(this._learningButton) : null;
    return `
      <div class="tone-popover__header">
        <span>Controller Mapper</span>
      </div>
      <div class="controller-map">
        <p class="controller-map__headline">${learning ? 'Now click any note, pad, or key' : 'Hold any button on your gamepad'}</p>
        <p class="controller-map__status" id="controller-map-status">
          Currently holding: ${info ? `<strong>${escapeHtml(info.label)}</strong> (${escapeHtml(info.detail)})` : 'None'}
        </p>
        <p class="controller-map__hint">${learning ? `${escapeHtml(learning.label)} is waiting for a sound target. The next Pads, Piano, or Kit press will bind instead of play.` : 'Shoulders, triggers, and analog sticks stay reserved for modifiers, pitch, and modulation.'}</p>
        <div class="controller-map__actions">
          <button class="btn btn--primary controller-map__set" id="controller-map-set" type="button" ${held === null ? 'disabled' : ''}>Set</button>
          <button class="btn btn--ghost" id="controller-map-list" type="button">List Current Bindings</button>
        </div>
      </div>
    `;
  }

  _renderBindingList() {
    const bindings = this._getBindings();
    const presets = this._getPresets();
    const entries = Object.entries(bindings).filter(([, binding]) => binding).sort(([a], [b]) => Number(a) - Number(b));
    return `
      <div class="tone-popover__header">
        <span>Controller Bindings</span>
      </div>
      <div class="controller-map controller-map--list">
        <div class="controller-map__preset-row">
          <select class="settings-select" id="controller-preset-select" aria-label="Controller binding preset">
            <option value="">Controller preset...</option>
            ${presets.map(preset => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name || 'Untitled preset')}</option>`).join('')}
          </select>
          <button class="btn btn--ghost btn--sm" id="controller-preset-load" type="button" ${presets.length ? '' : 'disabled'}>Load</button>
          <button class="btn btn--ghost btn--sm" id="controller-preset-save" type="button" ${entries.length ? '' : 'disabled'}>Save Current</button>
          <button class="btn btn--ghost btn--sm" id="controller-preset-delete" type="button" ${presets.length ? '' : 'disabled'}>Delete</button>
        </div>
        ${entries.length ? entries.map(([index, binding]) => {
          const info = gamepadButtonInfo(Number(index));
          return `
            <div class="controller-map__binding">
              <span class="controller-map__button">${escapeHtml(info.label)}</span>
              <span class="controller-map__arrow">to</span>
              <span class="controller-map__target">${escapeHtml(controllerTargetLabel(binding))}</span>
              <button class="btn btn--ghost btn--sm" data-controller-unbind="${index}" type="button">Unbind</button>
            </div>
          `;
        }).join('') : '<p class="controller-map__empty">No custom bindings yet. Unbound buttons use the fallback scale layout.</p>'}
        <div class="controller-map__actions">
          <button class="btn btn--ghost" id="controller-map-back" type="button">Back</button>
          <button class="btn btn--ghost" id="controller-map-clear-all" type="button" ${entries.length ? '' : 'disabled'}>Clear All Bindings</button>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    const popover = this._popover;
    if (!popover) return;
    popover.querySelector('#controller-map-set')?.addEventListener('click', (e) => {
      e.preventDefault();
      const held = this.gamepadInput.heldBindableButton();
      if (held === null || !BINDABLE_GAMEPAD_BUTTONS.has(held)) return;
      this._learningButton = held;
      this.refresh();
    });
    popover.querySelector('#controller-map-list')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._view = 'list';
      this._learningButton = null;
      this.refresh();
    });
    popover.querySelector('#controller-map-back')?.addEventListener('click', (e) => {
      e.preventDefault();
      this._view = 'learn';
      this.refresh();
    });
    popover.querySelector('#controller-map-clear-all')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (!window.confirm('Clear all controller bindings?')) return;
      this._setBindings({});
      this._onBindingsChanged?.();
      this.refresh();
      showToast('Controller bindings cleared');
    });
    popover.querySelector('#controller-preset-save')?.addEventListener('click', (e) => {
      e.preventDefault();
      const bindings = this._getBindings();
      if (!Object.keys(bindings).length) return;
      const name = window.prompt('Name this controller preset');
      if (!name?.trim()) return;
      const now = Date.now();
      this._setPresets([
        ...this._getPresets(),
        {
          id: `controller-preset-${now}`,
          name: name.trim(),
          bindings: cloneControllerBindings(bindings),
          createdAt: now,
          updatedAt: now,
        },
      ]);
      this._onBindingsChanged?.();
      this.refresh();
      showToast('Controller preset saved');
    });
    popover.querySelector('#controller-preset-load')?.addEventListener('click', (e) => {
      e.preventDefault();
      const presets = this._getPresets();
      const presetId = popover.querySelector('#controller-preset-select')?.value || presets[0]?.id;
      const preset = presets.find(item => item.id === presetId);
      if (!preset) return;
      this._setBindings(cloneControllerBindings(preset.bindings || {}));
      this._onBindingsChanged?.();
      this.refresh();
      showToast(`Controller preset loaded: ${preset.name}`);
    });
    popover.querySelector('#controller-preset-delete')?.addEventListener('click', (e) => {
      e.preventDefault();
      const presets = this._getPresets();
      const presetId = popover.querySelector('#controller-preset-select')?.value || presets[0]?.id;
      const preset = presets.find(item => item.id === presetId);
      if (!preset || !window.confirm(`Delete controller preset "${preset.name}"?`)) return;
      this._setPresets(presets.filter(item => item.id !== presetId));
      this._onBindingsChanged?.();
      this.refresh();
      showToast('Controller preset deleted');
    });
    popover.querySelectorAll('[data-controller-unbind]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const bindings = cloneControllerBindings(this._getBindings());
        delete bindings[btn.dataset.controllerUnbind];
        this._setBindings(bindings);
        this._onBindingsChanged?.();
        this.refresh();
        showToast('Controller binding cleared');
      });
    });
  }
}

export function normalizeControllerTarget(target) {
  if (target.type === 'drum') {
    return {
      type: 'drum',
      padId: target.padId,
      gmNote: target.gmNote || null,
      label: target.label || target.padId || 'Drum',
      source: target.source || 'kit',
    };
  }
  if (target.type === 'scalePad') {
    const padIndex = Number(target.padIndex);
    return {
      type: 'scalePad',
      padIndex,
      midi: Number.isFinite(target.midi) ? Number(target.midi) : null,
      padMode: target.padMode || null,
      padAction: target.padAction || null,
      label: target.label || controllerPadBindingName({ padIndex, padAction: target.padAction }),
      source: 'scale',
    };
  }
  return {
    type: 'midi',
    midi: Number(target.midi),
    label: target.label || midiToNoteName(Number(target.midi)).display,
    source: target.source || 'midi',
  };
}

export function cloneControllerBindings(bindings = {}) {
  return JSON.parse(JSON.stringify(bindings || {}));
}

export function controllerTargetLabel(binding) {
  if (binding?.type === 'drum') return binding.padId || 'Drum';
  if (binding?.type === 'scalePad' && Number.isFinite(binding.padIndex)) {
    return controllerPadBindingName(binding);
  }
  if (binding?.type === 'midi' && Number.isFinite(binding.midi)) return midiToNoteName(binding.midi).display;
  return 'Unknown';
}

export function controllerPadBindingName(binding = {}) {
  const index = Number(binding.padIndex);
  const action = binding.padAction || binding.padMode;
  const prefix = action === 'chord' || action === 'chords'
    ? 'Chord'
    : action === 'root'
      ? 'Root'
      : 'Pad';
  return `${prefix} ${Number.isFinite(index) ? index + 1 : '?'}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
