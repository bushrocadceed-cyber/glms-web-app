import { useMemo, useState } from 'react';
import { Activity, Download, Search } from 'lucide-react';
import { useActivityLogs } from '../hooks/useActivityLogs';
import { getAvatar } from '../lib/avatarStore';
import { isAdminRole } from '../lib/roles';
import { exportToCSV } from '../lib/exportToCSV';
import { useToast } from '../context/ToastContext';
import Avatar from '../components/ui/Avatar';

function formatRole(role) {
  if (!role) return 'Unknown';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// Cosmetic label only, same mapping used on Staff/Settings — the raw
// stored value (captured at write time in user_role) stays whatever it
// was, this just renders nicer.
function roleLabel(role) {
  if (isAdminRole(role)) return 'Super Admin';
  return formatRole(role);
}

function roleBadgeClasses(role) {
  if (isAdminRole(role)) return 'bg-primary-600 text-white';
  if (role === 'librarian') return 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
  return 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300';
}

// Actions are free text (whatever callers pass to logUserActivity), not a
// fixed enum — this just keyword-matches common verbs to color the badge
// sensibly without requiring every caller to also specify a category.
function actionBadgeClasses(action) {
  const a = (action || '').toLowerCase();
  if (a.includes('delete') || a.includes('remove') || a.includes('permanent')) {
    return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  }
  if (
    a.includes('add') ||
    a.includes('create') ||
    a.includes('register') ||
    a.includes('issue') ||
    a.includes('check-out') ||
    a.includes('checkout')
  ) {
    return 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400';
  }
  if (a.includes('update') || a.includes('edit') || a.includes('save') || a.includes('renew')) {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  }
  if (a.includes('return')) {
    return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  }
  if (a.includes('password') || a.includes('login') || a.includes('security')) {
    return 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
  }
  return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
}

// e.g. "Jul 25, 2026 at 4:30 PM"
function formatTimestamp(value) {
  if (!value) return '—';
  const date = new Date(value);
  const datePart = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} at ${timePart}`;
}

const COLUMNS = ['User', 'Action', 'Details', 'Timestamp'];

function SkeletonRow() {
  return (
    <tr>
      {COLUMNS.map((column) => (
        <td key={column} className="px-6 py-4">
          <div className="h-4 w-full max-w-[10rem] animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </td>
      ))}
    </tr>
  );
}

export default function ActivityLogsPage() {
  const { logs, tableReady, loading, error, refetch } = useActivityLogs();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const actionOptions = useMemo(
    () => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(),
    [logs]
  );
  const roleOptions = useMemo(
    () => [...new Set(logs.map((log) => log.user_role).filter(Boolean))].sort(),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((log) => {
      const matchesTerm =
        !term ||
        log.user_name?.toLowerCase().includes(term) ||
        log.action?.toLowerCase().includes(term) ||
        log.details?.toLowerCase().includes(term);
      const matchesAction = !actionFilter || log.action === actionFilter;
      const matchesRole = !roleFilter || log.user_role === roleFilter;
      const matchesStart = !startDate || new Date(log.created_at) >= new Date(startDate);
      const matchesEnd = !endDate || new Date(log.created_at) <= new Date(`${endDate}T23:59:59.999`);
      return matchesTerm && matchesAction && matchesRole && matchesStart && matchesEnd;
    });
  }, [logs, search, actionFilter, roleFilter, startDate, endDate]);

  const hasActiveFilters = Boolean(search || actionFilter || roleFilter || startDate || endDate);

  // Exports whatever the search/filters above currently leave visible, not
  // the full unfiltered log — matches how the Reports page exports work.
  function handleExport() {
    const rows = filteredLogs.map((log) => ({
      'User Name': log.user_name ?? '',
      Role: roleLabel(log.user_role),
      Action: log.action ?? '',
      Details: log.details ?? '',
      Timestamp: formatTimestamp(log.created_at),
    }));
    if (!exportToCSV(rows, 'activity-logs.csv')) {
      showToast('No activity log entries to export.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Activity className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            Activity Logs
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Audit trail of key actions performed by admins and staff.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Download className="h-4 w-4" />
          Export to CSV
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          <span>Failed to load activity logs: {error.message}</span>
          <button type="button" onClick={refetch} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !tableReady && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Activity logging isn&apos;t set up yet — ask an admin to run{' '}
          <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/50">
            supabase/activity_logs_schema.sql
          </code>{' '}
          in the Supabase SQL Editor, then reload this page.
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative flex-1 lg:min-w-[16rem]">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Search</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 mt-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, action, or details…"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Action Type
          </label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All Actions</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            User Role
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All Roles</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setActionFilter('');
              setRoleFilter('');
              setStartDate('');
              setEndDate('');
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-slate-700"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/60">
              <tr>
                {COLUMNS.map((heading) => (
                  <th
                    key={heading}
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

              {!loading && tableReady && filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {logs.length === 0 ? 'No activity recorded yet.' : 'No entries match your filters.'}
                  </td>
                </tr>
              )}

              {!loading &&
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-primary-50/40 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={getAvatar(log.user_id)}
                          fullName={log.user_name}
                          className="h-8 w-8 text-xs"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {log.user_name ?? 'Unknown'}
                          </p>
                          <span
                            className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${roleBadgeClasses(log.user_role)}`}
                          >
                            {roleLabel(log.user_role)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${actionBadgeClasses(log.action)}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="max-w-xs px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {log.details || '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {formatTimestamp(log.created_at)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
