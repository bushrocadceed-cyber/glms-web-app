-- Galkio Library Management System — full database schema
--
-- Run this once, top to bottom, in the Supabase SQL Editor of a fresh
-- project to bring up everything the application needs: tables, the
-- signup trigger, loan/return/delete functions, indices, and Row Level
-- Security. Safe to re-run — every statement below is idempotent
-- (`if not exists`, `create or replace`, `drop ... if exists` before
-- recreating).
--
-- A note on provenance: the tables/functions in PART 1 reflect this
-- project's schema as it already existed — this file did not create them
-- originally, it reconstructs their definitions from every column and
-- behavior the application relies on, so a brand-new Supabase project can
-- be brought up from nothing. PARTS 2-4 (fine tracking, avatar storage,
-- activity logs, and every RLS policy) were authored directly as part of
-- this project's own migrations and are exact. If you're setting up
-- against a Supabase project that already has data, compare PART 1
-- against Database → Functions / Table Editor in the dashboard first
-- rather than assuming an exact match.

-- =========================================================================
-- PART 1 — core tables, signup trigger, loan functions
-- =========================================================================

create extension if not exists pgcrypto;

-- ---------- profiles ----------
-- One row per auth.users account. role drives every permission check in
-- the app (isAdminRole in src/lib/roles.js treats anything other than
-- 'admin' as non-admin — 'staff' and 'librarian' are both used as regular,
-- non-admin values). Kept as free text rather than a check constraint
-- since the app has always been able to write arbitrary role labels
-- without a database error.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'staff',
  created_at timestamptz not null default now()
);

-- New auth.users signups always land here as 'staff' — admin promotion is
-- always a separate, already-authenticated-admin action (see
-- profiles_update_admin below), never something a signup itself can grant.
-- security definer is what lets this insert past RLS during signup, before
-- the new session exists to satisfy any policy.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'staff')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- books ----------
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  isbn text,
  genre text,
  total_copies integer not null default 1,
  available_copies integer not null default 1,
  status text not null default 'available',
  cover_image text,
  pdf_url text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- members ----------
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text unique,
  phone text unique,
  membership_date timestamptz not null default now()
);

-- ---------- loans ----------
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  loan_date timestamptz not null default now(),
  due_date timestamptz not null,
  return_date timestamptz
);

