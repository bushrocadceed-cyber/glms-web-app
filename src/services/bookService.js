import { supabase } from '../lib/supabaseClient';

// Excludes cover_image/pdf_url — same reasoning as InventoryPage.jsx's own
// list fetch: those columns store the whole file as base64 text (up to
// ~2MB/~4MB each), and selecting them for every row on every page load
// makes the response grow without bound as more books get covers/PDFs
// attached. Confirmed live: with select('*'), this exact query didn't even
// finish downloading in 60 seconds. Neither column is used by anything
// that lists books (Check-out modal, dashboard counts) — only the
// Inventory edit modal needs the real bytes, and it already fetches them
// on demand for one book at a time.
const BOOK_LIST_COLUMNS = 'id, title, author, isbn, genre, total_copies, available_copies, status, created_at';

export async function getTotalBooksCount() {
  const { count, error } = await supabase
    .from('books')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false);

  if (error) throw error;
  return count ?? 0;
}

export async function getAvailableBooksCount() {
  const { count, error } = await supabase
    .from('books')
    .select('*', { count: 'exact', head: true })
    .eq('is_deleted', false)
    .eq('status', 'available');

  if (error) throw error;
  return count ?? 0;
}

export async function getBooks() {
  const { data, error } = await supabase
    .from('books')
    .select(BOOK_LIST_COLUMNS)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getDeletedBooks() {
  const { data, error } = await supabase
    .from('books')
    .select(BOOK_LIST_COLUMNS)
    .eq('is_deleted', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function createBook(book) {
  const { data, error } = await supabase
    .from('books')
    .insert({ ...book, available_copies: book.total_copies, is_deleted: false })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBook(id, updates) {
  const { data, error } = await supabase
    .from('books')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function bulkCreateBooks(books) {
  const payload = books.map((book) => ({
    ...book,
    available_copies: book.total_copies,
    is_deleted: false,
  }));

  const { data, error } = await supabase.from('books').insert(payload).select();
  if (error) throw error;
  return data;
}

// PostgREST's .or() builds a raw filter string where commas and
// parentheses are syntax-significant — strip them out of user-typed search
// terms so an odd character never turns into a malformed filter.
function sanitizeSearchTerm(term) {
  return term.replace(/[(),]/g, '').trim();
}

// Same bloat risk as BOOK_LIST_COLUMNS above, just capped by `limit(5)`
// instead of the whole table — up to 5 full-size covers is still enough to
// make the search dropdown feel broken. Uses cover_thumbnail (the small,
// resized-at-upload copy InventoryPage.jsx generates — see its own
// resizeToThumbnailDataUrl) instead of cover_image, with the same
// missing-column fallback used throughout this project for that column,
// since it isn't guaranteed to exist on every database yet.
let coverThumbnailColumnMissing = false;

export async function searchBooks(term) {
  const safeTerm = sanitizeSearchTerm(term);
  if (!safeTerm) return [];

  const filter = `title.ilike.%${safeTerm}%,author.ilike.%${safeTerm}%,isbn.ilike.%${safeTerm}%`;
  const columns = coverThumbnailColumnMissing
    ? 'id, title, author, isbn'
    : 'id, title, author, isbn, cover_thumbnail';

  let { data, error } = await supabase
    .from('books')
    .select(columns)
    .eq('is_deleted', false)
    .or(filter)
    .limit(5);

  if (error && !coverThumbnailColumnMissing && (error.code === 'PGRST204' || error.code === '42703')) {
    coverThumbnailColumnMissing = true;
    ({ data, error } = await supabase
      .from('books')
      .select('id, title, author, isbn')
      .eq('is_deleted', false)
      .or(filter)
      .limit(5));
  }

  if (error) throw error;
  return data;
}

export async function getCategorySummary() {
  const { data, error } = await supabase
    .from('books')
    .select('genre')
    .eq('is_deleted', false)
    .not('genre', 'is', null);

  if (error) throw error;

  const counts = new Map();
  for (const row of data ?? []) {
    const key = row.genre.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export async function softDeleteBook(id) {
  const { error } = await supabase.rpc('soft_delete_book', { p_book_id: id });
  if (error) throw error;
}

export async function restoreBook(id) {
  const { error } = await supabase.from('books').update({ is_deleted: false }).eq('id', id);
  if (error) throw error;
}
