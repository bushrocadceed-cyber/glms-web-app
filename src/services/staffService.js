import { supabase } from '../lib/supabaseClient';
import { getTempAuthClient } from '../lib/tempAuthClient';
import { getAvatar, hydrateAvatarFromRow, persistAvatarRemote, setAvatar } from '../lib/avatarStore';
import { isTrashed, markTrashed, unmarkTrashed } from '../lib/trashStore';
import { isInactive, markActive, markInactive } from '../lib/staffStatusStore';
import { getStaffEmail, setStaffEmail as setLocalStaffEmail } from '../lib/staffEmailStore';
import {
  isEmailColumnKnownPresent,
  recordEmailColumnMissing,
  recordProfileRow,
} from '../lib/staffContactColumns';
import {
  isAvatarColumnKnownPresent,
  recordProfileRow as recordAvatarProfileRow,
} from '../lib/profileAvatarColumn';
import { isAdminRole } from '../lib/roles';

// Only actually writes once profiles.avatar_url is confirmed to exist
// (learned for free from getStaffProfiles's select('*') below) — the same
// "confirm before touching" rule as findProfileByEmail/persistStaffEmail.
// persistAvatarRemote itself has no such gate (it's table-agnostic, so it
// can't know this on its own), which meant every Edit Staff save, Add
// Staff Member, and Register Admin fired a real request against a column
// that's never existed on this project's database — this wrapper is what
// every call site below uses instead of calling persistAvatarRemote directly.
function maybePersistAvatarRemote(id, avatarDataUrl) {
  if (isAvatarColumnKnownPresent()) {
    persistAvatarRemote('profiles', id, avatarDataUrl);
  }
}

// trash: false -> active (non-deleted) people, true -> the trash list. The
// database is never asked about is_deleted at all — every profile is
// fetched, then split into active/trash locally using trashStore.js, so
// there's no column for this to depend on and nothing that can 400.
//
// roleGroup: 'admin' -> only role === 'admin'; 'staff' -> everyone else
// (role !== 'admin', which also catches any other non-admin label like
// 'librarian', or a missing role). This is what keeps the Manage Staff and
// Admin Registration pages from showing each other's people — 'admin' is
// the one role the rest of the app ever treats specially (route gating,
// self-escalation checks), so "not admin" is the correct definition of
// "staff" here rather than a literal string match.
//
// select('*') rather than an explicit column list: '*' always succeeds
// regardless of which optional columns (email, phone) exist, and its shape
// doubles as how the app learns whether those columns exist at all — see
// staffContactColumns.js, which findProfileByEmail below reads from so it
// never has to fire a request that's guaranteed to 400.
export async function getStaffProfiles({ trash = false, roleGroup } = {}) {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });

  if (error) throw error;
  if (data?.[0]) {
    recordProfileRow(data[0]);
    recordAvatarProfileRow(data[0]);
  }

  return (data ?? [])
    .filter((row) => isTrashed(row.id) === trash)
    .filter((row) => {
      if (!roleGroup) return true;
      return roleGroup === 'admin' ? isAdminRole(row.role) : !isAdminRole(row.role);
    })
    .map((row) => {
      // Backfills the local avatar cache from profiles.avatar_url (select
      // '*' above returns it for free if the column exists) — this is what
      // makes a staff/admin's picture reappear in this table even on a
      // browser that never uploaded it, or one that just had its storage
      // cleared. See avatarStore.js.
      hydrateAvatarFromRow(row);
      return {
        ...row,
        avatar_url: getAvatar(row.id),
        active: !isInactive(row.id),
        // Real column value wins when present; otherwise fall back to
        // whatever was saved locally (see staffEmailStore.js) — this is
        // what lets Reset Password find an email on a database that has no
        // profiles.email column at all.
        email: row.email || getStaffEmail(row.id),
      };
    });
}

export async function inviteStaff({ email, fullName, role }) {
  const { data, error } = await supabase.functions.invoke('invite-staff', {
    body: { email, fullName, role },
  });

  if (error) throw error;
  return data;
}

