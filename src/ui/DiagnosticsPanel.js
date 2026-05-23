import {
  METER_PICKER_IDS,
  METER_PRESETS,
  pulseCountForMeter,
  pulseTicksForMeter,
  secondsPerTickForMeter,
  ticksPerBarForMeter,
} from '../engine/Meter.js';

const MATRIX_BPMS = [60, 120, 240];
const MATRIX_BARS = 4;

function fmt(value, digits = 3) {
  return Number.isFinite(value) ? value.toFixed(digits) : '--';
}

function statusForMs(ms) {
  const abs = Math.abs(ms);
  if (abs <= 1) return 'pass';
  if (abs <= 50) return 'warn';
  return 'fail';
}

function statusLabel(status) {
  if (status === 'pass') return 'PASS';
  if (status === 'warn') return 'WARN';
  return 'FAIL';
}

function expectedSeconds(meter, bpm, bars = MATRIX_BARS) {
  return bars * pulseCountForMeter(meter) * (60 / Math.max(1, bpm));
}

function computedSeconds(meter, bpm, bars = MATRIX_BARS, ticksPerQuarter = 480) {
  return bars * ticksPerBarForMeter(meter, ticksPerQuarter) * secondsPerTickForMeter(meter, bpm, ticksPerQuarter);
}

function matrixRows(ticksPerQuarter = 480) {
  return METER_PICKER_IDS.flatMap(id => MATRIX_BPMS.map(bpm => {
    const meter = METER_PRESETS[id];
    const expected = expectedSeconds(meter, bpm, MATRIX_BARS);
    const computed = computedSeconds(meter, bpm, MATRIX_BARS, ticksPerQuarter);
    const deviationMs = (computed - expected) * 1000;
    return { id, bpm, expected, computed, deviationMs, status: statusForMs(deviationMs) };
  }));
}

function pairInvariantRows(rows) {
  const pairs = [['2/4', '6/8'], ['3/4', '9/8'], ['4/4', '12/8']];
  const byKey = new Map(rows.map(row => [`${row.id}:${row.bpm}`, row]));
  return pairs.flatMap(([left, right]) => MATRIX_BPMS.map(bpm => {
    const a = byKey.get(`${left}:${bpm}`);
    const b = byKey.get(`${right}:${bpm}`);
    const deviationMs = ((a?.computed || 0) - (b?.computed || 0)) * 1000;
    return { label: `${left} = ${right} at ${bpm} BPM`, deviationMs, status: statusForMs(deviationMs) };
  }));
}

function linearityRows(rows) {
  const byKey = new Map(rows.map(row => [`${row.id}:${row.bpm}`, row]));
  return METER_PICKER_IDS.flatMap(id => {
    const at60 = byKey.get(`${id}:60`)?.computed;
    const at120 = byKey.get(`${id}:120`)?.computed;
    const at240 = byKey.get(`${id}:240`)?.computed;
    const ratioA = at60 / at120;
    const ratioB = at120 / at240;
    return [
      { label: `${id} 60/120`, ratio: ratioA, status: Math.abs(ratioA - 2) <= 0.1 ? 'pass' : 'fail' },
      { label: `${id} 120/240`, ratio: ratioB, status: Math.abs(ratioB - 2) <= 0.1 ? 'pass' : 'fail' },
    ];
  });
}

export class DiagnosticsPanel {
  constructor({ transport }) {
    this.transport = transport;
    this.el = null;
    this._raf = null;
  }

