// Whether loans has fine_amount/fine_paid columns — confirmed live this
// project's loans table doesn't have them yet. Learned once (from
// whichever of the functions in loanService.js runs first, typically
// getTotalOutstandingFines on every Dashboard load) and cached here so the
// others skip a request that's guaranteed to 400 instead of independently
// rediscovering the same missing columns over and over.
let fineColumnsExist = null;

export function recordFineColumnsPresent() {
  fineColumnsExist = true;
}

export function recordFineColumnsMissing() {
  fineColumnsExist = false;
}

export function areFineColumnsKnownMissing() {
  return fineColumnsExist === false;
}