// Looks up an existing profile by email so we can update it instead of
// attempting to create a duplicate account. Only actually queries once the
// email column is *confirmed* to exist (learned for free from
// getStaffProfiles's select('*')) — not merely "not yet confirmed
// missing". Those are different states: right after a fresh page load, or
// if the very first profiles fetch happened to return zero rows, nothing
// has recorded either way yet, and treating that "unknown" as "assume it
// exists" is exactly what let this filter (.eq('email', ...), which
// references the column directly) fire for real and 400 — confirmed live,
// this project's profiles table has never had an email column. Requiring
// positive confirmation before ever touching the column directly makes
// that 400 structurally impossible now, rather than just caught after the
// fact; the 42703/PGRST204 handling below is a second line of defense for
// the one case that can still legitimately reach it (the column existed
// when confirmed, then was dropped mid-session).
async function findProfileByEmail(email) {
  if (!isEmailColumnKnownPresent()) return { emailColumnExists: false, existing: null };

  const { data, error } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();

  if (error) {
    if (error.code === '42703' || error.code === 'PGRST204') {
      recordEmailColumnMissing();
      return { emailColumnExists: false, existing: null };
    }
    throw error;
  }

  return { emailColumnExists: true, existing: data };
}

// Both create paths below accept an optional avatarDataUrl. Once the
// profile row itself is saved, the picture is written straight to
// localStorage under that row's id (see avatarStore.js) — that write can
// never 400, and every synchronous getAvatar() call site elsewhere in the
// app depends on it happening immediately, not after a round trip. It's
// then also persisted to profiles.avatar_url via persistAvatarRemote,
// fire-and-forget: that call silently no-ops if the column doesn't exist
// yet (supabase/profile_avatar_schema.sql not run) and never throws, so it
// can't turn an otherwise-successful save into an error.

// Shared insert/update logic behind a profiles-only directory entry (no
// login) — used directly by createStaffAccount, and reused by
// registerAdmin below as its fallback when a real login can't be created
// (rate limited) so the person's details aren't lost.
//
// email is deliberately NOT included in either payload below — the insert/
// update only ever carries the columns confirmed to exist. Saving the
// address itself is delegated entirely to persistStaffEmail (defined
// further down, hoisted so it's callable from here), which tries the real
// profiles.email column and, regardless of whether that column exists,
// always writes the address to staffEmailStore.js too. That local fallback
// is what StaffTable's Email column and Reset Password actually read from
// — without this call, an email typed into Add Staff Member or Register
// Admin was silently dropped on any database missing profiles.email
// (confirmed missing here), never saved anywhere at all.
async function upsertDirectoryEntry({ fullName, email, role, phone, avatarDataUrl, existing, emailColumnExists }) {
  if (existing) {
    const payload = emailColumnExists
      ? { full_name: fullName, role, phone: phone || null }
      : { full_name: fullName, role };

    const { error } = await supabase.from('profiles').update(payload).eq('id', existing.id);
    if (error) throw error;

    const emailSaved = await persistStaffEmail(existing.id, email);

    if (avatarDataUrl) {
      setAvatar(existing.id, avatarDataUrl);
      maybePersistAvatarRemote(existing.id, avatarDataUrl);
    }
    return { id: existing.id, updatedExisting: true, emailSaved };
  }

  // profiles.id normally has to reference a real auth.users row (foreign
  // key). Since no auth account is created here, that constraint has to be
  // dropped on the database side — see the SQL note wherever this is
  // called from — or this insert fails with a foreign key violation no
  // matter what id is used.
  const id = crypto.randomUUID();
  const payload = emailColumnExists
    ? { id, full_name: fullName, email, phone: phone || null, role }
    : { id, full_name: fullName, role };

  const { error } = await supabase.from('profiles').insert(payload);
  if (error) throw error;

  // Already included in the insert payload above when the column exists —
  // this still runs either way, since it's also what writes the local
  // fallback; persistStaffEmail's own update is a harmless no-op re-write
  // in that case, not a duplicate insert.
  const emailSaved = await persistStaffEmail(id, email);

  if (avatarDataUrl) {
    setAvatar(id, avatarDataUrl);
    maybePersistAvatarRemote(id, avatarDataUrl);
  }
  return { id, updatedExisting: false, emailSaved };
}

