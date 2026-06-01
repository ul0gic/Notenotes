export const DEFAULT_STAGE_VIEW_ID = 'trace';

export const STAGE_VIEW_REGISTRY = [
  {
    id: 'trace',
    label: 'Trace',
    description: 'Neon lane highway with sustain trails.',
    modes: ['live', 'canvas'],
  },
  {
    id: 'thread',
    label: 'Thread',
    description: 'Pitch-contour ribbons for melody, chords, and sustain.',
    modes: ['live'],
  },
  {
    id: 'pulse',
    label: 'Pulse',
    description: 'Radial lane energy for rhythm, velocity, and recent hits.',
    modes: ['live'],
  },
];

export function stageViewOptionsForMode(mode = 'live') {
  return STAGE_VIEW_REGISTRY.filter(view => view.modes.includes(mode));
}

export function resolveStageView(id = DEFAULT_STAGE_VIEW_ID, mode = null) {
  const candidates = mode ? stageViewOptionsForMode(mode) : STAGE_VIEW_REGISTRY;
  return candidates.find(view => view.id === id)
    || candidates.find(view => view.id === DEFAULT_STAGE_VIEW_ID)
    || STAGE_VIEW_REGISTRY[0];
}
