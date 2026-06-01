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
  {
    id: 'halo',
    label: 'Halo',
    description: 'Circle-of-fifths bloom for pitch classes and harmony.',
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

export function stageViewNeighbor(id = DEFAULT_STAGE_VIEW_ID, mode = 'live', direction = 1) {
  const options = stageViewOptionsForMode(mode);
  if (options.length < 2) return options[0] || STAGE_VIEW_REGISTRY[0];
  const current = resolveStageView(id, mode);
  const index = Math.max(0, options.findIndex(view => view.id === current.id));
  const step = direction < 0 ? -1 : 1;
  const nextIndex = (index + step + options.length) % options.length;
  return options[nextIndex];
}
