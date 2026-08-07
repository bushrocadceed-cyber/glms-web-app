import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Badge from '../ui/Badge';
import { getLoanHistoryForBook } from '../../services/loanService';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

export default function BookViewModal({ book, onClose }) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getLoanHistoryForBook(book.id)
      .then((data) => {
        if (isMounted) setHistory(data);
      })
      .catch(() => {
        if (isMounted) setHistory([]);
      })
      .finally(() => {
        if (isMounted) setLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [book.id]);

  return (
    <Modal title="Book Details" onClose={onClose}>
      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Title</dt>
          <dd className="text-slate-900">{book.title}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Author</dt>
          <dd className="text-slate-900">{book.author}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">ISBN</dt>
          <dd className="text-slate-900">{book.isbn}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Total Copies</dt>
          <dd className="text-slate-900">{book.total_copies ?? '—'}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Available Copies</dt>
          <dd className="text-slate-900">{book.available_copies ?? '—'}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Status</dt>
          <dd>
            <Badge status={book.status} />
          </dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-slate-200 pt-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Loan History</h3>

        {loadingHistory && <p className="text-sm text-slate-500">Loading…</p>}

        {!loadingHistory && history.length === 0 && (
          <p className="text-sm text-slate-500">No loan history for this book yet.</p>
        )}

        {!loadingHistory && history.length > 0 && (
          <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {history.map((loan) => (
              <li key={loan.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-900">{loan.members?.full_name ?? '—'}</span>
                <span className={loan.return_date ? 'text-slate-500' : 'font-medium text-primary-600'}>
                  {loan.return_date ? `Returned ${formatDate(loan.return_date)}` : 'Still checked out'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
