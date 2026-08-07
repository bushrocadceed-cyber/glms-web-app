// Default daily late fee, admin-adjustable and persisted in localStorage —
// there's no library-wide settings table for this to live in, so it
// follows the same local-first pattern as everything else in this app that
// isn't backed by a real column (see avatarStore.js, staffStatusStore.js).
// Changing it only affects fines calculated from here on — anything
// already finalized (written to loans.fine_amount) keeps its recorded
// value regardless of a later rate change.
const RATE_STORAGE_KEY = 'lms_fine_rate_per_day';
export const DEFAULT_FINE_RATE = 0.5;

export function getFineRate() {
  try {
    const raw = localStorage.getItem(RATE_STORAGE_KEY);
    const parsed = raw !== null ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_FINE_RATE;
  } catch {
    return DEFAULT_FINE_RATE;
  }
}

export function setFineRate(rate) {
  try {
    localStorage.setItem(RATE_STORAGE_KEY, String(rate));
  } catch {
    // Quota exceeded or storage blocked (private browsing) — the custom
    // rate just won't persist this time, DEFAULT_FINE_RATE is used instead.
  }
}

// Shared by loanService.js (the Fines report's live overdue rows) and
// ReturnBookModal (pre-filling the suggested fine before it's finalized),
// so both always agree on the same days-late/amount math. returnDate
// defaults to now — i.e. "if this book were returned right this moment" —
// which is exactly what both callers need: the report shows what's owed
// as of today, the modal shows what returning today would cost.
export function computeFine(dueDate, returnDate = new Date(), ratePerDay = getFineRate()) {
  if (!dueDate) return { daysLate: 0, amount: 0 };
  const end = returnDate ? new Date(returnDate) : new Date();
  const daysLate = Math.max(0, Math.floor((end - new Date(dueDate)) / (1000 * 60 * 60 * 24)));
  return { daysLate, amount: Number((daysLate * ratePerDay).toFixed(2)) };
}
