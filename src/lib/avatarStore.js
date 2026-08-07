import { supabase } from './supabaseClient';

// Profile pictures are cached entirely in localStorage, keyed by row id —
// getAvatar/setAvatar below are synchronous and stay that way, since
// dozens of call sites across the app (StaffTable, MembersTable,
// ActivityLogsPage, EditStaffModal's useState initializer, Sidebar, the
// header, ...) read this value directly during render and would all need
// rewriting to handle a promise if this became async. localStorage is what
// makes that possible.
//
// The trade-off the app originally accepted for this: a picture only ever
// lived on the browser that uploaded it, and was lost entirely if that
// browser's storage was cleared. persistAvatarRemote/hydrateAvatarFromRow
// below close that gap for any table that has a real avatar_url column
// (currently just profiles — see supabase/profile_avatar_schema.sql) by
// treating the database as the durable source of truth and localStorage as
// a fast, synchronous cache in front of it: writes go to both, and reads
// stay purely local but get silently refreshed from the database every
// time a row is fetched (see hydrateAvatarFromRow's call sites in
// staffService.js / AuthContext.jsx). A browser that's just had its
// storage cleared sees the correct picture again the moment that profile
// is loaded from Supabase — login, or the staff list — without needing any
// call site to become async.
function storageKey(id) {
  return `lms_avatar_${id}`;
}

export function getAvatar(id) {
  if (!id) return null;
  try {
    return localStorage.getItem(storageKey(id));
  } catch {
    return null;
  }
}

export function setAvatar(id, dataUrl) {
  if (!id) return;
  try {
    if (dataUrl) {
      localStorage.setItem(storageKey(id), dataUrl);
    } else {
      localStorage.removeItem(storageKey(id));
    }
  } catch {
    // Quota exceeded or storage blocked (private browsing) — the picture
    // just won't persist locally this time; persistAvatarRemote (if the
    // caller also calls it) can still make it durable server-side.
  }
}

// Best-effort durable write — call this alongside setAvatar (not instead
// of it) wherever an entity's table is known, so the picture also lands in
// a real column, not just this browser's cache. table must have an
// avatar_url text column already (profiles does, via
// supabase/profile_avatar_schema.sql; members does not yet). Never throws:
// a failed or not-yet-supported remote write should never block the
// synchronous, already-succeeded local save that every call site actually
// depends on.
export async function persistAvatarRemote(table, id, dataUrl) {
  if (!id) return;
  try {
    const { error } = await supabase.from(table).update({ avatar_url: dataUrl }).eq('id', id);
    if (error) {
      // 42703 (Postgres) / PGRST204 (PostgREST) both mean "no avatar_url
      // column on this table yet" — quiet until
      // supabase/profile_avatar_schema.sql has been run, not a real error.
      if (error.code !== '42703' && error.code !== 'PGRST204') {
        console.error(`Failed to persist avatar to ${table}:`, error);
      }
    }
  } catch (err) {
    console.error(`Failed to persist avatar to ${table}:`, err);
  }
}

// Call whenever a row that might have a real avatar_url is fetched from
// the database (see getStaffProfiles in staffService.js, fetchProfileRow
// in AuthContext.jsx). Backfills the local cache so a picture set on
// another browser — or lost when this one's storage was cleared —
// reappears the instant its owning row is loaded again. No-ops if the row
// has no avatar_url (column not queried, missing, or genuinely never set)
// or already matches what's cached, so this is safe to call on every row
// of every list fetch without extra writes.
export function hydrateAvatarFromRow(row) {
  if (row?.id && row?.avatar_url && getAvatar(row.id) !== row.avatar_url) {
    setAvatar(row.id, row.avatar_url);
  }
}
