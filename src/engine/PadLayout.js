export const PAD_LAYOUT_VERSION = 1;
export const DEFAULT_PAD_LAYOUT_TEMPLATE = 'even';

export const PAD_LAYOUT_TEMPLATES = {
  even: {
    id: 'even',
    label: 'Fit',
    description: 'Equal pads packed into balanced rows.',
  },
  compact: {
    id: 'compact',
    label: 'Compact',
    description: 'Equal pads with fewer rows when wider screens allow it.',
  },
  rows: {
    id: 'rows',
    label: 'Rows',
    description: 'Equal pads with a calmer row-first shape.',
  },
  bigTonic: {
    id: 'bigTonic',
    label: 'Big Tonic',
    description: 'Makes the home note larger on wider screens.',
  },
  thumb: {
    id: 'thumb',
    label: 'Thumb-friendly',
    description: 'A hand-shaped layout that still collapses cleanly on phones.',
  },
  velocity: {
    id: 'velocity',
    label: 'Velocity',
    description: 'Tall, narrow pads where striking lower plays louder. Still locked to the scale.',
  },
};

export const PAD_SIZE_SPANS = {
  small: { columns: 1, rows: 1 },
  medium: { columns: 2, rows: 1 },
  large: { columns: 2, rows: 2 },
  wide: { columns: 3, rows: 1 },
};

export const PLAYABLE_PAD_MODES = ['single', 'chords', 'root', 'compass', 'step', 'voices'];

export function normalizePadMode(value, { voiceAvailable = true } = {}) {
  if (value === 'custom') return 'single';
  if (value === 'voices' && !voiceAvailable) return 'single';
  return PLAYABLE_PAD_MODES.includes(value) ? value : 'single';
}

export function normalizePadLayout(value = {}, padCount = 0) {
  const count = Math.max(0, Math.floor(Number(padCount) || 0));
  const template = PAD_LAYOUT_TEMPLATES[value?.template]
    ? value.template
    : DEFAULT_PAD_LAYOUT_TEMPLATE;
  const sourcePads = Array.isArray(value?.pads) ? value.pads : [];
  const normalizedPads = Array.from({ length: count }, (_, index) => {
    const ref = `deg:${index + 1}`;
    const existing = sourcePads.find(pad => pad?.ref === ref);
    const templateSize = sizeForTemplate(template, index, count);
    const size = PAD_SIZE_SPANS[existing?.size] ? existing.size : templateSize;
    return { ref, size };
  });

  return {
    version: PAD_LAYOUT_VERSION,
    template,
    pads: normalizedPads,
  };
}

export function padLayoutForCount(padCount = 0, options = {}) {
  return normalizePadLayout({
    version: PAD_LAYOUT_VERSION,
    template: options.template || DEFAULT_PAD_LAYOUT_TEMPLATE,
    pads: [],
  }, padCount);
}

export function recommendedPadColumns(padCount = 0, width = 360, options = {}) {
  const count = Math.max(1, Math.floor(Number(padCount) || 1));
  const availableWidth = Math.max(1, Number(width) || 360);
  const minPadWidth = options.minPadWidth || 72;
  const template = options.template || DEFAULT_PAD_LAYOUT_TEMPLATE;
  const maxCols = Math.max(1, Math.min(count, Math.floor((availableWidth - 4) / minPadWidth)));
  if (maxCols <= 1) return 1;

  const targetRows = targetRowsForTemplate(template, count);
  let best = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let cols = 1; cols <= maxCols; cols += 1) {
    const rows = Math.ceil(count / cols);
    const finalRow = count % cols || cols;
    const orphanPenalty = finalRow === 1 && rows > 1 ? 100 : 0;
    const rowBalance = rows > 1 ? Math.abs(cols - finalRow) : cols;
    const rowPenalty = Math.abs(rows - targetRows) * 12;
    const densityPenalty = template === 'compact' ? (maxCols - cols) * 0.25 : cols * 0.05;
    const score = orphanPenalty + rowBalance + rowPenalty + densityPenalty;
    if (score < bestScore) {
      bestScore = score;
      best = cols;
    }
  }
  return best;
}

function targetRowsForTemplate(template, count) {
  if (template === 'velocity') return 1; // single row of tall, narrow pads
  if (template === 'compact') return count > 10 ? 2 : 1;
  if (template === 'rows') return count > 8 ? 3 : 2;
  return count > 8 ? 2 : 2;
}

export function sizeForTemplate(template = DEFAULT_PAD_LAYOUT_TEMPLATE, index = 0, count = 0) {
  if (template === 'bigTonic') return index === 0 ? 'large' : 'small';
  if (template === 'thumb') {
    if (index === 0 || index === 3) return 'medium';
    if (index === count - 1) return 'large';
  }
  return 'small';
}
