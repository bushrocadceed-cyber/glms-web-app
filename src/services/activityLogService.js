import { supabase } from '../lib/supabaseClient';
import {
  isActivityLogTableKnownMissing,
  recordActivityLogTableMissing,
  recordActivityLogTablePresent,
} from '../lib/activityLogTable';

// A missing table reports as 42P01 (Postgres) or PGRST205 (PostgREST's own
// "not in the schema cache" code) depending on which layer answers first —
// both mean the same thing here: supabase/activity_logs_schema.sql hasn't
// been run yet.
function isMissingTableError(err) {
  return err?.code === '42P01' || err?.code === 'PGRST205';
}

// Reusable audit-log helper — call this after any key action succeeds
// (adding a book, returning a loan, saving settings, etc.) with a short
// human-readable action name and an optional detail string. Deliberately
// takes only (action, details): everything about *who* performed it is
// resolved internally from the current Supabase session, so callers never
// have to thread user info through just to log something.
//
// Never throws — a failed log write (table not set up yet, network hiccup)
// must never break the real action it's attached to. Errors are swallowed
// after being recorded once via activityLogTable.js, so a missing table
// only ever costs one failed request, not one per action for the rest of
// the session.
export async function logUserActivity(action, details = '') {
  if (isActivityLogTableKnownMissing()) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return; // nobody signed in — nothing to attribute this to

    let userName = user.email ?? 'Unknown';
    let userRole = null;

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileRow) {
      userName = profileRow.full_name || userName;
      userRole = profileRow.role ?? null;
    }

    const { error } = await supabase.from('activity_logs').insert({
      user_id: user.id,
      user_name: userName,
      user_role: userRole,
      action,
      details,
    });

    if (error) {
      if (isMissingTableError(error)) {
        recordActivityLogTableMissing();
      } else {
        console.error('Failed to record activity log:', error);
      }
      return;
    }

    recordActivityLogTablePresent();
  } catch (err) {
    console.error('Failed to record activity log:', err);
  }
}

// Most recent 500 entries — an audit log can grow indefinitely, so this is
// a practical cap rather than an unbounded fetch; the search/filter UI on
// ActivityLogsPage operates on whatever's in that window.
export async function getActivityLogs() {
  if (isActivityLogTableKnownMissing()) {
    return { rows: [], tableReady: false };
  }

  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, user_id, user_name, user_role, action, details, ip_address, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingTableError(error)) {
      recordActivityLogTableMissing();
      return { rows: [], tableReady: false };
    }
    throw error;
  }

  recordActivityLogTablePresent();
  return { rows: data ?? [], tableReady: true };
}
