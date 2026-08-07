import { useState } from 'react';
import Modal from '../ui/Modal';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldClasses(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
  }`;
}

// Shown when Reset Password is clicked for someone with no email on file
// (this database has no profiles.email column, so that's the common case
// until one has been typed in for them at least once — see
// staffEmailStore.js). Confirming here saves the address the same way Edit
// Staff does, then immediately sends the reset email with it.
export default function ResetPasswordEmailModal({ person, submitting, onClose, onSubmit }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Email is required.');
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <Modal title="Add Email to Reset Password" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">
        {person.full_name ?? 'This account'} has no email on file yet. Enter their email address —
        it'll be saved to their profile and used to send the password reset link.
      </p>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email Address</label>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            className={fieldClasses(error)}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Save & Send Reset Email'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
