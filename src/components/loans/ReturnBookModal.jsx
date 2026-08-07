import { useState } from 'react';
import Modal from '../ui/Modal';
import { computeFine } from '../../lib/fines';

function formatCurrency(amount) {
  return `$${Number(amount ?? 0).toFixed(2)}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

// Suggested amount is computed once, from due_date vs. right now (the
// return is happening this moment) — pre-fills the field below, which the
// admin can then adjust or zero out (waive) before confirming.
export default function ReturnBookModal({ loan, submitting, onClose, onSubmit }) {
  const suggested = computeFine(loan.due_date);
  const [fineAmount, setFineAmount] = useState(String(suggested.amount));
  const [finePaid, setFinePaid] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const parsed = Number(fineAmount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid, non-negative fine amount.');
      return;
    }
    onSubmit({ fineAmount: Number(parsed.toFixed(2)), finePaid });
  }

  return (
    <Modal title="Return Book" onClose={onClose}>
      <div className="mb-4 space-y-1 rounded-lg bg-slate-50 px-3 py-2.5 text-sm dark:bg-slate-900/60">
        <p className="font-medium text-slate-900 dark:text-slate-100">{loan.books?.title ?? 'Book'}</p>
        <p className="text-slate-600 dark:text-slate-300">{loan.members?.full_name ?? 'Member'}</p>
        <p className="text-slate-500 dark:text-slate-400">
          Due {formatDate(loan.due_date)}
          {suggested.daysLate > 0 ? ` — ${suggested.daysLate} day(s) late as of today` : ' — not overdue'}
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Fine Amount{' '}
            <span className="font-normal text-slate-400 dark:text-slate-500">
              (calculated: {formatCurrency(suggested.amount)} — adjust or set to 0 to waive)
            </span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">
              $
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={fineAmount}
              onChange={(e) => {
                setFineAmount(e.target.value);
                setError('');
              }}
              className={`w-full rounded-lg border py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-1 dark:bg-slate-900 dark:text-slate-100 ${
                error
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600 dark:border-slate-600'
              }`}
            />
          </div>
          {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={finePaid}
            onChange={(e) => setFinePaid(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-900"
          />
          Mark Fine as Paid
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? 'Returning…' : 'Confirm Return'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
