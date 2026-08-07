import { KeyRound, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { isAdminRole } from '../../lib/roles';
import Avatar from '../ui/Avatar';

function columnsFor(view) {
  return view === 'active'
    ? ['Full Name', 'Role', 'Status', 'Added On', 'Actions']
    : ['Full Name', 'Role', 'Added On', 'Actions'];
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function formatRole(role) {
  if (!role) return 'Staff';
  if (isAdminRole(role)) return 'Super Admin';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function SkeletonRow({ columns }) {
  return (
    <tr>
      {columns.map((column) => (
        <td key={column} className="px-6 py-4">
          <div className="h-4 w-full max-w-[8rem] animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  );
}

export default function StaffTable({
  staff,
  loading,
  view = 'active',
  onEdit,
  onDelete,
  onRestore,
  onPermanentDelete,
  onToggleStatus,
  onResetPassword,
}) {
  const columns = columnsFor(view);

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((heading) => (
                <th
                  key={heading}
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} columns={columns} />)}

            {!loading && staff.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-slate-500">
                  {view === 'trash' ? 'Trash is empty.' : 'No staff members yet.'}
                </td>
              </tr>
            )}

            {!loading &&
              staff.map((person) => (
                <tr key={person.id} className="transition-colors hover:bg-primary-50/40">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={person.avatar_url} fullName={person.full_name} className="h-8 w-8 text-xs" />
                      <span className="text-sm font-medium text-slate-900">
                        {person.full_name ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        isAdminRole(person.role)
                          ? 'bg-primary-600 text-white'
                          : 'bg-primary-50 text-primary-700'
                      }`}
                    >
                      {formatRole(person.role)}
                    </span>
                  </td>
                  {view === 'active' && (
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => onToggleStatus(person)}
                        title={person.active ? 'Click to mark Inactive' : 'Click to mark Active'}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          person.active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${person.active ? 'bg-green-600' : 'bg-slate-400'}`}
                        />
                        {person.active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4 text-sm text-slate-600">{formatDate(person.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {view === 'active' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(person)}
                            title="Edit"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onResetPassword(person)}
                            title="Reset Password"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(person)}
                            title="Delete"
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onRestore(person)}
                            title="Restore"
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => onPermanentDelete(person)}
                            title="Delete Permanently"
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Permanently
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
