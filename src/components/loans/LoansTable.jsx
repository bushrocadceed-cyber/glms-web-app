import { DollarSign, RefreshCw, RotateCcw } from 'lucide-react';
import { getLoanStatus } from '../../lib/loanStatus';
import { computeFine } from '../../lib/fines';

const COLUMNS = ['Book Title', 'Member Name', 'Borrowed Date', 'Due Date', 'Status', 'Actions'];

const STATUS_LABEL = { active: 'Active', overdue: 'Overdue', returned: 'Returned' };
const STATUS_BADGE = {
  active: 'bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300',
  overdue: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  returned: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

// What's actually payable right now for this loan:
// - already paid -> nothing
// - a finalized amount is on record (returned late, or a previous partial
//   charge via markFineAsPaid) -> that exact amount
// - still overdue and open, nothing finalized yet -> a live estimate as of
//   today, same math the Fines report and Return Book modal both use, so a
//   fine can be settled at the counter before the book itself comes back
function getPayableFine(loan, status) {
  if (loan.fine_paid) return 0;
  if (Number(loan.fine_amount) > 0) return Number(loan.fine_amount);
  if (status === 'overdue') return computeFine(loan.due_date).amount;
  return 0;
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

export default function LoansTable({
  loans,
  loading,
  emptyMessage,
  renewingId,
  payingFineId,
  onReturn,
  onRenew,
  onPayFine,
}) {
  return (
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
            {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && loans.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  {emptyMessage ?? 'No loans to show.'}
                </td>
              </tr>
            )}

            {!loading &&
              loans.map((loan) => {
                const status = getLoanStatus(loan);

                return (
                  <tr key={loan.id} className="transition-colors hover:bg-primary-50/40 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {loan.books?.title ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {loan.members?.full_name ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {formatDate(loan.loan_date)}
                    </td>
                    <td
                      className={`px-6 py-4 text-sm ${
                        status === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {formatDate(loan.due_date)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[status]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const payableFine = getPayableFine(loan, status);
                        return (
                          <div className="flex items-center gap-1">
                            {status !== 'returned' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onReturn(loan)}
                                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-slate-700"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Return
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onRenew(loan)}
                                  disabled={renewingId === loan.id}
                                  title="Renew — extends the due date by 7 days"
                                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-700"
                                >
                                  <RefreshCw className={`h-4 w-4 ${renewingId === loan.id ? 'animate-spin' : ''}`} />
                                  Renew
                                </button>
                              </>
                            )}
                            {payableFine > 0 && (
                              <button
                                type="button"
                                onClick={() => onPayFine(loan, payableFine)}
                                disabled={payingFineId === loan.id}
                                title="Mark this fine as paid at the counter"
                                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-slate-700"
                              >
                                <DollarSign className="h-4 w-4" />
                                {payingFineId === loan.id ? 'Saving…' : `Pay Fine ($${payableFine.toFixed(2)})`}
                              </button>
                            )}
                            {status === 'returned' && payableFine === 0 && (
                              <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
                            )}
                          </div>
                        );
                      })()}
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
