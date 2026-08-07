import { supabase } from '../lib/supabaseClient';

// A full snapshot for Settings' "Backup Library Data" button. Books and
// members are fetched in full — every row, regardless of trashed status.
// Trash for both is only a localStorage flag (see trashStore.js /
// memberTrashStore.js), the database rows were never filtered, so a real
// backup has to include them too, not just what's currently visible in the
// UI. Loans are limited to currently active (not yet returned) ones — this
// is meant as an operational snapshot ("what's checked out right now"),
// not a full historical export; use the Loans Report's Export to CSV for
// full loan history.
export async function getLibraryBackup() {
  const [
    { data: books, error: booksError },
    { data: members, error: membersError },
    { data: activeLoans, error: loansError },
  ] = await Promise.all([
    supabase.from('books').select('*'),
    supabase.from('members').select('*'),
    supabase
      .from('loans')
      .select('id, book_id, member_id, loan_date, due_date, books(title), members(full_name)')
      .is('return_date', null),
  ]);

  if (booksError) throw booksError;
  if (membersError) throw membersError;
  if (loansError) throw loansError;

  return {
    generatedAt: new Date().toISOString(),
    books: books ?? [],
    members: members ?? [],
    activeLoans: activeLoans ?? [],
  };
}
