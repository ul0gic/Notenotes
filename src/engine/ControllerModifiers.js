export const CONTROLLER_NOTE_MODIFIERS = {
  octaveDown: { id: 'octaveDown', name: 'Octave down', shortName: 'Oct -', intervalOffsets: [-12] },
  octaveUp: { id: 'octaveUp', name: 'Octave up', shortName: 'Oct +', intervalOffsets: [12] },
  triad: { id: 'triad', name: 'Triad', shortName: 'Triad', scaleOffsets: [0, 2, 4], intervalFallback: [0, 4, 7] },
  seventh: { id: 'seventh', name: '7th chord', shortName: '7th', scaleOffsets: [0, 2, 4, 6], intervalFallback: [0, 4, 7, 10] },
  sus2: { id: 'sus2', name: 'Sus2', shortName: 'sus2', intervalOffsets: [0, 2, 7] },
  sus4: { id: 'sus4', name: 'Sus4', shortName: 'sus4', intervalOffsets: [0, 5, 7] },
  power: { id: 'power', name: 'Power chord', shortName: '5', intervalOffsets: [0, 7] },
  add9: { id: 'add9', name: 'Add 9', shortName: 'add9', scaleOffsets: [0, 2, 4, 8], intervalFallback: [0, 4, 7, 14] },
  ninth: { id: 'ninth', name: '9th chord', shortName: '9th', scaleOffsets: [0, 2, 4, 6, 8], intervalFallback: [0, 4, 7, 10, 14] },
  eleventh: { id: 'eleventh', name: '11th chord', shortName: '11th', scaleOffsets: [0, 2, 4, 6, 8, 10], intervalFallback: [0, 4, 7, 10, 14, 17] },
  thirteenth: { id: 'thirteenth', name: '13th chord', shortName: '13th', scaleOffsets: [0, 2, 4, 6, 8, 10, 12], intervalFallback: [0, 4, 7, 10, 14, 17, 21] },
};

export function normalizeControllerModifier(value) {
  if (!value || value === 'none') return 'none';
  if (String(value).startsWith('note:')) return normalizeControllerModifier(String(value).replace('note:', ''));
  return CONTROLLER_NOTE_MODIFIERS[value] ? value : 'none';
}

export function controllerModifierLabel(value) {
  const modifier = CONTROLLER_NOTE_MODIFIERS[normalizeControllerModifier(value)];
  return modifier?.name || 'None';
}

export function controllerModifierPickerGroups() {
  return [
    {
      id: 'none',
      label: 'None',
      items: [{ value: 'none', label: 'None', description: 'Shoulder or trigger does not change notes.' }],
    },
    {
      id: 'navigation',
      label: 'Navigation',
      items: [
        { value: 'octaveDown', label: CONTROLLER_NOTE_MODIFIERS.octaveDown.name, kicker: 'Oct -', description: 'Add the same note one octave lower while held.' },
        { value: 'octaveUp', label: CONTROLLER_NOTE_MODIFIERS.octaveUp.name, kicker: 'Oct +', description: 'Add the same note one octave higher while held.' },
      ],
    },
    {
      id: 'chords',
      label: 'Chords',
      items: Object.values(CONTROLLER_NOTE_MODIFIERS)
        .filter(mod => !['octaveDown', 'octaveUp'].includes(mod.id))
        .map(mod => ({
          value: mod.id,
          label: mod.name,
          kicker: mod.shortName || mod.name,
          description: mod.scaleOffsets
            ? 'Builds from the current project scale when possible.'
            : 'Uses fixed intervals from the played note.',
        })),
    },
  ];
}