-- Checks out a copy: inserts the loan row and decrements available_copies
-- in one transaction, so two staff members checking out the last copy at
-- the same moment can't both succeed. Raises rather than silently
-- succeeding if nothing's available — the app's own pre-check
-- (CreateLoanModal) is a UX convenience, not the real guard.
create or replace function public.create_loan(p_book_id uuid, p_member_id uuid, p_due_date timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_available integer;
  v_loan_id uuid;
begin
  select available_copies into v_available from public.books where id = p_book_id for update;

  if v_available is null then
    raise exception 'Book % not found', p_book_id;
  end if;

  if v_available < 1 then
    raise exception 'No available copies for book %', p_book_id;
  end if;

  insert into public.loans (book_id, member_id, loan_date, due_date)
  values (p_book_id, p_member_id, now(), p_due_date)
  returning id into v_loan_id;

  update public.books
  set available_copies = available_copies - 1,
      status = case when available_copies - 1 <= 0 then 'checked_out' else status end
  where id = p_book_id;

  return v_loan_id;
end;
$$;

-- Marks a loan returned and restores the copy, capped at total_copies so a
-- miscount can never push a book "above 100% available".
create or replace function public.return_loan(p_loan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_book_id uuid;
begin
  select book_id into v_book_id from public.loans where id = p_loan_id and return_date is null;

  if v_book_id is null then
    raise exception 'Loan % not found or already returned', p_loan_id;
  end if;

  update public.loans set return_date = now() where id = p_loan_id;

  update public.books
  set available_copies = least(total_copies, available_copies + 1),
      status = 'available'
  where id = v_book_id;
end;
$$;

-- Soft delete used by the Inventory Trash view — the row stays, only
-- is_deleted flips, so Restore is a plain update rather than a re-insert.
create or replace function public.soft_delete_book(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.books set is_deleted = true where id = p_book_id;
end;
$$;

-- =========================================================================
-- PART 2 — fine tracking (loans)
-- =========================================================================
alter table public.loans add column if not exists fine_amount numeric not null default 0;
alter table public.loans add column if not exists fine_paid boolean not null default false;

-- =========================================================================
-- PART 3 — replacement cost (books)
-- =========================================================================
-- What a member is charged if they lose or damage a copy.
alter table public.books add column if not exists replacement_cost numeric not null default 0;

-- =========================================================================
-- PART 4 — avatar storage (profiles)
-- =========================================================================
-- Base64 data URL stored directly in a text column — no Storage bucket
-- involved, matching how books.cover_image/pdf_url already work.
alter table public.profiles add column if not exists avatar_url text;

-- =========================================================================
-- PART 5 — activity_logs (audit trail)
-- =========================================================================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  user_role text,
  action text not null,
  details text,
  ip_address text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- PART 6 — indices
-- =========================================================================
create index if not exists books_is_deleted_idx on public.books (is_deleted);
create index if not exists books_isbn_idx on public.books (isbn);
create index if not exists members_email_idx on public.members (email);
create index if not exists members_phone_idx on public.members (phone);
create index if not exists loans_book_id_idx on public.loans (book_id);
create index if not exists loans_member_id_idx on public.loans (member_id);
create index if not exists loans_due_date_idx on public.loans (due_date);
create index if not exists loans_return_date_idx on public.loans (return_date);
create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_user_id_idx on public.activity_logs (user_id);

-- =========================================================================
-- PART 7 — Row Level Security
-- =========================================================================
-- Every policy below gates on auth.uid() is not null / auth.uid() = id
-- rather than `to authenticated` role-scoping — auth.uid() reads the JWT's
-- own "sub" claim directly, which every policy already relies on
-- elsewhere, so it can't silently no-op the way role-scoping did in
-- earlier testing on this project.

alter table public.profiles      enable row level security;
alter table public.books         enable row level security;
alter table public.members       enable row level security;
alter table public.loans         enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
drop policy if exists "books_all_authenticated" on public.books;
drop policy if exists "members_all_authenticated" on public.members;
drop policy if exists "loans_all_authenticated" on public.loans;
drop policy if exists "activity_logs_insert_self" on public.activity_logs;
drop policy if exists "activity_logs_select_admin" on public.activity_logs;

-- ---------- profiles ----------
-- Anyone signed in (any admin or staff) can see the full directory — this
-- is what Manage Staff / Admin Registration already assume.
create policy "profiles_select_authenticated" on public.profiles
  for select
  using (auth.uid() is not null);

-- Self-service edits (name, avatar) are always allowed, but the "with
-- check" pins role to whatever it already was — this can never be used to
-- self-escalate, even though it lets you update your own row.
create policy "profiles_update_self" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role is not distinct from (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Admins can update ANY profile, including role — the only path that can
-- promote/demote someone.
create policy "profiles_update_admin" on public.profiles
  for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (auth.uid() is not null);

-- Directory-only entries (Add Staff Member, Register Admin's rate-limit
-- fallback) are admin-only at the database level too. New auth signups
-- still get their row from the security-definer trigger above, which
-- bypasses RLS entirely, so this doesn't affect that path.
create policy "profiles_insert_admin" on public.profiles
  for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Only admins can delete a profile (Trash's permanent-delete step).
create policy "profiles_delete_admin" on public.profiles
  for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------- books / members / loans ----------
-- No public-facing/self-service portal — every page touching these tables
-- is already behind the login wall. Any signed-in admin or staff gets full
-- read/write; a request with no valid session gets nothing.
create policy "books_all_authenticated" on public.books
  for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "members_all_authenticated" on public.members
  for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "loans_all_authenticated" on public.loans
  for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------- activity_logs ----------
-- Anyone signed in can write a log entry, but only attributed to
-- themselves (user_id must equal their own auth.uid()) — nobody can log an
-- action under someone else's name.
create policy "activity_logs_insert_self" on public.activity_logs
  for insert
  with check (auth.uid() is not null and user_id = auth.uid());

-- Only admins can read the log — an oversight tool for monitoring staff
-- activity, not something every account should be able to browse. No
-- update/delete policy on purpose: the log is append-only.
create policy "activity_logs_select_admin" on public.activity_logs
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------- verify ----------
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where tablename in ('profiles', 'books', 'members', 'loans', 'activity_logs')
-- order by tablename, policyname;
