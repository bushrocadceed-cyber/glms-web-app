// Whether profiles has an email column — learned for free from
// getStaffProfiles's own select('*') (which can never fail regardless of
// which columns exist), then reused so findProfileByEmail doesn't have to
// independently rediscover the same missing column via a lookup that's
// guaranteed to 400 every single time it runs (confirmed live: this
// project's profiles table has neither an email nor phone column yet, so
// every Register Admin / Add Staff Member submission was firing a real
// failing request before this cache existed).
let emailColumnExists = null;

export function recordProfileRow(row) {
  if (row && emailColumnExists === null) {
    emailColumnExists = Object.prototype.hasOwnProperty.call(row, 'email');
  }
}

export function recordEmailColumnMissing() {
  emailColumnExists = false;
}

export function isEmailColumnKnownMissing() {
  return emailColumnExists === false;
}
