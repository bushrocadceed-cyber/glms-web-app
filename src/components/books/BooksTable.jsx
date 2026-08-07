import { Eye, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import Badge from '../ui/Badge';

const COLUMNS = ['Title', 'Author', 'ISBN', 'Total Copies', 'Available Copies', 'Status', 'Actions'];

function SkeletonRow() {
  return (
    <tr>
      {COLUMNS.map((column) => (
        <td key={column} className="px-6 py-4">
          <div className="h-4 w-full max-w-[8rem] animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  );
}

export default function BooksTable({ books, loading, mode, isAdmin, onView, onEdit, onDelete, onRestore }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {COLUMNS.map((heading) => (
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
            {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && books.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-10 text-center text-sm text-slate-500">
                  {mode === 'trash'
                    ? 'Trash is empty.'
                    : 'No books found. Add your first book to get started.'}
                </td>
              </tr>
            )}

            {!loading &&
              books.map((book) => {
                const isLowStock = (book.available_copies ?? 0) < 2;

                return (
                  <tr
                    key={book.id}
                    className={`transition-colors ${
                      isLowStock && mode === 'active'
                        ? 'bg-red-50 hover:bg-red-100/60'
                        : 'hover:bg-primary-50/40'
                    }`}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{book.title}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{book.author}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{book.isbn}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{book.total_copies ?? '—'}</td>
                    <td
                      className={`px-6 py-4 text-sm ${
                        isLowStock && mode === 'active' ? 'font-medium text-red-600' : 'text-slate-600'
                      }`}
                    >
                      {book.available_copies ?? '—'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={book.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {mode === 'active' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onView(book)}
                              title="View"
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onEdit(book)}
                              title="Edit"
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => onDelete(book)}
                                title="Delete"
                                className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRestore(book)}
                            title="Restore"
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
