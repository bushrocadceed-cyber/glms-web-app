import { useState } from 'react';
import Modal from '../ui/Modal';

const EMPTY_FORM = { title: '', author: '', isbn: '', total_copies: '1' };

function fieldClasses(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
  }`;
}

export default function BookFormModal({ mode, initialValues, submitting, onClose, onSubmit }) {
  const [form, setForm] = useState(() =>
    initialValues
      ? {
          title: initialValues.title ?? '',
          author: initialValues.author ?? '',
          isbn: initialValues.isbn ?? '',
          total_copies: String(initialValues.total_copies ?? 1),
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validate() {
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = 'Title is required.';
    if (!form.author.trim()) nextErrors.author = 'Author is required.';
    if (!form.isbn.trim()) nextErrors.isbn = 'ISBN is required.';

    const totalCopies = Number(form.total_copies);
    if (!Number.isInteger(totalCopies) || totalCopies < 0) {
      nextErrors.total_copies = 'Total copies must be a whole number, 0 or greater.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({ ...form, total_copies: Number(form.total_copies) });
  }

  return (
    <Modal title={mode === 'add' ? 'Add Book' : 'Edit Book'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            className={fieldClasses(errors.title)}
          />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Author</label>
          <input
            name="author"
            value={form.author}
            onChange={handleChange}
            className={fieldClasses(errors.author)}
          />
          {errors.author && <p className="mt-1 text-xs text-red-600">{errors.author}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">ISBN</label>
          <input
            name="isbn"
            value={form.isbn}
            onChange={handleChange}
            className={fieldClasses(errors.isbn)}
          />
          {errors.isbn && <p className="mt-1 text-xs text-red-600">{errors.isbn}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Total Copies</label>
          <input
            type="number"
            min="0"
            step="1"
            name="total_copies"
            value={form.total_copies}
            onChange={handleChange}
            className={fieldClasses(errors.total_copies)}
          />
          {errors.total_copies && <p className="mt-1 text-xs text-red-600">{errors.total_copies}</p>}
          {mode === 'edit' && (
            <p className="mt-1 text-xs text-slate-500">
              Available Copies adjusts automatically to match — status and availability are no longer
              set manually.
            </p>
          )}
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
            {submitting ? 'Saving…' : mode === 'add' ? 'Add Book' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