  render() {
    this.el = document.createElement('div');
    this.el.className = 'diagnostics-panel';
    this.el.innerHTML = `
      <div class="settings-section diagnostics-panel__section">
        <div class="settings-group">
          <h3 class="settings-group__title">Diagnostics</h3>
          <p class="settings-desc">Developer-only timing checks. This panel does not play audio or start transport.</p>
        </div>
        <div class="settings-group">
          <h3 class="settings-group__title">Live Timing</h3>
          <div class="diagnostics-grid" id="diag-live-grid"></div>
        </div>
        <div class="settings-group">
          <h3 class="settings-group__title">Verify Tempo</h3>
          <div class="diagnostics-actions">
            <button class="btn btn--ghost btn--sm" id="diag-current" type="button">Verify Current Meter</button>
            <button class="btn btn--ghost btn--sm" id="diag-matrix" type="button">Run Full Matrix</button>
          </div>
          <div class="diagnostics-result" id="diag-result">No run yet.</div>
        </div>
      </div>
    `;
    this._bind();
    this._startLiveLoop();
    return this.el;
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _bind() {
    this.el.querySelector('#diag-current')?.addEventListener('click', () => {
      this._renderCurrentResult();
    });
    this.el.querySelector('#diag-matrix')?.addEventListener('click', () => {
      this._renderMatrixResult();
    });
  }

  _startLiveLoop() {
    const tick = () => {
      this._renderLiveTiming();
      this._raf = requestAnimationFrame(tick);
    };
    tick();
  }

  _renderLiveTiming() {
    const grid = this.el?.querySelector('#diag-live-grid');
    if (!grid || !this.transport) return;
    const meter = this.transport.meter || METER_PRESETS['4/4'];
    const pulses = pulseTicksForMeter(meter, this.transport.ticksPerBeat || 480);
    const rows = [
      ['Meter', `${meter.id || '4/4'}${meter.feelName ? ` (${meter.feelName})` : ''}`],
      ['Pulse count', String(this.transport.pulseCount || pulseCountForMeter(meter))],
      ['Grouping', JSON.stringify(meter.grouping || [])],
      ['BPM', String(this.transport.bpm)],
      ['seconds/tick', fmt(this.transport.secondsPerTick, 6)],
      ['ticks/sec', fmt(1 / this.transport.secondsPerTick, 1)],
      ['ticks/bar', String(this.transport.ticksPerBar)],
      ['ticks/pulse', pulses.join(', ')],
      ['current bar', String(this.transport.currentBar + 1)],
      ['current pulse', String(this.transport.currentBeat + 1)],
      ['current tick', `${this.transport.currentTick} (raw ${this.transport.currentRawTick})`],
    ];
    grid.innerHTML = rows.map(([label, value]) => `
      <div class="diagnostics-grid__label">${label}</div>
      <div class="diagnostics-grid__value">${value}</div>
    `).join('');
  }

  _renderCurrentResult() {
    const meter = this.transport?.meter || METER_PRESETS['4/4'];
    const bpm = this.transport?.bpm || 120;
    const ticksPerQuarter = this.transport?.ticksPerBeat || 480;
    const expected = expectedSeconds(meter, bpm, 8);
    const computed = computedSeconds(meter, bpm, 8, ticksPerQuarter);
    const deviationMs = (computed - expected) * 1000;
    const status = statusForMs(deviationMs);
    this._setResult(`
      <div class="diagnostics-summary diagnostics-summary--${status}">
        <strong>${statusLabel(status)}</strong>
        <span>${meter.id || '4/4'} at ${bpm} BPM, 8 bars</span>
      </div>
      <div class="diagnostics-grid diagnostics-grid--compact">
        <div class="diagnostics-grid__label">Expected</div><div class="diagnostics-grid__value">${fmt(expected)} s</div>
        <div class="diagnostics-grid__label">Computed</div><div class="diagnostics-grid__value">${fmt(computed)} s</div>
        <div class="diagnostics-grid__label">Deviation</div><div class="diagnostics-grid__value">${fmt(deviationMs, 2)} ms</div>
      </div>
    `);
  }

  _renderMatrixResult() {
    const rows = matrixRows(this.transport?.ticksPerBeat || 480);
    const pairRows = pairInvariantRows(rows);
    const lineRows = linearityRows(rows);
    const failures = [
      ...rows.filter(row => row.status === 'fail'),
      ...pairRows.filter(row => row.status === 'fail'),
      ...lineRows.filter(row => row.status === 'fail'),
    ];
    const warnings = rows.filter(row => row.status === 'warn');
    const status = failures.length ? 'fail' : warnings.length ? 'warn' : 'pass';
    this._setResult(`
      <div class="diagnostics-summary diagnostics-summary--${status}">
        <strong>${statusLabel(status)}</strong>
        <span>${rows.length} tempo cells, ${pairRows.length} pair checks, ${lineRows.length} linearity checks</span>
      </div>
      <div class="diagnostics-table" role="table" aria-label="Tempo matrix results">
        <div class="diagnostics-table__row diagnostics-table__row--head">
          <span>Meter</span><span>BPM</span><span>Expected</span><span>Computed</span><span>Drift</span>
        </div>
        ${rows.map(row => `
          <div class="diagnostics-table__row diagnostics-table__row--${row.status}">
            <span>${row.id}</span>
            <span>${row.bpm}</span>
            <span>${fmt(row.expected)}s</span>
            <span>${fmt(row.computed)}s</span>
            <span>${fmt(row.deviationMs, 2)}ms</span>
          </div>
        `).join('')}
      </div>
      <details class="diagnostics-details">
        <summary>Pair and linearity checks</summary>
        <div class="diagnostics-list">
          ${pairRows.map(row => `<div class="diagnostics-list__item diagnostics-list__item--${row.status}">${row.label}: ${fmt(row.deviationMs, 2)}ms</div>`).join('')}
          ${lineRows.map(row => `<div class="diagnostics-list__item diagnostics-list__item--${row.status}">${row.label}: ${fmt(row.ratio, 3)}</div>`).join('')}
        </div>
      </details>
    `);
  }

  _setResult(html) {
    const result = this.el?.querySelector('#diag-result');
    if (result) result.innerHTML = html;
  }
}
