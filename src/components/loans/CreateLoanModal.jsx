import { useState } from 'react';
import Modal from '../ui/Modal';
import { getLibraryRules } from '../../lib/libraryRules';

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + getLibraryRules().loanDurationDays);
  return date.toISOString().slice(0, 10);
}

// loans is the full list from the Loans page (all statuses) — used only to
// count a member's current active (not yet returned) loans against the
// Max Books Per Member rule set on the Settings page.
export default function CreateLoanModal({ books, members, loans, submitting, onClose, onSubmit }) {
  const [form, setForm] = useState({ memberId: '', bookId: '', dueDate: defaultDueDate() });
  const [error, setError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (!form.memberId || !form.bookId || !form.dueDate) {
      setError('Please fill in every field.');
      return;
    }

    const selectedBook = books.find((book) => book.id === form.bookId);
    if (!selectedBook || (selectedBook.available_copies ?? 0) < 1) {
      setError('This book has no available copies to check out.');
      return;
    }

    const { maxBooksPerMember } = getLibraryRules();
    const activeCount = (loans ?? []).filter(
      (loan) => loan.member_id === form.memberId && !loan.return_date
    ).length;
    if (activeCount >= maxBooksPerMember) {
      const selectedMember = members.find((member) => member.id === form.memberId);
      setError(
        `${selectedMember?.full_name ?? 'This member'} already has ${activeCount} book(s) checked out — the limit is ${maxBooksPerMember}. Return a book first, or raise the limit in Settings.`
      );
      return;
    }

    onSubmit({
      bookId: form.bookId,
      memberId: form.memberId,
      dueDate: new Date(form.dueDate).toISOString(),
    });
  }

  return (
    <Modal title="Check-out Book" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Member</label>
          <select
            name="memberId"
            value={form.memberId}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Select a member…</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Book</label>
          <select
            name="bookId"
            value={form.bookId}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Select a book…</option>
            {books.map((book) => (
              <option key={book.id} value={book.id} disabled={(book.available_copies ?? 0) < 1}>
                {book.title} ({book.available_copies ?? 0} available)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Due Date</label>
          <input
            type="date"
            name="dueDate"
            value={form.dueDate}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

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
            {submitting ? 'Checking out…' : 'Check Out'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
