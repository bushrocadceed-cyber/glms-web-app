-- Superseded by schema.sql, which includes this file's content along with
-- every table/column/index the project needs. Kept here standalone in case
-- you ever want to re-apply just this piece on its own.
--
-- Adds fine tracking to loans. Safe to run more than once (IF NOT EXISTS
-- guards both columns). Run this in the Supabase SQL Editor.
--
-- fine_amount: the finalized/collectible amount for a loan's fine, in
-- whatever currency unit the app displays (see FINE_PER_DAY_LATE in
-- loanService.js). Left at the default (0) until a fine is actually
-- calculated and finalized — the Fines report calculates a live amount for
-- currently-overdue loans on the fly and only writes it here once staff
-- click "Mark as Paid".
--
-- fine_paid: whether that finalized amount has been collected.
alter table loans add column if not exists fine_amount numeric not null default 0;
alter table loans add column if not exists fine_paid boolean not null default false;
