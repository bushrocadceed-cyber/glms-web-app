// Persists the Register Admin rate-limit cooldown across a page reload —
// without this, closing/reopening the tab (or just refreshing) after
// hitting a 429 would reset the in-memory cooldown state to zero and let
// the very next click immediately retry, producing another 429 right away.
const STORAGE_KEY = 'lms_register_admin_cooldown_until';

export function getStoredCooldownUntil() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setStoredCooldownUntil(timestamp) {
  try {
    localStorage.setItem(STORAGE_KEY, String(timestamp));
  } catch {
    // Storage blocked (quota/private browsing) — the cooldown still works
    // for this tab's lifetime via in-memory state, it just won't survive
    // a reload this time.
  }
}
