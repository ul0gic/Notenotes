function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveModulo(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

/**
 * Returns an event's position within the current Stage timing unit.
 *
 * One Pocket revolution is one Stage unit: a quarter pulse in simple meters,
 * a dotted-quarter pulse in compound meters, or the current asymmetric pulse
 * unit supplied by StageModel.
 */
export function pocketEventPhase(event = {}, options = {}) {
  const unitTicks = Math.max(1, finiteNumber(options.unitTicks, 480));
  const startTick = finiteNumber(event.startTick, 0);
  const nowTick = finiteNumber(options.nowTick, 0);
  return positiveModulo(startTick - nowTick, unitTicks) / unitTicks;
}

export function pocketLaneAngle(laneIndex = 0, laneCount = 1) {
  const count = Math.max(1, Math.floor(finiteNumber(laneCount, 1)));
  const lane = positiveModulo(Math.floor(finiteNumber(laneIndex, 0)), count);
  return -Math.PI / 2 + lane * ((Math.PI * 2) / count);
}

