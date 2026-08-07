// Whether profiles has an avatar_url column — same caching pattern as
// staffContactColumns.js/loanFineColumns.js. AuthContext's fetchProfileRow
// uses an explicit column list (not select('*')), so this is what lets it
// try including avatar_url without firing a guaranteed-400 request on
// every single profile load once the column is known missing.
let avatarColumnExists = null;

export function recordAvatarColumnPresent() {
  avatarColumnExists = true;
}

export function recordAvatarColumnMissing() {
  avatarColumnExists = false;
}

export function isAvatarColumnKnownMissing() {
  return avatarColumnExists === false;
}
