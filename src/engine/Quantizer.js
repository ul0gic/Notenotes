/**
 * Quantizer — Snap note timings to a rhythmic grid.
 * Default: OFF (free timing). Can be enabled as a setting.
 */

export const QuantizeGrid = {
  OFF: 0,
  QUARTER: 1,        // 1/4 note
  EIGHTH: 2,         // 1/8 note
  SIXTEENTH: 4,      // 1/16 note
  THIRTY_SECOND: 8,  // 1/32 note
  TRIPLET_EIGHTH: 3, // 1/8 triplet
  TRIPLET_SIXTEENTH: 6 // 1/16 triplet
};

export class Quantizer {
  /**
   * @param {number} ticksPerBeat - Ticks per quarter note (from Transport)
   */
  constructor(ticksPerBeat = 480) {
    this.ticksPerBeat = ticksPerBeat;
    this.grid = QuantizeGrid.OFF;
  }

  /**
   * Set the quantization grid.
   * @param {number} grid - One of QuantizeGrid values
   */
  setGrid(grid) {
    this.grid = grid;
  }

  /**
   * Get the grid size in ticks.
   * @returns {number} Grid interval in ticks, or 0 if OFF
   */
  get gridTicks() {
    if (this.grid === QuantizeGrid.OFF) return 0;
    return Math.floor(this.ticksPerBeat / this.grid);
  }

  /**
   * Quantize a single tick value to the nearest grid point.
   * @param {number} tick - Raw tick position
   * @returns {number} Quantized tick position
   */
  quantize(tick) {
    if (this.grid === QuantizeGrid.OFF) return tick;
    const g = this.gridTicks;
    if (g <= 0) return tick;
    return Math.round(tick / g) * g;
  }

  /**
   * Quantize a note's start time and optionally its duration.
   * @param {object} note - Note object with startTick and durationTick
   * @param {boolean} quantizeDuration - Whether to also quantize the duration
   * @returns {object} New note with quantized values
   */
  quantizeNote(note, quantizeDuration = false) {
    const quantized = { ...note };
    quantized.startTick = this.quantize(note.startTick);
    if (quantizeDuration && this.gridTicks > 0) {
      quantized.durationTick = Math.max(
        this.gridTicks,
        this.quantize(note.durationTick)
      );
    }
    return quantized;
  }

  /**
   * Quantize an array of notes.
   * @param {object[]} notes - Array of note objects
   * @param {boolean} quantizeDuration
   * @returns {object[]} New array with quantized notes
   */
  quantizeNotes(notes, quantizeDuration = false) {
    return notes.map(n => this.quantizeNote(n, quantizeDuration));
  }

  /**
   * Get a human-readable label for the current grid setting.
   * @returns {string}
   */
  get label() {
    switch (this.grid) {
      case QuantizeGrid.OFF: return 'Free';
      case QuantizeGrid.QUARTER: return '1/4';
      case QuantizeGrid.EIGHTH: return '1/8';
      case QuantizeGrid.SIXTEENTH: return '1/16';
      case QuantizeGrid.THIRTY_SECOND: return '1/32';
      case QuantizeGrid.TRIPLET_EIGHTH: return '1/8T';
      case QuantizeGrid.TRIPLET_SIXTEENTH: return '1/16T';
      default: return 'Free';
    }
  }
}