// Shared by createStaffAccount and registerAdmin below — both need to
// create a REAL Supabase Auth login for a brand-new email, then assign the
// role the admin actually picked, with the same rate-limit safety net
// either way. Only reachable from the admin-gated Manage Staff / Admin
// Registration pages — signUp() itself has no concept of caller
// permissions, so that route-level gate is what actually keeps this from
// being public self-service.
//
// Uses a separate client (see tempAuthClient.js) for the signUp() call —
// NOT the app's shared client. auth.signUp() always signs in as the
// account it creates on whatever client calls it; running it here, on an
// isolated client with persistSession/autoRefreshToken: false, is what
// keeps the acting admin's own session on the shared client untouched.
// The trade-off: Supabase logs a one-time "Multiple GoTrueClient
// instances" console warning for the life of the tab, since two real
// client instances do exist at once — cosmetic, and the accepted cost of
// not signing the admin out. tempAuthClient.js creates that second client
// lazily, once, and reuses it for every call here, so this warning fires
// once per tab rather than once per registration attempt.
//
// The new account always starts as 'staff' via the on_auth_user_created
// trigger — nothing in the signUp() call itself can set any other role
// directly, because the trigger deliberately never trusts a
// client-supplied role (that's what stops someone from self-escalating by
// calling signUp() directly with crafted metadata, bypassing this UI
// entirely). Immediately after, this sets the actually-requested role as a
// separate step — on the shared `supabase` client, i.e. running as the
// ACTING ADMIN'S OWN already-authenticated session, not as anything
// supplied by the signup request. That's gated by the profiles_update_admin
// RLS policy: only someone who is already an admin can update someone
// else's role, to 'admin' or any other value. Someone bypassing this UI and
// calling auth.signUp() directly still only ever gets 'staff', because they
// have no admin session available to perform this follow-up update with.
async function signUpWithFallback({ fullName, email, password, role, phone, avatarDataUrl, emailColumnExists }) {
  const tempClient = getTempAuthClient();

  const { data: signUpData, error: signUpError } = await tempClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (signUpError) {
    const message = signUpError.message?.toLowerCase() ?? '';
    const isRateLimited =
      signUpError.status === 429 ||
      message.includes('rate limit') ||
      message.includes('you can only request this after');

    if (isRateLimited) {
      // Supabase won't let a real login be created right now — rather than
      // lose everything typed into the form, fall back to a directory-only
      // entry (see upsertDirectoryEntry). loginCreated: false tells the
      // caller to be upfront that this person can't sign in yet — Invite
      // via Email (once its Edge Function is deployed), or retrying this
      // once the rate limit clears, is what actually grants access; this
      // never pretends a login exists when it doesn't.
      const fallbackResult = await upsertDirectoryEntry({
        fullName,
        email,
        role,
        phone,
        avatarDataUrl,
        existing: null,
        emailColumnExists,
      });
      // Surfaces Supabase's own wording rather than a generic canned
      // message — "email rate limit exceeded" (a project-wide outgoing
      // email quota, tied to email confirmation being on) and "request
      // this after Ns" (a per-identity throttle) are different problems
      // with different fixes, and only Supabase's own message actually
      // says which one this is.
      return {
        success: true,
        loginCreated: false,
        rateLimited: true,
        rateLimitMessage: signUpError.message,
        emailSaved: fallbackResult.emailSaved,
      };
    }

    throw signUpError;
  }

  const user = signUpData.user;
  if (!user) throw new Error('Registration did not return a user.');

  // Same anti-enumeration behavior as upsertDirectoryEntry: a look-alike
  // "success" with no error when the email already has an auth account but
  // no matching profile (an orphan from an earlier attempt).
  if (!user.identities || user.identities.length === 0) {
    throw new Error(
      `An account with ${email} already exists in Supabase Auth but has no matching profile. Check Authentication → Users in the Supabase dashboard for that account.`
    );
  }

  const rolePayload = emailColumnExists ? { role, phone: phone || null } : { role };
  const { error: roleError } = await supabase.from('profiles').update(rolePayload).eq('id', user.id);

  // Same gap this whole function is otherwise careful about: the role-set
  // step above never touches profiles.email (it wasn't in rolePayload to
  // begin with), so without this call a freshly-registered account would
  // have a real login but still show no email anywhere in the Manage Staff
  // table — persistStaffEmail is what writes it to profiles.email (if that
  // column exists) and to the local fallback either way.
  const emailSaved = await persistStaffEmail(user.id, email);

  if (avatarDataUrl) {
    setAvatar(user.id, avatarDataUrl);
    maybePersistAvatarRemote(user.id, avatarDataUrl);
  }

  // The login itself is already fully created and working at this point —
  // a failure here only means the role-set step didn't take (it stays
  // 'staff', the trigger's default), not that registration failed.
  // Surfaced distinctly so the caller can tell the admin to set the role
  // manually via Edit instead of masking it as a full success or failure.
  return { success: true, loginCreated: true, roleAssigned: !roleError, emailSaved };
}

