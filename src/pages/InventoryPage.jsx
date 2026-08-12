import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BookImage,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { logUserActivity } from '../services/activityLogService';

const EMPTY_ADD_FORM = { title: '', author: '', isbn: '', total_copies: '1', category: '', replacement_cost: '' };
const EMPTY_EDIT_FORM = { title: '', author: '', isbn: '', total_copies: '1', category: '', replacement_cost: '' };

// Files are embedded as base64 data URLs directly in the books row — no
// Supabase Storage bucket involved, so there's nothing to fail with "Bucket
// not found". Base64 inflates size by ~33%, and every row goes through
// PostgREST's request/response size limits, so these caps stay small on
// purpose to keep saves and the inventory list reliable.
const MAX_COVER_BYTES = 1.5 * 1024 * 1024; // 1.5MB raw (~2MB encoded)
const MAX_PDF_BYTES = 3 * 1024 * 1024; // 3MB raw (~4MB encoded)

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

// Cover images are stored as data: URLs, so a "broken image" here means
// corrupt/unsupported data rather than a dead link — either way, fall back
// to the placeholder icon instead of a broken-image box.
function BookCoverThumb({ src, size = 'sm' }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const sizeClasses = size === 'lg' ? 'h-20 w-14' : 'h-14 w-10';
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={`flex ${sizeClasses} shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200`}
    >
      {showImage ? (
        <img
          src={src}
          alt="Book cover"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <BookImage className="h-5 w-5 text-slate-400" />
      )}
    </div>
  );
}

// Matches the skeleton-row pattern already used in StaffTable/LoansTable —
// placeholder bars with the same pulse animation, shaped per column (a
// thumbnail-sized block for Cover, two action-button-sized blocks for
// Actions) rather than one generic "Loading…" row, so the table's actual
// layout is visible immediately instead of collapsing to a single line.
function BookSkeletonRow() {
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="h-14 w-10 animate-pulse rounded-md bg-slate-200" />
      </td>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <div className="h-4 w-full max-w-[8rem] animate-pulse rounded bg-slate-200" />
        </td>
      ))}
      <td className="px-6 py-4">
        <div className="flex items-center gap-1">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </td>
    </tr>
  );
}

// PostgREST rejects an insert/update/select outright if it references any
// column the schema cache doesn't know about — an insert/update won't save
// the other, valid fields either. So rather than block on that, callers
// detect this specific error and retry with the optional field(s) stripped
// out, so title/author/isbn/copies still save (or load). PGRST204 is
// PostgREST's own "not in the schema cache" code, seen on insert/update/
// select payloads; 42703 is the raw Postgres "column does not exist" code,
// seen when a column is referenced in a filter — checking both covers every
// shape of request in this file.
function isMissingColumnError(err) {
  return err?.code === 'PGRST204' || err?.code === '42703';
}

