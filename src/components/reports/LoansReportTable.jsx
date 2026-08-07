const COLUMNS = ['Book Title', 'Member Name', 'Loan Date', 'Due Date', 'Return Date', 'Status'];

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function getStatus(loan) {
  if (loan.return_date) return { label: 'Returned', className: 'text-slate-600' };
  if (new Date(loan.due_date) < new Date()) {
    return { label: 'Overdue', className: 'font-medium text-red-600' };
  }
  return { label: 'Borrowed', className: 'font-medium text-primary-700' };
}

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

export default function LoansReportTable({ loans, loading }) {
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

            {!loading && loans.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-10 text-center text-sm text-slate-500">
                  No loans match these filters.
                </td>
              </tr>
            )}

            {!loading &&
              loans.map((loan) => {
                const status = getStatus(loan);
                return (
                  <tr key={loan.id} className="transition-colors hover:bg-primary-50/40">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {loan.books?.title ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{loan.members?.full_name ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(loan.loan_date)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(loan.due_date)}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(loan.return_date)}</td>
                    <td className={`px-6 py-4 text-sm ${status.className}`}>{status.label}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
