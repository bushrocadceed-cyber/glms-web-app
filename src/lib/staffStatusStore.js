// Active/Inactive status for staff & admin profiles — tracked entirely in
// localStorage, never in the database, for the same reason as
// trashStore.js: profiles has no status column to depend on, so nothing
// here can 400 for a missing one. Note this is purely a directory label —
// toggling someone to Inactive does NOT revoke their Supabase Auth login or
// block them from signing in (that would need a real backend check on
// every request, which this app's anon-key client has no way to enforce).
// It's meant for the admin's own bookkeeping (e.g. "this person left, keep
// the record but flag it"), not access control — use Delete/Trash for that.
const STORAGE_KEY = 'lms_inactive_staff_ids';

function readInactiveIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeInactiveIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Quota exceeded or storage blocked (private browsing) — the status
    // just won't survive a refresh this time.
  }
}

export function isInactive(id) {
  return readInactiveIds().includes(id);
}

export function markInactive(id) {
  const ids = readInactiveIds();
  if (!ids.includes(id)) writeInactiveIds([...ids, id]);
}

export function markActive(id) {
  writeInactiveIds(readInactiveIds().filter((existingId) => existingId !== id));
}
