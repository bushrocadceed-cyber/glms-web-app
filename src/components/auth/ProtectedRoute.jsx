import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAdminRole } from '../../lib/roles';

/**
 * Wraps a route (or nested routes) behind login, and optionally behind a role.
 * <ProtectedRoute />            -> any logged-in user (Admin or Staff)
 * <ProtectedRoute role="admin" /> -> logged-in AND profile.role is admin
 */
export default function ProtectedRoute({ role }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Shows the account's actual current role in the quotes below (rather
  // than just bouncing back to the dashboard with no explanation) so a
  // role mismatch — wrong test account, or a value that slipped in from a
  // hand-run SQL update — is visible immediately, without needing dev
  // tools or a database query to diagnose. Distinguishes "profile never
  // loaded at all" (almost always an RLS SELECT problem — see the console,
  // fetchProfileRow logs the exact reason) from "profile loaded fine but
  // role is empty" (a data problem: the row's role column itself is blank).
  //
  // Also dumps the raw values on screen and offers a real hard reload
  // (window.location.reload — a genuine fresh fetch of the JS bundle, not
  // a client-side route change like signing out and back in does). That
  // distinction matters: this screen only exists because "log out, log
  // back in" alone didn't clear a previous version of this same error —
  // which is exactly what you'd see if the browser tab were still running
  // JS from before a fix, since in-app navigation never re-fetches it.
  if (role === 'admin' && !isAdminRole(profile?.role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Admin access required</h1>
        {profile ? (
          <p className="max-w-sm text-sm text-slate-500">
            This page is only available to Admin accounts. This account's current role is{' '}
            <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-700">
              {profile.role ? `"${profile.role}"` : 'not set'}
            </code>
            .
          </p>
        ) : (
          <p className="max-w-sm text-sm text-slate-500">
            Your profile couldn't be loaded at all — this usually means the database is blocking the
            read (a Row Level Security policy issue), not that your role is wrong. Check the browser
            console for the exact reason.
          </p>
        )}

        <div className="w-full max-w-sm rounded-lg bg-slate-100 p-3 text-left font-mono text-xs text-slate-600">
          <p>user.id: {user.id || '(none)'}</p>
          <p>user.email: {user.email || '(none)'}</p>
          <p>profile: {profile ? JSON.stringify(profile) : 'null'}</p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Hard Reload This Page
        </button>
        <p className="max-w-sm text-xs text-slate-400">
          This does a real fresh reload — different from signing out and back in, which only changes
          the app's state without fetching new code. Try this before anything else.
        </p>

        <Link to="/" className="text-sm font-medium text-primary-600 hover:text-primary-700">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return <Outlet />;
}
