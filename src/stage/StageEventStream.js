function cloneEvent(event) {
  return {
    ...event,
    meta: event.meta ? { ...event.meta } : undefined,
  };
}

function makeId(prefix = 'stage') {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function normalizeStart(input = {}) {
  const id = input.id || makeId('stage-note');
  return {
    id,
    type: 'note',
    source: input.source || 'unknown',
    pitch: Number(input.pitch),
    lane: Number.isFinite(Number(input.lane)) ? Number(input.lane) : 0,
    startTick: Math.max(0, Math.floor(Number(input.startTick) || 0)),
    endTick: null,
    durationTick: null,
    velocity: Math.max(0, Math.min(1, Number(input.velocity) || 0.8)),
    color: input.color || '#ffffff',
    accentColor: input.accentColor || input.color || '#ffffff',
    label: input.label || '',
    meta: input.meta ? { ...input.meta } : undefined,
  };
}

function normalizeHit(input = {}) {
  const pitch = Number(input.pitch);
  return {
    id: input.id || makeId('stage-hit'),
    type: 'hit',
    source: input.source || 'unknown',
    drum: input.drum || input.hitType || 'hit',
    pitch: Number.isFinite(pitch) ? pitch : null,
    lane: Number.isFinite(Number(input.lane)) ? Number(input.lane) : 0,
    startTick: Math.max(0, Math.floor(Number(input.startTick) || 0)),
    endTick: null,
    durationTick: 1,
    velocity: Math.max(0, Math.min(1, Number(input.velocity) || 0.8)),
    color: input.color || '#ffffff',
    accentColor: input.accentColor || input.color || '#ffffff',
    label: input.label || input.drum || input.hitType || 'Hit',
    meta: input.meta ? { ...input.meta } : undefined,
  };
}

export class StageEventStream {
  constructor() {
    this._subscribers = new Set();
    this._active = new Map();
  }

  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this._subscribers.add(fn);
    return () => this._subscribers.delete(fn);
  }

  beginNote(input = {}) {
    const event = normalizeStart(input);
    this._active.set(event.id, event);
    this._emit('start', event);
    return event.id;
  }

  endNote(id, input = {}) {
    const active = this._active.get(id);
    if (!active) return null;
    const endTick = Math.max(active.startTick + 1, Math.floor(Number(input.endTick) || active.startTick + 1));
    const event = {
      ...active,
      endTick,
      durationTick: endTick - active.startTick,
      velocity: Number.isFinite(Number(input.velocity)) ? Math.max(0, Math.min(1, Number(input.velocity))) : active.velocity,
    };
    this._active.delete(id);
    this._emit('end', event);
    return cloneEvent(event);
  }

  hit(input = {}) {
    const event = normalizeHit(input);
    this._emit('hit', event);
    return cloneEvent(event);
  }

  activeEvents() {
    return [...this._active.values()].map(cloneEvent);
  }

  clear() {
    this._active.clear();
    this._emit('clear', null);
  }

  _emit(kind, event) {
    const payload = { kind, event: event ? cloneEvent(event) : null };
    for (const subscriber of this._subscribers) {
      subscriber(payload);
    }
  }
}
