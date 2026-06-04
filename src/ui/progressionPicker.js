/**
 * Progression picker — shared between the top bar and the Labs > Sound tab.
 *
 * Extracted from TransportBar so both surfaces can offer "Changes" without
 * duplicating the ChoicePicker plumbing or the off/preset normalization. The
 * top bar keeps the Suggest popover (which reads the current progression's
 * label to frame its intro line), so this module also re-exports
 * progressionButtonLabel for that one consumer.
 */

import { ChoicePicker } from './ChoicePicker.js';
import {
  progressionChoiceGroups,
  progressionLabel,
  progressionPreset,
  normalizeProgressionContext,
} from '../engine/Progressions.js';

export function progressionButtonLabel(value = {}) {
  return `Changes: ${progressionLabel(value)}`;
}

export function openProgressionPicker(anchor, {
  projectKey,
  currentProgression,
  onSelect,
} = {}) {
  if (!anchor) return;
  const picker = new ChoicePicker({
    title: 'Choose Changes',
    groups: progressionChoiceGroups(projectKey),
    selectedValue: currentProgression?.enabled ? currentProgression.id : 'off',
    searchPlaceholder: 'Search changes...',
    onSelect: (value) => {
      const next = value === 'off'
        ? normalizeProgressionContext()
        : normalizeProgressionContext(progressionPreset(value));
      onSelect?.(next);
    },
  });
  picker.open(anchor);
}
