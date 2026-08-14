import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import LibraryIllustration from '../components/illustrations/LibraryIllustration';

const currentYear = new Date().getFullYear();

export default function LoginPage() {
  const { signIn } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Select Role is now actually enforced (see AuthContext's signIn) — the
  // account still authenticates by email/password like any login, but
  // signIn re-signs the session out if profiles.role doesn't match what
  // was picked here, rather than silently accepting any role selection.
  // No "Member" option: members are patron records with no auth.users
  // account at all (see MemberFormModal.jsx), so there is no login that
  // could ever satisfy that selection — offering it here would just be
  // another way to get a confusing "invalid" error for something that was
  // never going to work.
  const [role, setRole] = useState('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password, role);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleForgotPassword() {
    showToast('Password reset isn’t available yet — contact an admin.', 'error');
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left: form panel */}
      <div className="flex w-full flex-col px-6 py-10 sm:px-12 lg:w-1/2 lg:px-20 lg:py-14">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight text-slate-900">Galkio Library</p>
              <p className="text-xs font-medium leading-tight text-slate-500">
                Management System
              </p>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Welcome Back!</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your account</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Select Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              >
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email Address</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600"
                />
                Remember Me
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Forgot password?
              </button>
            </div>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Login'}
            </button>
          </form>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          © {currentYear} Galkio Library Management System. All rights reserved.
        </p>
      </div>

      {/* Right: illustration panel */}
      <div className="hidden items-center justify-center bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 lg:flex lg:w-1/2">
        <LibraryIllustration className="w-full max-w-lg p-12" />
      </div>
    </div>
  );
}
