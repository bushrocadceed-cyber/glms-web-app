import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Package,
  Settings,
  Shield,
  ShieldPlus,
  Users,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Avatar from '../ui/Avatar';

// Always visible to every logged-in user, admin or staff — Manage Staff
// and Admin Registration are still gated to admins at the route level
// (App.jsx) and at the database level (supabase/rls_policies.sql). A
// staff account that clicks in sees a clear "Admin access required"
// message instead of the link just not being there.
const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'Books', icon: Package, to: '/inventory' },
  { label: 'Loans', icon: ArrowLeftRight, to: '/loans' },
  { label: 'Members', icon: Users, to: '/members' },
  { label: 'Manage Staff', icon: Shield, to: '/staff' },
  { label: 'Admin Registration', icon: ShieldPlus, to: '/admin-registration' },
  { label: 'Activity Logs', icon: Activity, to: '/activity-logs' },
  { label: 'Reports', icon: BarChart3, to: '/reports' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];

// On lg+ screens this sits in normal flow, sticky, always visible — same
// as before. Below that, it's an off-canvas drawer: fixed, translated
// out of view until `open`, with a backdrop that closes it on click; each
// nav link also closes it on tap so navigating doesn't leave it open over
// the page underneath.
export default function Sidebar({ open = false, onClose }) {
  const { profile } = useAuth();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-64 shrink-0 transform flex-col bg-primary text-primary-200 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-primary-700 px-6 py-5">
          <BookOpen className="h-6 w-6 text-white" />
          <span className="text-lg font-semibold text-white">GLMS</span>
        </div>

        {profile && (
          <NavLink
            to="/settings"
            onClick={onClose}
            className="flex items-center gap-3 border-b border-primary-700 px-6 py-4 hover:bg-primary-700"
          >
            <Avatar
              src={profile.avatar_url}
              fullName={profile.full_name}
              className="h-10 w-10 text-sm ring-2 ring-primary-300"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{profile.full_name ?? 'Account'}</p>
              <p className="truncate text-xs capitalize text-primary-300">{profile.role}</p>
            </div>
          </NavLink>
        )}

        <nav className="flex-1 space-y-3 px-3 py-4">
          {NAV_ITEMS.map(({ label, icon: Icon, to }) =>
            to ? (
              <NavLink
                key={label}
                to={to}
                end={to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-primary-200 hover:bg-primary-700 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ) : (
              <button
                key={label}
                type="button"
                disabled
                title="Coming soon"
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary-400"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            )
          )}
        </nav>

        <div className="border-t border-primary-700 px-6 py-4 text-xs text-primary-300">
          Library Management System
        </div>
      </aside>
    </>
  );
}
