const STORAGE_KEY = 'notenotes-crash-breadcrumbs';
const ENABLE_KEY = 'notenotes-crashlog-enabled';
const DEFAULT_LIMIT = 160;
let cachedEnabled;

function canUseStorage() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function safeNow() {
  if (typeof performance !== 'undefined' && performance.now) return Math.round(performance.now());
  return Date.now();
}

export function normalizeBreadcrumbTrail(existing = [], entry = {}, limit = DEFAULT_LIMIT) {
  const trail = Array.isArray(existing) ? existing : [];
  const normalized = {
    t: Number.isFinite(entry.t) ? entry.t : safeNow(),
    tag: String(entry.tag || 'event'),
    data: entry.data && typeof entry.data === 'object' ? entry.data : {},
  };
  return [...trail, normalized].slice(-Math.max(1, Math.round(limit) || DEFAULT_LIMIT));
}

export function crashBreadcrumbEnabled() {
  if (cachedEnabled !== undefined) return cachedEnabled;
  if (!canUseStorage()) return false;
  try {
    const params = new URLSearchParams(window.location.search || '');
    if (params.has('crashlog')) {
      window.localStorage.setItem(ENABLE_KEY, '1');
      cachedEnabled = true;
      return cachedEnabled;
    }
    cachedEnabled = window.localStorage.getItem(ENABLE_KEY) === '1';
    return cachedEnabled;
  } catch (_) {
    return false;
  }
}

export function setCrashBreadcrumbEnabled(enabled) {
  if (!canUseStorage()) return;
  try {
    if (enabled) window.localStorage.setItem(ENABLE_KEY, '1');
    else window.localStorage.removeItem(ENABLE_KEY);
    cachedEnabled = !!enabled;
  } catch (_) {}
}

export function readCrashBreadcrumbs() {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function clearCrashBreadcrumbs() {
  if (!canUseStorage()) return;
  try { window.localStorage.removeItem(STORAGE_KEY); } catch (_) {}
}

export function crashBreadcrumb(tag, data = {}) {
  if (!crashBreadcrumbEnabled()) return;
  const entry = { t: safeNow(), tag, data };
  try {
    const trail = normalizeBreadcrumbTrail(readCrashBreadcrumbs(), entry);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
    console.debug?.('[Notenotes crashlog]', tag, data);
  } catch (_) {}
}

export function installCrashBreadcrumbConsole() {
  if (typeof window === 'undefined' || window.notenotesCrashLog) return;
  window.notenotesCrashLog = {
    enable() { setCrashBreadcrumbEnabled(true); return true; },
    disable() { setCrashBreadcrumbEnabled(false); return false; },
    clear() { clearCrashBreadcrumbs(); return []; },
    dump() { return readCrashBreadcrumbs(); },
    text() {
      return readCrashBreadcrumbs()
        .map((entry) => `${String(entry.t).padStart(7, ' ')} ${entry.tag} ${JSON.stringify(entry.data)}`)
        .join('\n');
    },
  };
  window.addEventListener('error', (event) => {
    crashBreadcrumb('window.error', {
      message: event.message || 'unknown',
      source: event.filename || '',
      line: event.lineno || 0,
      column: event.colno || 0,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    crashBreadcrumb('window.unhandledrejection', {
      reason: String(reason?.message || reason || 'unknown'),
    });
  });
  if (crashBreadcrumbEnabled()) {
    console.info?.('[Notenotes crashlog] enabled. After a crash/reload, run window.notenotesCrashLog.text()');
  }
}
