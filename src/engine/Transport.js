/**
 * Transport — Play/pause/stop/loop state machine.
 * Manages BPM, time signature, position tracking, and the scheduling clock.
 * 
 * Uses a lookahead scheduler pattern for rock-solid timing:
 * - A JS timer fires frequently (25ms)
 * - Schedules audio events slightly ahead (100ms lookahead)
 * - This decouples timing accuracy from the main thread
 */

import { AudioEngine } from './AudioEngine.js';

/** Transport states */
export const TransportState = {
  STOPPED: 'stopped',
  PLAYING: 'playing',
  RECORDING: 'recording'
};

export class Transport {
  constructor() {
    this.engine = AudioEngine.getInstance();

    // Tempo & time signature
    this._bpm = 120;
    this._timeSignature = { beats: 4, subdivision: 4 }; // 4/4

    // Transport state
    this.state = TransportState.STOPPED;

    // Position (in ticks — 480 ticks per quarter note, standard MIDI resolution)
    this.ticksPerBeat = 480;
    this._currentTick = 0;
    this._startTime = 0; // AudioContext time when playback started
    this._startTick = 0; // Tick position when playback started

    // Loop
    this.loopEnabled = true;
    this.loopStartBar = 0;
    this.loopEndBar = 4;   // Default: 4-bar loop

    // Timeline limit: 10 minutes
    this._maxDurationSeconds = 600;

    // Scheduler
    this._scheduleAheadTime = 0.1;  // 100ms lookahead
    this._schedulerInterval = 25;    // 25ms timer interval
    this._schedulerTimerId = null;
    this._nextTickTime = 0;

    // Callbacks
    this._onTick = [];
    this._onBeat = [];
    this._onBar = [];
    this._onStateChange = [];
    this._onLoop = [];
  }

  // --- Properties ---

  get bpm() { return this._bpm; }
  set bpm(value) {
    this._bpm = Math.max(40, Math.min(240, Math.round(value)));
  }

  get timeSignature() { return this._timeSignature; }
  set timeSignature(ts) {
    this._timeSignature = { beats: ts.beats || 4, subdivision: ts.subdivision || 4 };
  }

  /** Ticks per bar based on current time signature */
  get ticksPerBar() {
    return this.ticksPerBeat * this._timeSignature.beats;
  }

  /** Current tick position */
  get currentTick() {
    if (this.state === TransportState.STOPPED) return this._currentTick;
    const elapsed = this.engine.currentTime - this._startTime;
    const ticksPerSecond = (this._bpm / 60) * this.ticksPerBeat;
    return this._startTick + Math.floor(elapsed * ticksPerSecond);
  }

  /** Current beat (0-indexed within bar) */
  get currentBeat() {
    return Math.floor((this.currentTick % this.ticksPerBar) / this.ticksPerBeat);
  }

  /** Current bar (0-indexed) */
  get currentBar() {
    return Math.floor(this.currentTick / this.ticksPerBar);
  }

  /** Current position as fraction of a beat (for sub-beat precision) */
  get currentBeatFraction() {
    return (this.currentTick % this.ticksPerBeat) / this.ticksPerBeat;
  }

  /** Seconds per beat */
  get secondsPerBeat() {
    return 60 / this._bpm;
  }

  /** Seconds per tick */
  get secondsPerTick() {
    return 60 / (this._bpm * this.ticksPerBeat);
  }

  /** Maximum bars (derived from 10-minute limit) */
  get maxBars() {
    const secondsPerBar = this.secondsPerBeat * this._timeSignature.beats;
    return Math.floor(this._maxDurationSeconds / secondsPerBar);
  }

  /** Loop start in ticks */
  get loopStartTick() {
    return this.loopStartBar * this.ticksPerBar;
  }

  /** Loop end in ticks */
  get loopEndTick() {
    return this.loopEndBar * this.ticksPerBar;
  }

  // --- Event Registration ---

  onTick(fn) { this._onTick.push(fn); return () => this._off(this._onTick, fn); }
  onBeat(fn) { this._onBeat.push(fn); return () => this._off(this._onBeat, fn); }
  onBar(fn) { this._onBar.push(fn); return () => this._off(this._onBar, fn); }
  onStateChange(fn) { this._onStateChange.push(fn); return () => this._off(this._onStateChange, fn); }
  onLoop(fn) { this._onLoop.push(fn); return () => this._off(this._onLoop, fn); }

