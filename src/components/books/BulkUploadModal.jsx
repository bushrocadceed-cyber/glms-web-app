import { useState } from 'react';
import Modal from '../ui/Modal';

const PLACEHOLDER = 'The Hobbit, J.R.R. Tolkien, 9780345339683, 3\nDune, Frank Herbert, 9780441172719, 2';

function parseLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title, author, isbn, totalCopiesRaw] = line.split(',').map((cell) => (cell ?? '').trim());
      const totalCopies = Number.parseInt(totalCopiesRaw, 10);

      return {
        row: index + 1,
        title,
        author,
        isbn,
        total_copies: Number.isFinite(totalCopies) && totalCopies > 0 ? totalCopies : 1,
        valid: Boolean(title && author && isbn),
      };
    });
}

export default function BulkUploadModal({ submitting, onClose, onSubmit }) {
  const [text, setText] = useState('');

  const parsed = parseLines(text);
  const validRows = parsed.filter((row) => row.valid);
  const invalidRows = parsed.filter((row) => !row.valid);

  function handleSubmit(e) {
    e.preventDefault();
    if (validRows.length === 0) return;

    onSubmit(
      validRows.map(({ title, author, isbn, total_copies }) => ({ title, author, isbn, total_copies }))
    );
  }

  return (
    <Modal title="Bulk Add Books" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            One book per line: Title, Author, ISBN, Total Copies (copies optional, defaults to 1)
          </label>
          <textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          />
        </div>

        {parsed.length > 0 && (
          <p className="text-sm text-slate-600">
            {validRows.length} book{validRows.length === 1 ? '' : 's'} ready to import
            {invalidRows.length > 0 && (
              <span className="text-red-600">
                {' '}
                — {invalidRows.length} row{invalidRows.length === 1 ? '' : 's'} skipped (missing
                title/author/ISBN)
              </span>
            )}
          </p>
        )}

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
            disabled={submitting || validRows.length === 0}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting
              ? 'Uploading…'
              : `Upload ${validRows.length || ''} Book${validRows.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </Modal>
  );
}
