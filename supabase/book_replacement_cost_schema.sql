-- Superseded by schema.sql, which includes this file's content along with
-- every table/column/index the project needs. Kept here standalone in case
-- you ever want to re-apply just this piece on its own.
--
-- Adds an optional replacement cost to books — what a member would be
-- charged if they lose or damage a copy. Safe to re-run. Run this in the
-- Supabase SQL Editor.
alter table public.books add column if not exists replacement_cost numeric not null default 0;
