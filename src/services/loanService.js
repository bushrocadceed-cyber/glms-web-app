import { supabase } from '../lib/supabaseClient';
import {
  areFineColumnsKnownMissing,
  recordFineColumnsMissing,
  recordFineColumnsPresent,
  recordLoanRow,
} from '../lib/loanFineColumns';
import { computeFine } from '../lib/fines';

export async function getOverdueLoansCount() {
  const { count, error } = await supabase
    .from('loans')
    .select('*', { count: 'exact', head: true })
    .is('return_date', null)
    .lt('due_date', new Date().toISOString());

  if (error) throw error;
  return count ?? 0;
}

export async function getOverdueNotifications() {
  const { data, error } = await supabase
    .from('loans')
    .select('id, due_date, books(title), members(full_name)')
    .is('return_date', null)
    .lt('due_date', new Date().toISOString())
    .order('due_date', { ascending: true })
    .limit(10);

  if (error) throw error;
  return data;
}

export async function getActiveLoans() {
  const { data, error } = await supabase
    .from('loans')
    .select('id, due_date, loan_date, return_date, books(title), members(full_name)')
    .is('return_date', null)
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data;
}

// Every loan regardless of status — backs the Loans page, which filters
// client-side into All/Active/Overdue/Returned (see lib/loanStatus.js) from
// one fetch rather than a separate query per tab. select('*, ...') rather
// than an explicit scalar column list: '*' always succeeds regardless of
// which optional columns exist (fine_amount/fine_paid included, for the
// Pay Fine action in LoansTable) while still pulling in the embedded
// books(title)/members(full_name) the table needs — confirmed live that
// PostgREST allows mixing '*' with embedded resource selections in one
// select string.
export async function getAllLoans() {
  const { data, error } = await supabase
    .from('loans')
    .select('*, books(title), members(full_name)')
    .order('loan_date', { ascending: false });

  if (error) throw error;
  if (data?.[0]) recordLoanRow(data[0]);
  return data;
}

const DEFAULT_RENEWAL_DAYS = 7;

// Extends from the loan's current due_date (not from today) — the usual
// meaning of "renew": push the deadline back by N days from where it
// already stands, whether or not it's currently overdue.
export async function renewLoan(loanId, extendByDays = DEFAULT_RENEWAL_DAYS) {
  const { data: loanRow, error: loanError } = await supabase
    .from('loans')
    .select('due_date')
    .eq('id', loanId)
    .single();

  if (loanError) throw loanError;

  const newDueDate = new Date(loanRow.due_date);
  newDueDate.setDate(newDueDate.getDate() + extendByDays);

  const { error } = await supabase
    .from('loans')
    .update({ due_date: newDueDate.toISOString() })
    .eq('id', loanId);

  if (error) throw error;
  return newDueDate.toISOString();
}

export async function createLoan(bookId, memberId, dueDate) {
  const { data, error } = await supabase.rpc('create_loan', {
    p_book_id: bookId,
    p_member_id: memberId,
    p_due_date: dueDate,
  });

  if (error) throw error;
  return data;
}

// fineAmount/finePaid come from ReturnBookModal — it shows the admin the
// auto-calculated fine (via computeFine in lib/fines.js) up front and lets
// them adjust or waive it and/or mark it paid immediately, so by the time
// this runs the number is already whatever the admin decided, not
// recalculated here. Defaults (0, false) cover a plain on-time return, or
// any caller that doesn't go through that modal.
export async function returnLoan(loanId, { fineAmount = 0, finePaid = false } = {}) {
  // Parameter name is loan_id, not p_loan_id — confirmed against the live
  // database (a p_loan_id call 404s with PGRST202 and a "Perhaps you meant
  // ... return_loan(loan_id)" hint). The function itself does exist and
  // works; only the parameter name this client sent was wrong.
  const { data, error } = await supabase.rpc('return_loan', {
    loan_id: loanId,
  });

  if (error) throw error;

  // Skipped entirely once fine_amount/fine_paid are known missing (setup
  // SQL not run) rather than firing a write that's guaranteed to 400 — the
  // book is still marked returned above either way.
  if (areFineColumnsKnownMissing()) return data;

  const { error: fineError } = await supabase
    .from('loans')
    .update({ fine_amount: fineAmount, fine_paid: finePaid })
    .eq('id', loanId);

  if (fineError) {
    if (fineError.code === '42703' || fineError.code === 'PGRST204') recordFineColumnsMissing();
    else throw fineError;
  } else {
    recordFineColumnsPresent();
  }

  return data;
}