// Creates a real Supabase Auth login for a new staff/librarian account (via
// signUpWithFallback above), or updates an existing directory-only entry in
// place if this email already has one. Falls back to a login-less
// directory entry only if Supabase's signup rate limit is hit right now —
// see signUpWithFallback's own comment for why, and for how a caller tells
// the two outcomes apart (result.loginCreated).
export async function createStaffAccount({ fullName, email, password, role, phone, avatarDataUrl }) {
  const { emailColumnExists, existing } = await findProfileByEmail(email);

  if (existing) {
    const result = await upsertDirectoryEntry({ fullName, email, role, phone, avatarDataUrl, existing, emailColumnExists });
    return { success: true, updatedExisting: result.updatedExisting, emailSaved: result.emailSaved };
  }

  return signUpWithFallback({ fullName, email, password, role, phone, avatarDataUrl, emailColumnExists });
}

// Same shape as createStaffAccount above, hardcoded to role: 'admin'.
export async function registerAdmin({ fullName, email, password, phone, avatarDataUrl }) {
  const { emailColumnExists, existing } = await findProfileByEmail(email);

  if (existing) {
    const result = await upsertDirectoryEntry({
      fullName,
      email,
      role: 'admin',
      phone,
      avatarDataUrl,
      existing,
      emailColumnExists,
    });
    return { success: true, updatedExisting: result.updatedExisting, emailSaved: result.emailSaved };
  }

  const result = await signUpWithFallback({ fullName, email, password, role: 'admin', phone, avatarDataUrl, emailColumnExists });
  if (!result.loginCreated) return result;

  // promotedToAdmin is what AdminRegistrationPage.jsx's toast logic reads —
  // kept as its own name here (rather than the generic roleAssigned) since
  // "admin" is implied by which function this is.
  return { success: true, loginCreated: true, promotedToAdmin: result.roleAssigned, emailSaved: result.emailSaved };
}

// Shared by updateStaffProfile and saveStaffEmail below. Tries the real
// profiles.email column first (same graceful-degrade dance as
// findProfileByEmail/upsertDirectoryEntry: only actually attempt the write
// once the column is *confirmed* present, not just "not yet confirmed
// missing" — see the note on findProfileByEmail for why that distinction
// is what keeps this from firing a request that's guaranteed to 400 the
// first time it's ever called in a session). Either way, the address is
// also always written to staffEmailStore.js — that's what makes it
// survive a refresh and what Reset Password reads back, regardless of
// whether the database column actually exists. Returns whether the real
// column save went through, so callers can tell the admin when it didn't
// rather than pretending it did.
async function persistStaffEmail(id, email) {
  let emailSaved = false;

  if (email && isEmailColumnKnownPresent()) {
    const { error } = await supabase.from('profiles').update({ email }).eq('id', id);
    if (error) {
      // 42703 (raw Postgres "column does not exist") and PGRST204
      // (PostgREST's own "not in the schema cache" code for an update/
      // insert payload) both mean the same thing here — this update shape
      // specifically surfaces PGRST204 on this project, which the earlier
      // version of this function didn't check, so a missing column here
      // threw and failed the *entire* Edit Staff save, not just the email
      // part. Every other missing-column update in this codebase
      // (InventoryPage, loanService, activityLogService) already checks
      // both codes — this brings persistStaffEmail in line with that.
      if (error.code === '42703' || error.code === 'PGRST204') {
        recordEmailColumnMissing();
      } else if (error.code === '23505') {
        // Real failure, not a missing-column case — profiles.email exists
        // and has a uniqueness constraint, and this address belongs to
        // another row already. Surfaced as a specific, actionable message
        // instead of Postgres's raw "duplicate key value violates unique
        // constraint ..." text.
        throw new Error('This email address is already used by another staff or admin account.');
      } else {
        throw error;
      }
    } else {
      emailSaved = true;
    }
  }

  setLocalStaffEmail(id, email || null);
  return emailSaved;
}

