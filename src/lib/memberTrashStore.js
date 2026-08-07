// Which members are in Trash — tracked entirely in localStorage, mirroring
// trashStore.js's approach for Staff/Admin exactly (same reasoning: no
// is_deleted column dependency, no possible 400 for one, at the cost of
// the active/trash split only being consistent on the browser that
// performed the delete/restore). Kept as its own file with its own storage
// key rather than sharing trashStore.js's, so member and staff ids are
// never tracked in the same list.
const STORAGE_KEY = 'lms_trashed_member_ids';

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
