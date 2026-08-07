// Local fallback for a staff/admin's email address, keyed by profile id —
// same shape as avatarStore.js. This exists because profiles.email is
// confirmed missing from the live database (see staffContactColumns.js),
// so an email typed into Edit Staff or the Reset Password prompt has
// nowhere real to land; without this fallback it would be lost on every
// refresh, and Reset Password would have no address to send to a second
// time around. staffService.js always tries the real column first — this
// is only what's read back when that column doesn't exist or came back
// empty.
function storageKey(id) {
  return `lms_staff_email_${id}`;
}

export function getStaffEmail(id) {
  if (!id) return null;
  try {
    return localStorage.getItem(storageKey(id));
  } catch {
    return null;
  }
}

export function setStaffEmail(id, email) {
  if (!id) return;
  try {
    if (email) {
      localStorage.setItem(storageKey(id), email);
    } else {
      localStorage.removeItem(storageKey(id));
    }
  } catch {
    // Quota exceeded or storage blocked (private browsing) — the email
    // just won't persist this time, rest of the app still works.
  }
}
