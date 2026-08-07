// Which staff/admin profiles are in Trash — tracked entirely in
// localStorage, never in the database. This removes any dependency on an
// is_deleted column existing at all (so nothing can 400 for a missing
// one), at the same cost already accepted for avatarStore.js: the
// active/trash split is only consistent on the browser that performed the
// delete/restore, not synced across devices or other admins' browsers.
const STORAGE_KEY = 'lms_trashed_staff_ids';

function readTrashedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTrashedIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Quota exceeded or storage blocked (private browsing) — the trash
    // state just won't survive a refresh this time.
  }
}

export function isTrashed(id) {
  return readTrashedIds().includes(id);
}

export function markTrashed(id) {
  const ids = readTrashedIds();
  if (!ids.includes(id)) writeTrashedIds([...ids, id]);
}

export function unmarkTrashed(id) {
  writeTrashedIds(readTrashedIds().filter((existingId) => existingId !== id));
}
