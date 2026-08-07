// Whether the activity_logs table exists yet — learned once (from
// whichever of logUserActivity/getActivityLogs runs first) and cached here
// so the rest of this session skips a request that's guaranteed to fail
// with "relation does not exist" (42P01) instead of rediscovering that on
// every single logged action.
let tableExists = null;

export function recordActivityLogTablePresent() {
  tableExists = true;
}

export function recordActivityLogTableMissing() {
  tableExists = false;
}

export function isActivityLogTableKnownMissing() {
  return tableExists === false;
}
