import { Eye, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { getAvatar } from '../../lib/avatarStore';
import Avatar from '../ui/Avatar';

const COLUMNS = ['Full Name', 'Email', 'Phone', 'Membership Date', 'Actions'];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function SkeletonRow() {
  return (
    <tr>
      {COLUMNS.map((column) => (
        <td key={column} className="px-6 py-4">
          <div className="h-4 w-full max-w-[8rem] animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        </td>
      ))}
    </tr>
  );
}

export default function MembersTable({
  members,
  loading,
  view = 'active',
  onView,
  onEdit,
  onDelete,
  onRestore,
  onPermanentDelete,
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
          <thead className="bg-slate-50 dark:bg-slate-900/40">
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
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && members.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  {view === 'trash' ? 'Trash is empty.' : 'No members found.'}
                </td>
              </tr>
            )}

            {!loading &&
              members.map((member) => (
                <tr
                  key={member.id}
                  className="transition-colors hover:bg-primary-50/40 dark:hover:bg-primary-900/20"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={getAvatar(member.id)}
                        fullName={member.full_name}
                        className="h-8 w-8 text-xs"
                      />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">
                        {member.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{member.email}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{member.phone}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {formatDate(member.membership_date)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {view === 'active' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onView(member)}
                            title="View"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-primary-400"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(member)}
                            title="Edit"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-primary-400"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(member)}
                            title="Delete"
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onRestore(member)}
                            title="Restore"
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => onPermanentDelete(member)}
                            title="Delete Permanently"
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
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
