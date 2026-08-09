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

// Deliberately the mirror image of isEmailColumnKnownMissing rather than
// its exact negation — that distinction matters for callers about to fire
// a request that references the email column directly (a filter or an
// update payload), not just read it. isEmailColumnKnownMissing() treats
// "still unknown" (null — nothing has recorded a row yet, e.g. the first
// fetch returned zero rows, or ran concurrently with a submit) the same
// as "confirmed to exist", which is an optimistic default that's safe for
// reads (select('*') never fails) but not for a request that's guaranteed
// to 400 if the guess is wrong. isEmailColumnKnownPresent() only returns
// true once a row has actually proven the column is there, so "unknown"
// correctly falls on the side of "don't risk it" for those call sites.
export function isEmailColumnKnownPresent() {
  return emailColumnExists === true;
}
