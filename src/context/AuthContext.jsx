import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getAvatar, hydrateAvatarFromRow, persistAvatarRemote, setAvatar } from '../lib/avatarStore';
import { isAvatarColumnKnownPresent, recordProfileRow as recordAvatarProfileRow } from '../lib/profileAvatarColumn';
import { isAdminRole } from '../lib/roles';

const AuthContext = createContext(null);

// select('*') rather than an explicit column list: '*' always succeeds
// regardless of which optional columns (avatar_url) exist, and its shape
// doubles as how the app learns whether avatar_url exists at all — see
// profileAvatarColumn.js, which updateAvatar below reads from so it never
// has to fire a request that's guaranteed to 400. An earlier version of
// this used an explicit column list that optimistically included
// avatar_url on the first call of every fresh page load (the "known
// missing" cache resets on every reload) and only self-corrected after
// that first request had already failed for real — this runs on every
// single page in the app via loadProfile below, so that was a guaranteed
// 400 on every fresh session. select('*') removes the failure mode
// entirely rather than just recovering from it faster.
//
// Logs loudly on any failure to load — an earlier version of this
// silently returned null on any error "for a clean console," which made
// sense when the only expected failure was a benign missing-column case.
// It also hid a genuine RLS misconfiguration (a signed-in user unable to
// read their own row) as an indistinguishable "profile is null," with
// nothing in the console to point at the actual cause. Never silence a
// real failure just to keep the console quiet.
async function fetchProfileRow(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId);

  if (error) {
    console.error(
      `Failed to load profile for user ${userId} — likely a Row Level Security issue on 'profiles'. ` +
        'Check: select * from pg_policies where tablename = \'profiles\';',
      error
    );
    return null;
  }

  if (!data || data.length === 0) {
    console.error(
      `No profile row came back for user ${userId}, with no error either — this means Row Level ` +
        "Security is silently filtering it out (the row exists, but the current session's SELECT " +
        "policy doesn't match it). Check: select * from pg_policies where tablename = 'profiles';"
    );
    return null;
  }

  recordAvatarProfileRow(data[0]);
  return data[0];
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profileRow, setProfileRow] = useState(null);
  // The picture itself lives entirely in localStorage (see avatarStore.js)
  // — this is just the in-memory mirror of that so the header/sidebar/
  // profile page re-render the instant it changes.
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile(currentUser) {
      if (!currentUser) {
        if (isMounted) {
          setProfileRow(null);
          setAvatarUrl(null);
        }
        return;
      }

      try {
        // Best-effort: role-gated UI (admin-only actions, Manage Staff)
        // reads `profile` when it's there, but its absence never blocks
        // login or the rest of the app. fetchProfileRow already logs the
        // specific reason to the console on any failure — this only
        // handles something going wrong outside that function itself.
        const row = await fetchProfileRow(currentUser.id);
        // Backfills the local avatar cache from the database's avatar_url,
        // if present and different — this is what makes this user's own
        // picture reappear after a cleared browser, right at login, rather
        // than only ever being visible on the browser that uploaded it.
        hydrateAvatarFromRow(row);
        if (isMounted) {
          setProfileRow(row);
          setAvatarUrl(getAvatar(currentUser.id));
        }
      } catch (err) {
        console.error('Unexpected error while loading profile:', err);
        if (isMounted) {
          setProfileRow(null);
          setAvatarUrl(null);
        }
      }
    }

    // Everything here is wrapped in try/catch/finally so setLoading(false)
    // always runs no matter what fails (bad session, network error, missing
    // profile row) — otherwise ProtectedRoute's "Loading…" screen would be
    // stuck forever with no way to recover.
    async function init() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!isMounted) return;
        setUser(session?.user ?? null);
        await loadProfile(session?.user ?? null);
      } catch {
        if (isMounted) {
          setUser(null);
          setProfileRow(null);
          setAvatarUrl(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      loadProfile(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // expectedRole is the Login page's "Select Role" dropdown value
  // ('admin' or 'staff') — optional so nothing else calling signIn (there
  // isn't currently, but nothing should have to) is forced to pass one.
  // Password auth alone only proves *who* someone is, not that they picked
  // the right option in that dropdown — this is what actually enforces the
  // match, by re-signing-out immediately if the account's real
  // profiles.role disagrees with what was selected, rather than letting a
  // Staff account into a session someone thinks they started as Admin (or
  // the reverse).
  async function signIn(email, password, expectedRole) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    if (!expectedRole) return;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      throw new Error("Could not verify this account's role. Contact an admin.");
    }

    const isAdmin = isAdminRole(profile.role);
    const wantsAdmin = expectedRole === 'admin';

    if (isAdmin !== wantsAdmin) {
      await supabase.auth.signOut();
      throw new Error(
        `This account is registered as ${isAdmin ? 'an Admin' : 'Staff'}, not ${
          wantsAdmin ? 'an Admin' : 'Staff'
        }. Select the correct role and sign in again.`
      );
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  // Re-reads this user's own profile row and updates it in context — used
  // after saving profile changes so the header/sidebar refresh immediately
  // without a full page reload.
  async function refreshProfile() {
    if (!user) return;
    const row = await fetchProfileRow(user.id);
    setProfileRow(row);
  }

  // Self-service name edit only — role changes stay gated behind Manage
  // Staff, deliberately not exposed here.
  async function updateProfile(updates) {
    if (!user) throw new Error('Not signed in.');
    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    if (error) throw error;
    await refreshProfile();
  }

  // Updates local state + the localStorage cache synchronously (so the
  // header/sidebar/profile page re-render immediately, no network wait),
  // then — only once profiles.avatar_url is confirmed to exist — persists
  // the same picture there in the background. See avatarStore.js for why
  // this is a fire-and-forget best-effort call rather than something this
  // function awaits or throws from: a slow or failed remote write should
  // never block what the user actually sees happen, which is the picture
  // changing right away. The isAvatarColumnKnownPresent() guard is what
  // stops this from firing a request that's guaranteed to 400 on a
  // database where that column doesn't exist yet.
  async function updateAvatar(dataUrl) {
    if (!user) throw new Error('Not signed in.');
    setAvatarUrl(dataUrl);
    setAvatar(user.id, dataUrl);
    if (isAvatarColumnKnownPresent()) {
      persistAvatarRemote('profiles', user.id, dataUrl);
    }
  }

  // Supabase's updateUser() has no concept of a "current password" — it
  // will happily set a new one for whoever holds the current session
  // token, verified or not. Re-authenticating with signInWithPassword
  // first is what actually makes the Current Password field mean
  // something (e.g. stops someone at an already-logged-in, unattended
  // browser from silently locking the real owner out). Both calls use the
  // same anon-key client as everywhere else in this app — no service_role
  // needed, since a user changing their own password is exactly what this
  // method is meant for.
  async function changePassword(currentPassword, newPassword) {
    if (!user?.email) throw new Error('Not signed in.');

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) throw new Error('Current password is incorrect.');

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  const profile = useMemo(() => {
    if (!profileRow) return null;
    return { ...profileRow, avatar_url: avatarUrl };
  }, [profileRow, avatarUrl]);

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signIn, signOut, updateProfile, updateAvatar, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
