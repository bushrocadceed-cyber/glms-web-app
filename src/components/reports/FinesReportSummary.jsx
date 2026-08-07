import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { getFines, markFineAsPaid } from '../../services/loanService';
import { getFineRate, setFineRate } from '../../lib/fines';
import { exportToCSV } from '../../lib/exportToCSV';
import { useToast } from '../../context/ToastContext';

function formatCurrency(amount) {
  return `$${Number(amount ?? 0).toFixed(2)}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export default function FinesReportSummary() {
  const { showToast } = useToast();

  const [fines, setFines] = useState([]);
  const [finesTrackingReady, setFinesTrackingReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [payingId, setPayingId] = useState(null);

  // The daily rate is only read here to pre-fill the input and to recompute
  // currently-open overdue fines after a save — it isn't part of the fines
  // list itself. getFines() (and ReturnBookModal) read the current rate
  // straight from lib/fines.js on their own each time they run.
  const [rateInput, setRateInput] = useState(() => String(getFineRate()));
  const [rateError, setRateError] = useState('');
  const [rateSaved, setRateSaved] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const { rows, finesTrackingReady: ready } = await getFines();
      setFines(rows);
      setFinesTrackingReady(ready);
    } catch (err) {
      setLoadError(err.message || 'Failed to load fines.');
      setFines([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleSaveRate(e) {
    e.preventDefault();
    const parsed = Number(rateInput);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setRateError('Enter a valid, non-negative rate.');
      return;
    }
    setFineRate(Number(parsed.toFixed(2)));
    setRateError('');
    setRateSaved(true);
    setTimeout(() => setRateSaved(false), 2000);
    // Re-fetch so currently-open overdue rows reflect the new rate right
    // away — already-finalized fines are untouched, they keep whatever was
    // recorded when they were written.
    load();
  }

  async function handlePayFine(loan) {
    setPayingId(loan.id);
    try {
      await markFineAsPaid(loan);
      showToast(`Fine for "${loan.books?.title ?? 'book'}" marked as paid.`);
      load();
    } catch (err) {
      showToast(err.message || 'Failed to update fine.', 'error');
    } finally {
      setPayingId(null);
    }
  }

  const totalOutstanding = fines
    .filter((loan) => !loan.fine_paid)
    .reduce((sum, loan) => sum + Number(loan.fine_amount ?? 0), 0);

  function handleExport() {
    const rows = fines.map((loan) => ({
      Member: loan.members?.full_name ?? '',
      Book: loan.books?.title ?? '',
      'Due Date': formatDate(loan.due_date),
      Status: loan.return_date ? `Returned ${formatDate(loan.return_date)}` : 'Still overdue',
      'Overdue Days': loan.daysLate,
      'Fine Amount': Number(loan.fine_amount ?? 0).toFixed(2),
      Payment: loan.fine_paid ? 'Paid' : 'Unpaid',
    }));
    if (!exportToCSV(rows, 'fines-report.csv')) {
      showToast('No fines to export.', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          Export to CSV
        </button>
      </div>

      {loadError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load fines: {loadError}
        </div>
      )}

      {!finesTrackingReady && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Amounts below are calculated live from due dates, but fine tracking isn&apos;t fully set up yet
          — ask an admin to run <code className="rounded bg-amber-100 px-1">supabase/fines_schema.sql</code>{' '}
          (adds <code className="rounded bg-amber-100 px-1">fine_amount</code> and{' '}
          <code className="rounded bg-amber-100 px-1">fine_paid</code> to <code>loans</code>) before{' '}
          <span className="font-medium">Pay Fine</span> will work.
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex-1 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Total Outstanding Fines</p>
          <p className="text-3xl font-semibold text-red-600">{formatCurrency(totalOutstanding)}</p>
        </div>

        <form
          onSubmit={handleSaveRate}
          className="flex-1 rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <label className="mb-1 block text-sm text-slate-500">Daily Fine Rate</label>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rateInput}
                onChange={(e) => {
                  setRateInput(e.target.value);
                  setRateError('');
                }}
                className={`w-28 rounded-lg border py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-1 ${
                  rateError
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                }`}
              />
            </div>
            <span className="text-sm text-slate-500">/ day late</span>
            <button
              type="submit"
              className="ml-auto rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
            >
              {rateSaved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
          {rateError && <p className="mt-1 text-xs text-red-600">{rateError}</p>}
          <p className="mt-1.5 text-xs text-slate-400">
            Applies to newly calculated overdue fines going forward — already-finalized fines keep their
            recorded amount.
          </p>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {['Member', 'Book', 'Due Date', 'Status', 'Overdue Days', 'Fine Amount', 'Payment', 'Actions'].map(
                  (heading) => (
                    <th
                      key={heading}
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {heading}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500">
                    Loading fines…
                  </td>
                </tr>
              )}

              {!loading && fines.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-slate-500">
                    No overdue books or fines on record.
                  </td>
                </tr>
              )}

              {!loading &&
                fines.map((loan) => (
                  <tr key={loan.id} className="hover:bg-primary-50/40">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {loan.members?.full_name ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{loan.books?.title ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(loan.due_date)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          loan.return_date
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        {loan.return_date ? `Returned ${formatDate(loan.return_date)}` : 'Still overdue'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{loan.daysLate} day(s)</td>
                    <td className="px-6 py-4 text-sm font-semibold text-red-600">
                      {formatCurrency(loan.fine_amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                          loan.fine_paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {loan.fine_paid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {!loan.fine_paid && (
                        <button
                          type="button"
                          onClick={() => handlePayFine(loan)}
                          disabled={payingId === loan.id || !finesTrackingReady}
                          title={!finesTrackingReady ? 'Run the setup SQL first — see the notice above.' : undefined}
                          className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {payingId === loan.id ? 'Saving…' : 'Pay Fine'}
                        </button>
                      )}
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
