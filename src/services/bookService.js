import { supabase } from '../lib/supabaseClient';

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
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getDeletedBooks() {
  const { data, error } = await supabase
    .from('books')
    .select('*')
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

export async function searchBooks(term) {
  const safeTerm = sanitizeSearchTerm(term);
  if (!safeTerm) return [];

  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, isbn, cover_image')
    .eq('is_deleted', false)
    .or(`title.ilike.%${safeTerm}%,author.ilike.%${safeTerm}%,isbn.ilike.%${safeTerm}%`)
    .limit(5);

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
