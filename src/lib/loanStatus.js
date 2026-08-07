// Single source of truth for a loan's status — used by the Loans page's
// filter tabs, LoansTable's badge, and to decide whether Return needs the
// fine-confirmation modal (only overdue loans can have a fine).
export function getLoanStatus(loan) {
  if (loan.return_date) return 'returned';
  if (loan.due_date && new Date(loan.due_date) < new Date()) return 'overdue';
  return 'active';
}
