import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import LoansTable from '../components/loans/LoansTable';
import CreateLoanModal from '../components/loans/CreateLoanModal';
import ReturnBookModal from '../components/loans/ReturnBookModal';
import { useLoans } from '../hooks/useLoans';
import { useBooks } from '../hooks/useBooks';
import { useMembers } from '../hooks/useMembers';
import { createLoan, renewLoan, returnLoan } from '../services/loanService';
import { getLoanStatus } from '../lib/loanStatus';
import { logUserActivity } from '../services/activityLogService';
import { useToast } from '../context/ToastContext';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'returned', label: 'Returned' },
];

const EMPTY_MESSAGE = {
  all: 'No loans yet. Check out a book to get started.',
  active: 'No active loans right now.',
  overdue: 'No overdue loans — nice.',
  returned: 'No returned loans yet.',
};

export default function LoansPage() {
  const { loans, loading, error, refetch } = useLoans();
  const { books } = useBooks('active');
  const { members } = useMembers();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [returningLoan, setReturningLoan] = useState(null);
  const [returning, setReturning] = useState(false);
  const [renewingId, setRenewingId] = useState(null);

  // Lets the Dashboard's "Borrow Book" quick action deep-link straight into
  // this modal. Consumed once, then cleared from the URL so a page refresh
  // doesn't keep reopening it.
  useEffect(() => {
    if (searchParams.get('action') === 'borrow') {
      setShowCreateModal(true);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLoans = useMemo(() => {
    if (tab === 'all') return loans;
    return loans.filter((loan) => getLoanStatus(loan) === tab);
  }, [loans, tab]);

  async function handleCreateLoan({ bookId, memberId, dueDate }) {
    setSubmitting(true);
    try {
      await createLoan(bookId, memberId, dueDate);
      showToast('Book checked out successfully.');
      const bookTitle = books.find((b) => b.id === bookId)?.title ?? 'a book';
      const memberName = members.find((m) => m.id === memberId)?.full_name ?? 'a member';
      logUserActivity('Issued Loan', `${bookTitle} — checked out to ${memberName}`);
      setShowCreateModal(false);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to check out book.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Only an overdue loan can actually have a fine, so that's the only case
  // that needs the confirmation modal — an on-time return has nothing to
  // confirm and goes straight through with fineAmount 0.
  function handleReturn(loan) {
    if (getLoanStatus(loan) === 'overdue') {
      setReturningLoan(loan);
      return;
    }
    performReturn(loan, { fineAmount: 0, finePaid: false });
  }

  async function performReturn(loan, { fineAmount, finePaid }) {
    setReturning(true);
    try {
      await returnLoan(loan.id, { fineAmount, finePaid });
      showToast(`"${loan.books?.title ?? 'Book'}" marked as returned.`);
      logUserActivity(
        'Returned Book',
        `${loan.books?.title ?? 'Book'} — ${loan.members?.full_name ?? 'Member'}${
          fineAmount > 0 ? ` (fine: $${fineAmount.toFixed(2)}${finePaid ? ', paid' : ''})` : ''
        }`
      );
      setReturningLoan(null);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to return book.', 'error');
    } finally {
      setReturning(false);
    }
  }

  async function handleRenew(loan) {
    setRenewingId(loan.id);
    try {
      await renewLoan(loan.id);
      showToast(`"${loan.books?.title ?? 'Book'}" renewed — due date extended by 7 days.`);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to renew loan.', 'error');
    } finally {
      setRenewingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Check-out Book
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          <span>Failed to load loans: {error.message}</span>
          <button type="button" onClick={refetch} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <LoansTable
        loans={filteredLoans}
        loading={loading}
        emptyMessage={EMPTY_MESSAGE[tab]}
        renewingId={renewingId}
        onReturn={handleReturn}
        onRenew={handleRenew}
      />

      {showCreateModal && (
        <CreateLoanModal
          books={books}
          members={members}
          loans={loans}
          submitting={submitting}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateLoan}
        />
      )}

      {returningLoan && (
        <ReturnBookModal
          loan={returningLoan}
          submitting={returning}
          onClose={() => setReturningLoan(null)}
          onSubmit={(values) => performReturn(returningLoan, values)}
        />
      )}
    </div>
  );
}
