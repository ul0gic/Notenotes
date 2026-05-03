/**
 * Toast — Lightweight notification system.
 */

const TOAST_DURATION = 2500;
let container = null;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {number} [duration]
 */
export function showToast(message, duration = TOAST_DURATION) {
  const c = ensureContainer();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  c.appendChild(el);

  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
}