// Returns two kinds of rows merged into one list:
//
// 1. Currently overdue, still-open loans (return_date is null, due_date
//    already passed) — the fine here is calculated live from due_date vs.
//    today, right in this function, so these always show up regardless of
//    whether fine_amount/fine_paid exist in the database yet. finalized:
//    false marks these as not yet written anywhere.
//
// 2. Already-returned loans with a finalized fine on record (fine_amount >
//    0, written by returnLoan() or by markFineAsPaid() below) — only
//    queryable once those columns are confirmed to exist; skipped entirely
//    once known missing rather than firing a request guaranteed to 400.
//    finalized: true marks these as backed by a real database value.
export async function getFines() {
  const { data: overdueLoans, error: overdueError } = await supabase
    .from('loans')
    .select('id, due_date, return_date, books(title), members(full_name)')
    .is('return_date', null)
    .lt('due_date', new Date().toISOString())
    .order('due_date', { ascending: true });

  if (overdueError) throw overdueError;

  const liveRows = (overdueLoans ?? []).map((loan) => {
    const { daysLate, amount } = computeFine(loan.due_date, loan.return_date);
    return { ...loan, daysLate, fine_amount: amount, fine_paid: false, finalized: false };
  });

  let finalizedRows = [];
  if (!areFineColumnsKnownMissing()) {
    const { data, error } = await supabase
      .from('loans')
      .select('id, due_date, return_date, fine_amount, fine_paid, books(title), members(full_name)')
      .not('return_date', 'is', null)
      .gt('fine_amount', 0)
      .order('return_date', { ascending: false });

    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204') {
        recordFineColumnsMissing();
      } else {
        throw error;
      }
    } else {
      recordFineColumnsPresent();
      finalizedRows = data.map((loan) => ({
        ...loan,
        daysLate: computeFine(loan.due_date, loan.return_date).daysLate,
        finalized: true,
      }));
    }
  }

  // finesTrackingReady tells the caller whether "Mark as Paid" will actually
  // work — false means the setup SQL hasn't been run, so the live-calculated
  // rows above are display-only until it has been (finalizing one requires
  // somewhere to write fine_amount/fine_paid to).
  return { rows: [...liveRows, ...finalizedRows], finesTrackingReady: !areFineColumnsKnownMissing() };
}

// Used for the Dashboard's stat card. Adds two sums that can never double
// count each other: live-calculated fines on loans that are overdue right
// now but haven't been returned or manually paid yet (computed straight
// from due_date, so this half works even before the fine_amount/fine_paid
// setup SQL has been run — previously this whole function returned a flat
// 0 until then), plus already-finalized unpaid fines recorded by
// returnLoan() or markFineAsPaid() on loans that HAVE been returned.
// markFineAsPaid always writes fine_paid: true in the same update that
// sets fine_amount, so a still-open loan can never have fine_amount > 0
// AND fine_paid = false at once — the two queries below can't overlap.
// Mirrors the same live-vs-finalized split getFines() uses for the Fines
// report, so the two stay consistent with each other.
export async function getTotalOutstandingFines() {
  const { data: overdueLoans, error: overdueError } = await supabase
    .from('loans')
    .select('due_date')
    .is('return_date', null)
    .lt('due_date', new Date().toISOString());

  const liveTotal = overdueError
    ? 0
    : (overdueLoans ?? []).reduce((sum, loan) => sum + computeFine(loan.due_date).amount, 0);

  if (areFineColumnsKnownMissing()) return liveTotal;

  const { data, error } = await supabase
    .from('loans')
    .select('fine_amount')
    .eq('fine_paid', false)
    .gt('fine_amount', 0);

  if (error) {
    recordFineColumnsMissing();
    return liveTotal;
  }

  recordFineColumnsPresent();
  const finalizedTotal = (data ?? []).reduce((sum, row) => sum + Number(row.fine_amount ?? 0), 0);
  return liveTotal + finalizedTotal;
}

// Takes the whole fine row (not just an id) because a still-open overdue
// loan has never had its fine_amount written to the database — getFines()
// only calculated it on the fly. Marking it paid is what finalizes that
// number: this writes fine_amount and fine_paid together in one update, so
// a fine can be settled at any time, even before the book itself is
// returned, exactly as library fines are usually handled in practice.
export async function markFineAsPaid(loan) {
  if (areFineColumnsKnownMissing()) {
    throw new Error("Fines tracking isn't set up yet — run the setup SQL first (see supabase/fines_schema.sql).");
  }
  const { error } = await supabase
    .from('loans')
    .update({ fine_amount: loan.fine_amount, fine_paid: true })
    .eq('id', loan.id);
  if (error) throw error;
}

export async function getLoanHistoryForBook(bookId) {
  const { data, error } = await supabase
    .from('loans')
    .select('id, loan_date, due_date, return_date, members(full_name)')
    .eq('book_id', bookId)
    .order('loan_date', { ascending: false });

  if (error) throw error;
  return data;
}
