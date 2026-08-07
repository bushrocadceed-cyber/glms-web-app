// Library-wide policy — loan duration and per-member borrow cap — stored in
// localStorage for the same reason as everything else in this app that
// isn't backed by a real column (see avatarStore.js, staffStatusStore.js):
// there's no settings table for this to live in. The overdue fine rate is
// a third "system rule" conceptually, but it already has its own store
// (lib/fines.js, used by the Fines report and Return Book modal) — the
// Settings page reads/writes that one directly rather than duplicating it
// here, so there's exactly one source of truth for it.
const STORAGE_KEY = 'lms_library_rules';
const DEFAULTS = { loanDurationDays: 14, maxBooksPerMember: 3 };

export function getLibraryRules() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const loanDurationDays = Number(parsed.loanDurationDays);
    const maxBooksPerMember = Number(parsed.maxBooksPerMember);
    return {
      loanDurationDays: Number.isInteger(loanDurationDays) && loanDurationDays > 0 ? loanDurationDays : DEFAULTS.loanDurationDays,
      maxBooksPerMember: Number.isInteger(maxBooksPerMember) && maxBooksPerMember > 0 ? maxBooksPerMember : DEFAULTS.maxBooksPerMember,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setLibraryRules({ loanDurationDays, maxBooksPerMember }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ loanDurationDays, maxBooksPerMember }));
  } catch {
    // Quota exceeded or storage blocked (private browsing) — the custom
    // rules just won't persist this time, DEFAULTS are used instead.
  }
}
