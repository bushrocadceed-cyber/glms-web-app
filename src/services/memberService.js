import { supabase } from '../lib/supabaseClient';
import { setAvatar } from '../lib/avatarStore';
import { isTrashed, markTrashed, unmarkTrashed } from '../lib/memberTrashStore';

// Unfiltered on purpose — active/trash splitting happens client-side (see
// useMembers.js), the same way Staff/Admin does it, so this one fetch can
// back both the active list and the Trash count at once instead of two
// separate round-trips.
export async function getMembers() {
  const { data, error } = await supabase
    .from('members')
    .select('id, full_name, email, phone, membership_date')
    .order('membership_date', { ascending: false });

  if (error) throw error;
  return data;
}

// PostgREST's .or() builds a raw filter string where commas and
// parentheses are syntax-significant — strip them out of user-typed search
// terms so an odd character never turns into a malformed filter.
function sanitizeSearchTerm(term) {
  return term.replace(/[(),]/g, '').trim();
}

// Postgres reports a unique-constraint violation as code 23505 (HTTP 409)
// — this only ever fires here for email/phone, the two columns members has
// a uniqueness rule on. The raw message ("duplicate key value violates
// unique constraint \"members_email_key\"") is accurate but not something
// to show someone filling out a form, so it's translated into the actual
// field at fault (parsed from Postgres's own `details`, e.g.
// "Key (email)=(x@example.com) already exists.") before this ever reaches
// the UI.
function isDuplicateConstraintError(err) {
  return err?.code === '23505';
}

function duplicateMemberMessage(err) {
  const field = err?.details?.match(/Key \((\w+)\)=/)?.[1];
  if (field === 'email') return 'A member with this email already exists.';
  if (field === 'phone') return 'A member with this phone number already exists.';
  return 'A member with this email or phone number already exists.';
}

export async function searchMembers(term) {
  const safeTerm = sanitizeSearchTerm(term);
  if (!safeTerm) return [];

  const { data, error } = await supabase
    .from('members')
    .select('id, full_name, email, phone')
    .or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%`)
    .limit(5);

  if (error) throw error;
  // A trashed member showing up in global search would suggest they're
  // still active — filtered out here for the same reason the Members page
  // hides them outside the Trash tab.
  return (data ?? []).filter((member) => !isTrashed(member.id));
}

export async function createMember(member) {
  const { data, error } = await supabase
    .from('members')
    .insert({ ...member, membership_date: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    if (isDuplicateConstraintError(error)) throw new Error(duplicateMemberMessage(error));
    throw error;
  }
  return data;
}

export async function updateMember(id, updates) {
  const { data, error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (isDuplicateConstraintError(error)) throw new Error(duplicateMemberMessage(error));
    throw error;
  }
  return data;
}

// Soft delete: moves the member to Trash on this browser — their row in
// the database is untouched, so no request is ever sent and nothing can
// 400 for a missing column. Their details and (via avatarStore, keyed by
// this same id) their picture are all still intact and come back exactly
// as they were with restoreMember.
export async function deleteMember(id) {
  markTrashed(id);
}

// Moves a trashed member back into the active list — purely a local
// trashStore update, same as above.
export async function restoreMember(id) {
  unmarkTrashed(id);
}

// The real, irreversible delete — only ever reachable from the Trash view.
export async function permanentlyDeleteMember(id) {
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw error;
  setAvatar(id, null);
  unmarkTrashed(id);
}
