import { supabase } from '../lib/supabaseClient';

export async function getLoansReport({ startDate, endDate, status } = {}) {
  let query = supabase
    .from('loans')
    .select('id, loan_date, due_date, return_date, books(title), members(full_name)')
    .order('loan_date', { ascending: false });

  if (startDate) query = query.gte('loan_date', startDate);
  if (endDate) query = query.lte('loan_date', endDate);

  const now = new Date().toISOString();
  if (status === 'returned') {
    query = query.not('return_date', 'is', null);
  } else if (status === 'borrowed') {
    query = query.is('return_date', null).gte('due_date', now);
  } else if (status === 'overdue') {
    query = query.is('return_date', null).lt('due_date', now);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getDashboardChartData() {
  const [
    { data: books, error: booksError },
    { data: loans, error: loansError },
  ] = await Promise.all([
    supabase.from('books').select('total_copies, available_copies').eq('is_deleted', false),
    supabase.from('loans').select('due_date, return_date'),
  ]);

  if (booksError) throw booksError;
  if (loansError) throw loansError;

  const totalCopies = (books ?? []).reduce((sum, b) => sum + (b.total_copies ?? 0), 0);
  const availableCopies = (books ?? []).reduce((sum, b) => sum + (b.available_copies ?? 0), 0);
  const checkedOutCopies = Math.max(0, totalCopies - availableCopies);

  const now = new Date();
  let active = 0;
  let overdue = 0;
  let returned = 0;

  for (const loan of loans ?? []) {
    if (loan.return_date) {
      returned += 1;
    } else if (loan.due_date && new Date(loan.due_date) < now) {
      overdue += 1;
    } else {
      active += 1;
    }
  }

  return {
    inventory: [
      { name: 'Available', value: availableCopies },
      { name: 'Checked Out', value: checkedOutCopies },
    ],
    loans: [
      { name: 'Active', value: active },
      { name: 'Overdue', value: overdue },
      { name: 'Returned', value: returned },
    ],
  };
}

export async function getRecentActivity(limit = 8) {
  const [
    { data: books, error: booksError },
    { data: loans, error: loansError },
    { data: members, error: membersError },
  ] = await Promise.all([
    supabase
      .from('books')
      .select('id, title, created_at')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('loans')
      .select('id, loan_date, return_date, books(title), members(full_name)')
      .order('loan_date', { ascending: false })
      .limit(limit),
    supabase
      .from('members')
      .select('id, full_name, membership_date')
      .order('membership_date', { ascending: false })
      .limit(limit),
  ]);

  if (booksError) throw booksError;
  if (loansError) throw loansError;
  if (membersError) throw membersError;

  const activities = [
    ...(books ?? []).map((book) => ({
      id: `book-${book.id}`,
      label: `Book added: ${book.title}`,
      timestamp: book.created_at,
    })),
    ...(members ?? []).map((member) => ({
      id: `member-${member.id}`,
      label: `Member joined: ${member.full_name}`,
      timestamp: member.membership_date,
    })),
    ...(loans ?? []).flatMap((loan) => {
      const bookTitle = loan.books?.title ?? 'a book';
      const memberName = loan.members?.full_name ?? 'a member';
      const entries = [
        {
          id: `loan-${loan.id}`,
          label: `Loan created: ${bookTitle} → ${memberName}`,
          timestamp: loan.loan_date,
        },
      ];
      if (loan.return_date) {
        entries.push({
          id: `return-${loan.id}`,
          label: `Returned: ${bookTitle}`,
          timestamp: loan.return_date,
        });
      }
      return entries;
    }),
  ];

  return activities
    .filter((entry) => entry.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

export async function getInventoryReport() {
  const { data, error } = await supabase
    .from('books')
    .select('id, title, available_copies')
    .eq('is_deleted', false);

  if (error) throw error;

  const totalBooks = data.length;
  const availableBooks = data.filter((book) => (book.available_copies ?? 0) > 0).length;
  const lowStockBooks = data.filter((book) => (book.available_copies ?? 0) < 2);

  return { totalBooks, availableBooks, lowStockBooks };
}