export default function InventoryPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Add Book form, opened as a modal from the "+ Add Book" button ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addFormErrors, setAddFormErrors] = useState({});
  const [addCoverDataUrl, setAddCoverDataUrl] = useState(null);
  const [addPdfDataUrl, setAddPdfDataUrl] = useState(null);
  const [addPdfFileName, setAddPdfFileName] = useState(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // --- Catalog + Trash, shown below so newly added books appear immediately ---
  // Identifies the most recent fetchBooks() call so an older, still-running
  // request never overwrites state after a newer one has taken over — e.g.
  // React 18 StrictMode deliberately double-invokes effects in dev, which
  // starts a second, overlapping fetch. Rather than aborting the network
  // request outright (which surfaced as a scary, uncatchable-looking
  // "AbortError: The user aborted a request" console entry), a stale
  // request's result is just silently ignored when it eventually resolves.
  const fetchTokenRef = useRef(0);

  // Every fetchBooks() call fires 2 parallel queries (see fetchBooksAttempt).
  // Combined with StrictMode's double-invoke, plus a user clicking around
  // while the (already slow) database is still answering an earlier
  // request, several fetchBooks() calls can end up overlapping — and on a
  // slow backend, that means multiple requests competing for the browser's
  // small per-origin connection limit, which shows up as a request sitting
  // "pending" in DevTools for a long time even though nothing is actually
  // broken. These two refs make sure only one fetchBooks() round-trip is
  // ever in flight: an overlapping call just marks that another fetch is
  // needed and returns immediately instead of opening more connections; the
  // in-flight call runs that queued fetch itself the moment it finishes.
  const isFetchingRef = useRef(false);
  const refetchQueuedRef = useRef(false);

  // Whether books.replacement_cost is known missing this session — checked
  // (and possibly set) by both fetchBooksNow below and the Add/Edit submit
  // handlers, so whichever one learns it first saves the other a doomed
  // request too. Starts optimistic (include it, self-correct once on
  // failure) rather than pessimistic, since this ref is scoped to this one
  // page/session rather than firing on every page load app-wide — see
  // fetchBooksNow's own comment for why that trade-off is fine here.
  const replacementCostMissingRef = useRef(false);

  const [view, setView] = useState('active'); // 'active' | 'trash' — every book lives in exactly one
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [editingBook, setEditingBook] = useState(null);
  const [form, setForm] = useState(EMPTY_EDIT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [deletingBook, setDeletingBook] = useState(null);
  const [permaDeleteBook, setPermaDeleteBook] = useState(null);
  const [readingBook, setReadingBook] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [coverDataUrl, setCoverDataUrl] = useState(null);
  const [coverBookIds, setCoverBookIds] = useState(() => new Set());
  const [pdfDataUrl, setPdfDataUrl] = useState(null);
  const [pdfFileName, setPdfFileName] = useState(null);
  const [pdfBookIds, setPdfBookIds] = useState(() => new Set());
  const [readingPdf, setReadingPdf] = useState(false);
  const [loadingExistingAssets, setLoadingExistingAssets] = useState(false);

  // cover_image and pdf_url both store the whole file as base64 text —
  // cover_image up to ~2MB encoded per book (MAX_COVER_BYTES), pdf_url up
  // to ~4MB (MAX_PDF_BYTES). Selecting either for every row on every page
  // load means the list payload grows without bound as more books get
  // covers/PDFs attached — confirmed live: with only 4 active books, that
  // payload was already multiple megabytes and took the list query well
  // past what feels instant, which is exactly what showed up as "hangs
  // indefinitely, no books or empty state ever appears" (the request
  // hadn't actually failed, it was just still downloading). Neither
  // column's content is needed by the list itself — the table only shows
  // *whether* a cover/PDF exists (for the thumbnail fallback and the Read
  // button) — so the bulk query excludes both entirely; two tiny id-only
  // queries ask which rows have one. The actual bytes are fetched only for
  // one row at a time, on demand — see openEditModal and openReadPdf below.
  //
  // setLoading(false) lives in `finally`, unconditionally, on its own line,
  // with nothing else in that block that could delay or skip it — so it
  // always runs on the very next line after the request settles, success or
  // failure. The only thing gating it is the token check right above it,
  // which exists purely to stop an old, superseded request (one that lost a
  // race against a newer fetch — e.g. React 18 StrictMode's dev-only double
  // effect invoke, or the user flipping the Active/Trash tab again before
  // the first request even returned) from being the one to turn the
  // spinner off; the newer request's own finally is what actually clears
  // it once it settles.
  async function fetchBooksNow() {
    const myToken = ++fetchTokenRef.current;
    setLoading(true);

    const isTrash = view === 'trash';
    let nextBooks = [];
    let nextPdfIds = new Set();
    let nextCoverIds = new Set();

    const baseColumns = 'id, title, author, isbn, genre, total_copies, available_copies, status, created_at';

    try {
      const columns = replacementCostMissingRef.current ? baseColumns : `${baseColumns}, replacement_cost`;

      let [
        { data: rows, error: rowsError },
        { data: coverRows, error: coverError },
        { data: pdfRows, error: pdfError },
      ] = await Promise.all([
        supabase
          .from('books')
          .select(columns)
          .eq('is_deleted', isTrash)
          .order('created_at', { ascending: false }),
        supabase.from('books').select('id').eq('is_deleted', isTrash).not('cover_image', 'is', null),
        supabase.from('books').select('id').eq('is_deleted', isTrash).not('pdf_url', 'is', null),
      ]);

      // Only the rows query ever references replacement_cost — retry just
      // that one in place, once, rather than the whole Promise.all trio.
      if (rowsError && !replacementCostMissingRef.current && isMissingColumnError(rowsError)) {
        replacementCostMissingRef.current = true;
        ({ data: rows, error: rowsError } = await supabase
          .from('books')
          .select(baseColumns)
          .eq('is_deleted', isTrash)
          .order('created_at', { ascending: false }));
      }

      if (rowsError) throw rowsError;
      if (coverError) throw coverError;
      if (pdfError) throw pdfError;

      nextBooks = rows ?? [];
      nextCoverIds = new Set((coverRows ?? []).map((r) => r.id));
      nextPdfIds = new Set((pdfRows ?? []).map((r) => r.id));
    } catch {
      // A failed or slow fetch never leaves the page stuck or shows an
      // error wall — it just falls back to an empty books array, which the
      // render below already displays as a plain "No books found" message.
      nextBooks = [];
      nextCoverIds = new Set();
      nextPdfIds = new Set();
    } finally {
      isFetchingRef.current = false;
      if (fetchTokenRef.current === myToken) {
        setBooks(nextBooks);
        setCoverBookIds(nextCoverIds);
        setPdfBookIds(nextPdfIds);
        setLoading(false);
      }
      // Runs last, after this call's own state/loading updates above are
      // already queued — so it can never race or interfere with them.
      if (refetchQueuedRef.current) {
        refetchQueuedRef.current = false;
        fetchBooks();
      }
    }
  }

  // Public entry point: never lets more than one fetchBooks() round-trip run
  // at the same time. If one is already in flight, this just notes that
  // another fetch is needed once it's done, instead of opening a second,
  // third, fourth... set of connections to an already-slow database.
  function fetchBooks() {
    if (isFetchingRef.current) {
      refetchQueuedRef.current = true;
      return;
    }
    isFetchingRef.current = true;
    fetchBooksNow();
  }

  useEffect(() => {
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Lets the Dashboard's Quick Actions, global search, and category chips
  // deep-link here — ?action=add opens this page straight into the Add Book
  // modal, ?q= prefills the search box, ?category= prefills the category
  // filter. Consumed once, then cleared from the URL so a page refresh
  // doesn't keep reopening the modal.
  useEffect(() => {
    const action = searchParams.get('action');
    const q = searchParams.get('q');
    const category = searchParams.get('category');
    if (action === 'add') openAddModal();
    if (q) setSearch(q);
    if (category) setCategoryFilter(category);
    if (action || q || category) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const set = new Set(books.map((book) => book.genre).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [books]);

  const filteredBooks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return books.filter((book) => {
      const matchesTerm =
        !term ||
        book.title?.toLowerCase().includes(term) ||
        book.author?.toLowerCase().includes(term);
      const matchesCategory = !categoryFilter || book.genre === categoryFilter;
      return matchesTerm && matchesCategory;
    });
  }, [books, search, categoryFilter]);

  // ----- Add Book form handlers -----

  function openAddModal() {
    setAddForm(EMPTY_ADD_FORM);
    setAddFormErrors({});
    setAddCoverDataUrl(null);
    setAddPdfDataUrl(null);
    setAddPdfFileName(null);
    setIsAddModalOpen(true);
  }

  function handleAddChange(field, value) {
    setAddForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleAddCoverFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAddFormErrors((prev) => ({ ...prev, cover_image: 'Please choose an image file.' }));
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setAddFormErrors((prev) => ({ ...prev, cover_image: 'Image must be 1.5MB or smaller.' }));
      return;
    }

    setAddFormErrors((prev) => ({ ...prev, cover_image: undefined }));
    setAddCoverDataUrl(await readFileAsDataUrl(file));
  }

  async function handleAddPdfFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setAddFormErrors((prev) => ({ ...prev, pdf_file: 'Please choose a PDF file.' }));
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setAddFormErrors((prev) => ({ ...prev, pdf_file: 'PDF must be 3MB or smaller.' }));
      return;
    }

    setAddFormErrors((prev) => ({ ...prev, pdf_file: undefined }));
    setAddPdfDataUrl(await readFileAsDataUrl(file));
    setAddPdfFileName(file.name);
  }

  function validateAddForm() {
    const nextErrors = {};
    if (!addForm.title.trim()) nextErrors.title = 'Title is required.';
    if (!addForm.author.trim()) nextErrors.author = 'Author is required.';
    if (!addForm.isbn.trim()) nextErrors.isbn = 'ISBN is required.';

    const totalCopies = Number(addForm.total_copies);
    if (!Number.isInteger(totalCopies) || totalCopies < 0) {
      nextErrors.total_copies = 'Total copies must be a whole number, 0 or greater.';
    }

    if (addForm.replacement_cost.trim()) {
      const cost = Number(addForm.replacement_cost);
      if (!Number.isFinite(cost) || cost < 0) {
        nextErrors.replacement_cost = 'Enter a valid, non-negative amount.';
      }
    }

    setAddFormErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    if (!validateAddForm()) return;
    if (addFormErrors.cover_image || addFormErrors.pdf_file) return;

    setAddSubmitting(true);
    const totalCopies = Number(addForm.total_copies);
    const attachingFiles = Boolean(addCoverDataUrl || addPdfDataUrl);
    // Optional, defaults to 0 when left blank.
    const replacementCost = addForm.replacement_cost.trim() ? Number(addForm.replacement_cost) : 0;

    const basePayload = {
      title: addForm.title,
      author: addForm.author,
      isbn: addForm.isbn,
      genre: addForm.category.trim() || null,
      total_copies: totalCopies,
      available_copies: totalCopies,
      is_deleted: false,
    };

    try {
      // Try including replacement_cost + cover/PDF first — only falls back
      // if the database is missing one of those optional columns, so a book
      // always saves even when they aren't set up. replacement_cost is
      // dropped independently of cover/pdf (see the second retry below) so
      // a database missing just one of them doesn't lose the other.
      const fullPayload = { ...basePayload, cover_image: addCoverDataUrl, pdf_url: addPdfDataUrl };
      if (!replacementCostMissingRef.current) fullPayload.replacement_cost = replacementCost;

      let { error: saveError } = await supabase.from('books').insert(fullPayload);
      let coverPdfSkipped = false;
      let replacementCostSkipped = false;

      if (saveError && isMissingColumnError(saveError)) {
        coverPdfSkipped = true;
        const retryPayload = { ...basePayload };
        if (!replacementCostMissingRef.current) retryPayload.replacement_cost = replacementCost;
        ({ error: saveError } = await supabase.from('books').insert(retryPayload));
      }

      if (saveError && isMissingColumnError(saveError) && !replacementCostMissingRef.current) {
        replacementCostMissingRef.current = true;
        replacementCostSkipped = true;
        ({ error: saveError } = await supabase.from('books').insert(basePayload));
      }

      if (saveError) throw saveError;

      // Fire-and-forget: logUserActivity never throws, so this can't turn a
      // successful save into a failure toast — see activityLogService.js.
      logUserActivity('Added New Book', `${addForm.title} by ${addForm.author}`);

      if (coverPdfSkipped && attachingFiles) {
        showToast(
          'Book added, but the cover/PDF could not be — the database is missing those columns. Ask an admin to run the setup SQL, then edit this book to attach them.',
          'error'
        );
      } else if (replacementCostSkipped && replacementCost > 0) {
        showToast(
          'Book added, but the replacement cost could not be — the database is missing that column. Ask an admin to run supabase/book_replacement_cost_schema.sql, then edit this book to set it.',
          'error'
        );
      } else {
        showToast('Book added successfully.');
      }

      setAddForm(EMPTY_ADD_FORM);
      setAddFormErrors({});
      setAddCoverDataUrl(null);
      setAddPdfDataUrl(null);
      setAddPdfFileName(null);
      setIsAddModalOpen(false);

      // Newly added books always land in the active catalog — jump back to
      // that tab so the book that was just added is immediately visible.
      if (view === 'trash') {
        setView('active');
      } else {
        fetchBooks();
      }
    } catch (err) {
      showToast(err.message || 'Something went wrong.', 'error');
    } finally {
      setAddSubmitting(false);
    }
  }

  // ----- Catalog / Trash: edit, delete, restore -----

  async function openEditModal(book) {
    setForm({
      title: book.title ?? '',
      author: book.author ?? '',
      isbn: book.isbn ?? '',
      total_copies: String(book.total_copies ?? 1),
      category: book.genre ?? '',
      replacement_cost: book.replacement_cost != null ? String(book.replacement_cost) : '',
    });
    setFormErrors({});
    setEditingBook(book);

    // Neither cover_image nor pdf_url is in the list row on purpose (see
    // fetchBooksNow) — if this book has either, fetch them now, together,
    // so Save Changes doesn't wipe one out by sending null when nothing
    // was actually meant to change.
    const hasCover = coverBookIds.has(book.id);
    const hasPdf = pdfBookIds.has(book.id);
    setCoverDataUrl(null);
    setPdfFileName(hasPdf ? 'Current PDF attached' : null);
    setPdfDataUrl(null);

    if (hasCover || hasPdf) {
      setLoadingExistingAssets(true);
      const { data, error } = await supabase
        .from('books')
        .select('cover_image, pdf_url')
        .eq('id', book.id)
        .single();
      if (!error) {
        if (hasCover) setCoverDataUrl(data.cover_image);
        if (hasPdf) setPdfDataUrl(data.pdf_url);
      }
      setLoadingExistingAssets(false);
    }
  }

  async function openReadPdf(book) {
    setReadingBook(book);
    setReadingPdf(true);
    try {
      const { data, error } = await supabase.from('books').select('pdf_url').eq('id', book.id).single();
      if (error) throw error;
      setReadingBook({ ...book, pdf_url: data.pdf_url });
    } catch (err) {
      showToast(err.message || 'Failed to load PDF.', 'error');
      setReadingBook(null);
    } finally {
      setReadingPdf(false);
    }
  }

  async function handleCoverFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFormErrors((prev) => ({ ...prev, cover_image: 'Please choose an image file.' }));
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      setFormErrors((prev) => ({ ...prev, cover_image: 'Image must be 1.5MB or smaller.' }));
      return;
    }

    setFormErrors((prev) => ({ ...prev, cover_image: undefined }));
    setCoverDataUrl(await readFileAsDataUrl(file));
  }

  async function handlePdfFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setFormErrors((prev) => ({ ...prev, pdf_file: 'Please choose a PDF file.' }));
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setFormErrors((prev) => ({ ...prev, pdf_file: 'PDF must be 3MB or smaller.' }));
      return;
    }

    setFormErrors((prev) => ({ ...prev, pdf_file: undefined }));
    setPdfDataUrl(await readFileAsDataUrl(file));
    setPdfFileName(file.name);
  }

  function validateForm() {
    const nextErrors = {};
    if (!form.title.trim()) nextErrors.title = 'Title is required.';
    if (!form.author.trim()) nextErrors.author = 'Author is required.';
    if (!form.isbn.trim()) nextErrors.isbn = 'ISBN is required.';

    const totalCopies = Number(form.total_copies);
    if (!Number.isInteger(totalCopies) || totalCopies < 0) {
      nextErrors.total_copies = 'Total copies must be a whole number, 0 or greater.';
    }

    if (form.replacement_cost.trim()) {
      const cost = Number(form.replacement_cost);
      if (!Number.isFinite(cost) || cost < 0) {
        nextErrors.replacement_cost = 'Enter a valid, non-negative amount.';
      }
    }

    setFormErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;
    if (formErrors.cover_image || formErrors.pdf_file) return;

    setSubmitting(true);
    const totalCopies = Number(form.total_copies);
    const coverImageUrl = coverDataUrl;
    const pdfUrl = pdfDataUrl;
    const attachingFiles = Boolean(coverImageUrl || pdfUrl);
    const replacementCost = form.replacement_cost.trim() ? Number(form.replacement_cost) : 0;

    try {
      const original = editingBook;
      const checkedOut = (original.total_copies ?? 0) - (original.available_copies ?? 0);

      if (totalCopies < checkedOut) {
        throw new Error(`Cannot reduce total copies below the ${checkedOut} currently checked out.`);
      }

      const newAvailable = totalCopies - checkedOut;

      const basePayload = {
        title: form.title,
        author: form.author,
        isbn: form.isbn,
        genre: form.category.trim() || null,
        total_copies: totalCopies,
        available_copies: newAvailable,
        status: newAvailable <= 0 ? 'checked_out' : 'available',
      };

      const fullPayload = { ...basePayload, cover_image: coverImageUrl, pdf_url: pdfUrl };
      if (!replacementCostMissingRef.current) fullPayload.replacement_cost = replacementCost;

      let { error: saveError } = await supabase.from('books').update(fullPayload).eq('id', original.id);
      let coverPdfSkipped = false;
      let replacementCostSkipped = false;

      if (saveError && isMissingColumnError(saveError)) {
        coverPdfSkipped = true;
        const retryPayload = { ...basePayload };
        if (!replacementCostMissingRef.current) retryPayload.replacement_cost = replacementCost;
        ({ error: saveError } = await supabase.from('books').update(retryPayload).eq('id', original.id));
      }

      if (saveError && isMissingColumnError(saveError) && !replacementCostMissingRef.current) {
        replacementCostMissingRef.current = true;
        replacementCostSkipped = true;
        ({ error: saveError } = await supabase.from('books').update(basePayload).eq('id', original.id));
      }

      if (saveError) throw saveError;

      if (coverPdfSkipped && attachingFiles) {
        showToast(
          'Book saved, but the cover/PDF could not be — the database is missing those columns. Ask an admin to run the setup SQL, then edit this book again to attach them.',
          'error'
        );
      } else if (replacementCostSkipped && replacementCost > 0) {
        showToast(
          'Book saved, but the replacement cost could not be — the database is missing that column. Ask an admin to run supabase/book_replacement_cost_schema.sql.',
          'error'
        );
      } else {
        showToast('Book updated successfully.');
      }

      setEditingBook(null);
      fetchBooks();
    } catch (err) {
      showToast(err.message || 'Something went wrong.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    setSubmitting(true);
    try {
      const { error: deleteError } = await supabase
        .from('books')
        .update({ is_deleted: true })
        .eq('id', deletingBook.id);
      if (deleteError) throw deleteError;

      showToast(`"${deletingBook.title}" moved to Trash.`);
      setDeletingBook(null);
      fetchBooks();
    } catch (err) {
      showToast(err.message || 'Failed to delete book.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestore(book) {
    try {
      const { error: restoreError } = await supabase
        .from('books')
        .update({ is_deleted: false })
        .eq('id', book.id);
      if (restoreError) throw restoreError;

      showToast(`"${book.title}" restored.`);
      fetchBooks();
    } catch (err) {
      showToast(err.message || 'Failed to restore book.', 'error');
    }
  }

  async function handleConfirmPermanentDelete() {
    setSubmitting(true);
    try {
      const { error: deleteError } = await supabase.from('books').delete().eq('id', permaDeleteBook.id);
      if (deleteError) throw deleteError;

      showToast(`"${permaDeleteBook.title}" permanently deleted.`);
      setPermaDeleteBook(null);
      fetchBooks();
    } catch (err) {
      const message = err.message?.includes('foreign key')
        ? 'This book has loan history and cannot be permanently deleted.'
        : err.message || 'Failed to permanently delete book.';
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { key: 'active', label: 'Inventory' },
              { key: 'trash', label: 'Trash' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  view === tab.key
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or author…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
          </div>

          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 sm:w-44"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Add Book
        </button>
      </div>

      <datalist id="book-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    'Cover',
                    'Title',
                    'Author',
                    'ISBN',
                    'Category',
                    'Replacement Cost',
                    'Total Copies',
                    'Available Copies',
                    'Actions',
                  ].map(
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
                {loading && Array.from({ length: 6 }).map((_, i) => <BookSkeletonRow key={i} />)}

                {!loading && filteredBooks.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                          <BookImage className="h-6 w-6 text-slate-400" />
                        </div>
                        {view === 'trash' ? (
                          <p className="text-sm text-slate-500">Trash is empty.</p>
                        ) : books.length > 0 ? (
                          <p className="text-sm text-slate-500">No books match your search or filter.</p>
                        ) : (
                          <>
                            <p className="text-sm text-slate-500">
                              No books found. Click &quot;Add Book&quot; to get started.
                            </p>
                            <button
                              type="button"
                              onClick={openAddModal}
                              className="mt-1 flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
                            >
                              <Plus className="h-4 w-4" />
                              Add Book
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredBooks.map((book) => {
                    const isLowStock = view === 'active' && (book.available_copies ?? 0) < 2;

                    return (
                      <tr
                        key={book.id}
                        className={`transition-colors ${
                          isLowStock ? 'bg-red-50 hover:bg-red-100/60' : 'hover:bg-primary-50/40'
                        }`}
                      >
                        <td className="px-6 py-4">
                          {/* book.cover_image is never populated here on purpose
                              (see fetchBooksNow) — this always shows the
                              placeholder icon in the list, regardless of
                              coverBookIds; the real image loads on demand in
                              the Edit modal. */}
                          <BookCoverThumb src={book.cover_image} />
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{book.title}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{book.author}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{book.isbn}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {book.genre ? (
                            <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700">
                              {book.genre}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {book.replacement_cost != null ? `$${Number(book.replacement_cost).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{book.total_copies ?? '—'}</td>
                        <td
                          className={`px-6 py-4 text-sm ${
                            isLowStock ? 'font-medium text-red-600' : 'text-slate-600'
                          }`}
                        >
                          {book.available_copies ?? '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            {pdfBookIds.has(book.id) && (
                              <button
                                type="button"
                                onClick={() => openReadPdf(book)}
                                title="Read PDF"
                                className="rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-600"
                              >
                                <FileText className="h-4 w-4" />
                              </button>
                            )}
                            {view === 'active' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditModal(book)}
                                  title="Edit"
                                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-primary-600"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingBook(book)}
                                  title="Delete"
                                  className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleRestore(book)}
                                  title="Restore"
                                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Restore
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPermaDeleteBook(book)}
                                  title="Delete Permanently"
                                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete Permanently
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setIsAddModalOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Add Book</h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} noValidate className="space-y-4 px-6 py-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                <input
                  value={addForm.title}
                  onChange={(e) => handleAddChange('title', e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    addFormErrors.title
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                  }`}
                />
                {addFormErrors.title && <p className="mt-1 text-xs text-red-600">{addFormErrors.title}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Author</label>
                <input
                  value={addForm.author}
                  onChange={(e) => handleAddChange('author', e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    addFormErrors.author
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                  }`}
                />
                {addFormErrors.author && (
                  <p className="mt-1 text-xs text-red-600">{addFormErrors.author}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">ISBN</label>
                <input
                  value={addForm.isbn}
                  onChange={(e) => handleAddChange('isbn', e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    addFormErrors.isbn
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                  }`}
                />
                {addFormErrors.isbn && <p className="mt-1 text-xs text-red-600">{addFormErrors.isbn}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Category <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  value={addForm.category}
                  onChange={(e) => handleAddChange('category', e.target.value)}
                  placeholder="e.g. Fiction, History, Textbook"
                  list="book-categories"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Replacement Cost ($) <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={addForm.replacement_cost}
                    onChange={(e) => handleAddChange('replacement_cost', e.target.value)}
                    placeholder="0.00"
                    className={`w-full rounded-lg border py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-1 ${
                      addFormErrors.replacement_cost
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                        : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                    }`}
                  />
                </div>
                {addFormErrors.replacement_cost && (
                  <p className="mt-1 text-xs text-red-600">{addFormErrors.replacement_cost}</p>
                )}
                <p className="mt-1.5 text-xs text-slate-400">
                  What a member is charged if this book is lost or damaged. Defaults to $0.00.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Total Copies</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={addForm.total_copies}
                  onChange={(e) => handleAddChange('total_copies', e.target.value)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    addFormErrors.total_copies
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                  }`}
                />
                {addFormErrors.total_copies && (
                  <p className="mt-1 text-xs text-red-600">{addFormErrors.total_copies}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Cover Image <span className="font-normal text-slate-400">(optional, max 1.5MB)</span>
                </label>
                <div className="flex items-center gap-4">
                  <BookCoverThumb src={addCoverDataUrl} size="lg" />
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <Upload className="h-4 w-4" />
                    {addCoverDataUrl ? 'Change Image' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAddCoverFileChange}
                    />
                  </label>
                </div>
                {addFormErrors.cover_image && (
                  <p className="mt-1 text-xs text-red-600">{addFormErrors.cover_image}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  PDF Document <span className="font-normal text-slate-400">(optional, max 3MB)</span>
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <FileText className="h-4 w-4" />
                    {addPdfFileName ? 'Replace PDF' : 'Upload PDF'}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleAddPdfFileChange}
                    />
                  </label>
                  {addPdfFileName && (
                    <span className="truncate text-sm text-slate-600" title={addPdfFileName}>
                      {addPdfFileName}
                    </span>
                  )}
                </div>
                {addFormErrors.pdf_file && (
                  <p className="mt-1 text-xs text-red-600">{addFormErrors.pdf_file}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {addSubmitting ? 'Saving…' : 'Add Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingBook && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setEditingBook(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Edit Book</h2>
              <button
                type="button"
                onClick={() => setEditingBook(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="max-h-[75vh] space-y-4 overflow-y-auto px-6 py-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    formErrors.title
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                  }`}
                />
                {formErrors.title && <p className="mt-1 text-xs text-red-600">{formErrors.title}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Author</label>
                <input
                  value={form.author}
                  onChange={(e) => setForm((prev) => ({ ...prev, author: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    formErrors.author
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                  }`}
                />
                {formErrors.author && <p className="mt-1 text-xs text-red-600">{formErrors.author}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">ISBN</label>
                <input
                  value={form.isbn}
                  onChange={(e) => setForm((prev) => ({ ...prev, isbn: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    formErrors.isbn
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                  }`}
                />
                {formErrors.isbn && <p className="mt-1 text-xs text-red-600">{formErrors.isbn}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Category <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g. Fiction, History, Textbook"
                  list="book-categories"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Replacement Cost ($) <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.replacement_cost}
                    onChange={(e) => setForm((prev) => ({ ...prev, replacement_cost: e.target.value }))}
                    placeholder="0.00"
                    className={`w-full rounded-lg border py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-1 ${
                      formErrors.replacement_cost
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                        : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                    }`}
                  />
                </div>
                {formErrors.replacement_cost && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.replacement_cost}</p>
                )}
                <p className="mt-1.5 text-xs text-slate-400">
                  What a member is charged if this book is lost or damaged. Defaults to $0.00.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Total Copies</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.total_copies}
                  onChange={(e) => setForm((prev) => ({ ...prev, total_copies: e.target.value }))}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    formErrors.total_copies
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
                  }`}
                />
                {formErrors.total_copies && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.total_copies}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Cover Image <span className="font-normal text-slate-400">(optional, max 1.5MB)</span>
                </label>
                <div className="flex items-center gap-4">
                  <BookCoverThumb src={coverDataUrl} size="lg" />
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <Upload className="h-4 w-4" />
                    {coverDataUrl ? 'Change Image' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCoverFileChange}
                    />
                  </label>
                </div>
                {formErrors.cover_image && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.cover_image}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  PDF Document <span className="font-normal text-slate-400">(optional, max 3MB)</span>
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <FileText className="h-4 w-4" />
                    {pdfFileName ? 'Replace PDF' : 'Upload PDF'}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handlePdfFileChange}
                    />
                  </label>
                  {pdfFileName && (
                    <span className="truncate text-sm text-slate-600" title={pdfFileName}>
                      {pdfFileName}
                    </span>
                  )}
                </div>
                {formErrors.pdf_file && (
                  <p className="mt-1 text-xs text-red-600">{formErrors.pdf_file}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBook(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || loadingExistingAssets}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  {loadingExistingAssets ? 'Loading…' : submitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingBook && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setDeletingBook(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Delete Book</h2>
              <button
                type="button"
                onClick={() => setDeletingBook(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-slate-600">
                Remove &quot;{deletingBook.title}&quot; from the inventory? You can restore it later from
                Trash.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingBook(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {submitting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {permaDeleteBook && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setPermaDeleteBook(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Delete Permanently</h2>
              <button
                type="button"
                onClick={() => setPermaDeleteBook(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-slate-600">
                Permanently delete &quot;{permaDeleteBook.title}&quot;? This removes it from the database
                entirely and <span className="font-semibold text-red-600">cannot be undone</span> — unlike
                the regular Delete action, there is no Trash to restore it from.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPermaDeleteBook(null)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPermanentDelete}
                  disabled={submitting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {submitting ? 'Deleting…' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {readingBook && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setReadingBook(null)}
        >
          <div
            className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="truncate text-lg font-semibold text-slate-900">{readingBook.title}</h2>
              <div className="flex shrink-0 items-center gap-2">
                {readingBook.pdf_url && (
                  <a
                    href={readingBook.pdf_url}
                    download={`${readingBook.title}.pdf`}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50"
                  >
                    Download PDF
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setReadingBook(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {readingPdf || !readingBook.pdf_url ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading PDF…
              </div>
            ) : (
              <iframe
                src={readingBook.pdf_url}
                title={`${readingBook.title} PDF`}
                className="flex-1 rounded-b-xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
