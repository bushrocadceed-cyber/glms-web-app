// Whether profiles has an avatar_url column — same caching pattern as
// staffContactColumns.js/loanFineColumns.js, learned for free from any
// select('*') on profiles (AuthContext's fetchProfileRow, staffService's
// getStaffProfiles) rather than by firing a dedicated probe request.
let avatarColumnExists = null;

export function recordProfileRow(row) {
  if (row && avatarColumnExists === null) {
    avatarColumnExists = Object.prototype.hasOwnProperty.call(row, 'avatar_url');
  }
}

export function recordAvatarColumnPresent() {
  avatarColumnExists = true;
}

export function recordAvatarColumnMissing() {
  avatarColumnExists = false;
}

export function isAvatarColumnKnownMissing() {
  return avatarColumnExists === false;
}

// Mirrors isEmailColumnKnownPresent in staffContactColumns.js — deliberately
// NOT the exact negation of isAvatarColumnKnownMissing(). A request that
// writes to avatar_url directly (persistAvatarRemote) needs positive proof
// the column exists before ever touching it; "not yet confirmed missing"
// (the unknown/null state right after a fresh page load) isn't proof, and
// treating it as good enough is exactly what let that write fire for real
// and 400 on this project, where the column has never existed.
export function isAvatarColumnKnownPresent() {
  return avatarColumnExists === true;
}