// avatarDataUrl is saved straight to localStorage (synchronous, can't
// fail) and, best-effort, to profiles.avatar_url (see persistAvatarRemote
// in avatarStore.js). Passing through whatever the modal held (changed or
// not) keeps an untouched picture exactly as it was, since it was
// pre-filled from the same store.
//
// active is never sent to Supabase either — profiles has no status column,
// so it's tracked the same way Trash is: locally, per-browser, via
// staffStatusStore.js. It does not revoke this person's login.
export async function updateStaffProfile(id, { fullName, role, email, active = true, avatarDataUrl }) {
  const { error } = await supabase.from('profiles').update({ full_name: fullName, role }).eq('id', id);
  if (error) throw error;

  const emailSaved = await persistStaffEmail(id, email);

  setAvatar(id, avatarDataUrl);
  maybePersistAvatarRemote(id, avatarDataUrl);
  if (active) markActive(id);
  else markInactive(id);

  return { emailSaved };
}

// Table/badge-level quick toggle — same local status as the Status field
// inside Edit Staff, exposed separately so the table doesn't have to open
// the modal just to flip Active/Inactive.
export async function setStaffActive(id, active) {
  if (active) markActive(id);
  else markInactive(id);
}

// Standalone email save, used by the Reset Password "no email on file yet"
// prompt so it doesn't have to go through a full Edit Staff submission just
// to record one field.
export async function saveStaffEmail(id, email) {
  const emailSaved = await persistStaffEmail(id, email);
  return { emailSaved };
}

// Sends Supabase's real "forgot password" email — the same flow a staff
// member would trigger themselves from a login page, just kicked off by an
// admin instead. This is a standard anon-key-callable Auth method (unlike
// an admin-forced password change, which needs the Admin API and therefore
// service_role — not available here, see supabaseClient.js), so it works
// directly from this client with no Edge Function needed. Requires knowing
// the person's real Supabase Auth login email; profiles.email (if present,
// real column or local fallback) is only ever a directory copy typed in by
// an admin, so if it's stale the email goes nowhere useful — callers should
// warn for that rather than claim success blindly.
export async function resetStaffPassword(email) {
  if (!email) {
    throw new Error(
      'No email on file for this account — add one via Edit, or trigger the reset directly from Authentication → Users in the Supabase dashboard.'
    );
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// Soft delete: moves the person to Trash entirely on this browser (see
// trashStore.js) — their row in the database is untouched, so no update
// request is ever sent and nothing can 400 for a missing column. Their
// name, role, and (via avatarStore, keyed by this same id) their picture
// are all still intact and can be brought back with restoreStaffProfile.
export async function deleteStaffProfile(id) {
  markTrashed(id);
}

// Moves a trashed person back into the active Staff/Admin list — purely a
// local trashStore update, same as above.
export async function restoreStaffProfile(id) {
  unmarkTrashed(id);
}

// The real, irreversible delete — only ever reachable from the Trash view.
// This is the one trash action that does hit the database, since "deleted"
// has to actually mean gone. Revokes access to admin-gated features (those
// all check profiles.role, which this deletes) but does NOT remove their
// login from Supabase Auth — that requires the Admin API (service_role),
// which only an Edge Function can reach. If you need their login gone too,
// remove them from Authentication → Users in the Supabase dashboard directly.
export async function permanentlyDeleteStaffProfile(id) {
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) throw error;
  setAvatar(id, null);
  setLocalStaffEmail(id, null);
  unmarkTrashed(id);
  markActive(id); // clears any leftover Inactive flag for this id
}
