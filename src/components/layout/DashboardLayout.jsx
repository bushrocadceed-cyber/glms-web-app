import { useEffect, useRef, useState } from 'react';
import { LogOut, Menu, Moon, Settings, Sun } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import GlobalSearch from './GlobalSearch';
import NotificationsPanel from './NotificationsPanel';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Avatar from '../ui/Avatar';

const PAGE_META = {
  '/': { title: 'Dashboard', subtitle: "Welcome back — here's your library at a glance." },
  '/inventory': {
    title: 'Books',
    subtitle: 'Add new titles and manage your existing book catalog.',
  },
  '/loans': { title: 'Loans', subtitle: 'Check out and return books.' },
  '/members': { title: 'Members', subtitle: 'Manage registered library members.' },
  '/reports': { title: 'Reports', subtitle: 'Loans and inventory at a glance.' },
  '/staff': { title: 'Manage Staff', subtitle: 'Invite and review Admin/Staff accounts.' },
  '/admin-registration': {
    title: 'Admin Registration',
    subtitle: 'Register new admin logins and manage everyone with dashboard access.',
  },
  '/settings': { title: 'Settings', subtitle: 'Your account details.' },
};

function ProfileMenu({ profile, signOut }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!profile) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-primary-700"
      >
        <Avatar
          src={profile.avatar_url}
          fullName={profile.full_name}
          className="h-9 w-9 text-sm ring-2 ring-primary-300"
        />
        <div className="hidden text-left lg:block">
          <p className="text-sm font-medium text-white">{profile.full_name ?? 'Account'}</p>
          <p className="text-xs capitalize text-primary-200">{profile.role}</p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-lg bg-white py-1 shadow-xl ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => {
              navigate('/settings');
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" />
            Profile Settings
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const meta = PAGE_META[pathname] ?? PAGE_META['/'];

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Belt-and-suspenders alongside each NavLink's own onClick: catches any
  // navigation that doesn't go through a link click directly (e.g. a
  // redirect), so the drawer never gets left open over the new page.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar open={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 bg-primary px-4 py-4 shadow-sm sm:px-6 sm:py-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              title="Open menu"
              className="-ml-1 shrink-0 rounded-lg p-2 text-primary-200 hover:bg-primary-700 hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-white sm:text-xl">{meta.title}</h1>
              <p className="hidden truncate text-sm text-primary-200 sm:block">{meta.subtitle}</p>
            </div>
          </div>

          <div className="hidden flex-1 justify-center md:flex">
            <GlobalSearch />
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <NotificationsPanel />

            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex items-center justify-center rounded-lg p-2.5 text-primary-200 hover:bg-primary-700 hover:text-white"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <ProfileMenu profile={profile} signOut={signOut} />
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
