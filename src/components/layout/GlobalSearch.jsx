import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookImage, Search, User, X } from 'lucide-react';
import { searchBooks } from '../../services/bookService';
import { searchMembers } from '../../services/memberService';

export default function GlobalSearch() {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState([]);
  const [members, setMembers] = useState([]);

  // Debounced so every keystroke doesn't fire two queries — this database
  // has been measured taking anywhere from under a second to tens of
  // seconds to respond, so keeping request volume low here matters.
  useEffect(() => {
    const trimmed = term.trim();
    if (!trimmed) {
      setBooks([]);
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const [bookResults, memberResults] = await Promise.all([
          searchBooks(trimmed),
          searchMembers(trimmed),
        ]);
        setBooks(bookResults);
        setMembers(memberResults);
      } catch {
        setBooks([]);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [term]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function goToBooks() {
    navigate(`/inventory?q=${encodeURIComponent(term.trim())}`);
    setOpen(false);
  }

  function goToMembers() {
    navigate(`/members?q=${encodeURIComponent(term.trim())}`);
    setOpen(false);
  }

  const hasResults = books.length > 0 || members.length > 0;
  const trimmed = term.trim();

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-200" />
      <input
        type="text"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="Search books or members…"
        className="w-full rounded-lg border border-primary-500 bg-primary-700/40 py-2 pl-9 pr-8 text-sm text-white placeholder:text-primary-200 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
      />
      {term && (
        <button
          type="button"
          onClick={() => setTerm('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary-200 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {open && trimmed && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-lg bg-white shadow-xl ring-1 ring-slate-200">
          {loading && <div className="px-4 py-3 text-sm text-slate-500">Searching…</div>}

          {!loading && !hasResults && (
            <div className="px-4 py-3 text-sm text-slate-500">No matches for &quot;{trimmed}&quot;.</div>
          )}

          {!loading && books.length > 0 && (
            <div>
              <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Books
              </div>
              {books.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={goToBooks}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-primary-50"
                >
                  <div className="flex h-9 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                    {book.cover_image ? (
                      <img src={book.cover_image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BookImage className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{book.title}</p>
                    <p className="truncate text-xs text-slate-500">{book.author}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && members.length > 0 && (
            <div>
              <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Members
              </div>
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={goToMembers}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-primary-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{member.full_name}</p>
                    <p className="truncate text-xs text-slate-500">{member.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && hasResults && <div className="pb-2" />}
        </div>
      )}
    </div>
  );
}