  _off(arr, fn) {
    const idx = arr.indexOf(fn);
    if (idx !== -1) arr.splice(idx, 1);
  }

  _emit(arr, ...args) {
    for (const fn of arr) fn(...args);
  }

  // --- Controls ---

  play() {
    if (this.state === TransportState.PLAYING) return;
    this.engine.resume();

    this._startTime = this.engine.currentTime;
    this._startTick = this._currentTick;
    this._nextTickTime = this.engine.currentTime;

    this.state = TransportState.PLAYING;
    this._emit(this._onStateChange, this.state);
    this._startScheduler();
  }

  record() {
    if (this.state === TransportState.RECORDING) return;
    this.engine.resume();

    this._startTime = this.engine.currentTime;
    this._startTick = this._currentTick;
    this._nextTickTime = this.engine.currentTime;

    this.state = TransportState.RECORDING;
    this._emit(this._onStateChange, this.state);
    this._startScheduler();
  }

  pause() {
    if (this.state === TransportState.STOPPED) return;
    this._currentTick = this.currentTick;
    this.state = TransportState.STOPPED;
    this._stopScheduler();
    this._emit(this._onStateChange, this.state);
  }

  stop() {
    this.state = TransportState.STOPPED;
    this._currentTick = this.loopEnabled ? this.loopStartTick : 0;
    this._stopScheduler();
    this._emit(this._onStateChange, this.state);
  }

  /** Toggle play/pause */
  toggle() {
    if (this.state === TransportState.STOPPED) {
      this.play();
    } else {
      this.pause();
    }
  }

  /** Set position to a specific bar */
  seekToBar(bar) {
    const wasStopped = this.state === TransportState.STOPPED;
    if (!wasStopped) this.pause();
    this._currentTick = Math.max(0, bar) * this.ticksPerBar;
    if (!wasStopped) this.play();
  }

  /** Set loop region */
  setLoop(startBar, endBar) {
    this.loopStartBar = Math.max(0, startBar);
    this.loopEndBar = Math.min(this.maxBars, Math.max(this.loopStartBar + 1, endBar));
  }

  // --- Internal Scheduler ---

  _startScheduler() {
    this._stopScheduler();
    this._schedulerTimerId = setInterval(() => this._schedulerTick(), this._schedulerInterval);
  }

  _stopScheduler() {
    if (this._schedulerTimerId !== null) {
      clearInterval(this._schedulerTimerId);
      this._schedulerTimerId = null;
    }
  }

  _schedulerTick() {
    const tickDuration = this.secondsPerTick;
    const lookAheadEnd = this.engine.currentTime + this._scheduleAheadTime;

    while (this._nextTickTime < lookAheadEnd) {
      // Calculate the tick index for this scheduled moment
      const elapsed = this._nextTickTime - this._startTime;
      const ticksPerSecond = (this._bpm / 60) * this.ticksPerBeat;
      let tick = this._startTick + Math.floor(elapsed * ticksPerSecond);

      // Handle looping
      if (this.loopEnabled && tick >= this.loopEndTick) {
        const loopLength = this.loopEndTick - this.loopStartTick;
        if (loopLength > 0) {
          tick = this.loopStartTick + ((tick - this.loopStartTick) % loopLength);
          // Reset start references for the new loop cycle
          this._startTick = tick;
          this._startTime = this._nextTickTime;
          this._emit(this._onLoop, tick);
        }
      }

      // Store current tick
      this._currentTick = tick;

      // Fire tick callbacks
      this._emit(this._onTick, tick, this._nextTickTime);

      // Check for beat boundary
      if (tick % this.ticksPerBeat === 0) {
        const beat = Math.floor((tick % this.ticksPerBar) / this.ticksPerBeat);
        this._emit(this._onBeat, beat, this._nextTickTime);

        // Check for bar boundary
        if (beat === 0) {
          const bar = Math.floor(tick / this.ticksPerBar);
          this._emit(this._onBar, bar, this._nextTickTime);
        }
      }

      this._nextTickTime += tickDuration;
    }
  }
}
