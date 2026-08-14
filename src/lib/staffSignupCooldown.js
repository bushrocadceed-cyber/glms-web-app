// Same idea as registerAdminCooldown.js, kept as its own store (own storage
// key) since Add Staff Member and Register Admin are triggered from
// different pages and should each get their own independent cooldown
// countdown rather than sharing one — hitting Supabase's signup rate limit
// from one shouldn't block the other.
const STORAGE_KEY = 'lms_add_staff_cooldown_until';

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
