-- Galkio Library Management System — Row Level Security policies
--
-- Superseded by schema.sql, which includes this file's content along with
-- every table/column/index the project needs. Kept here standalone in case
-- you ever want to re-apply just the RLS policies on their own.
--
-- Why this file exists: a live check against this project's Supabase
-- instance confirmed the anon key (fully unauthenticated, no login) can
-- read AND write every table directly via the REST API, including setting
-- any profile's role to 'admin'. This closes that gap at the database
-- level, where it can't be bypassed by the client.
--
-- Revision note: the first version of this file scoped every policy
-- "to authenticated". After running it, signed-in admins got "profile
-- couldn't be loaded at all" — the SELECT policy was silently not
-- matching their own session at all, which points at a role-claim
-- mismatch (the connecting role not being recognized as exactly
-- "authenticated" in this project's setup) rather than a logic bug in the
-- policy itself. This version removes the "to authenticated" role
-- restriction from every policy and instead gates purely on
-- auth.uid() is not null — auth.uid() reads the JWT's own "sub" claim
-- directly, which is the same fundamental primitive every policy below
-- already relies on elsewhere (e.g. auth.uid() = id), so it can't silently
-- no-op the way role-scoping did. A request with no valid session has
-- auth.uid() = null and is denied exactly the same as before.
--
-- Run this once in the Supabase SQL Editor. Safe to re-run — it disables
-- RLS, drops every policy by name, then rebuilds everything from scratch,
-- so there's no partially-applied state left over from an earlier run.

alter table public.profiles disable row level security;
alter table public.books    disable row level security;
alter table public.members  disable row level security;
alter table public.loans    disable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
drop policy if exists "books_all_authenticated" on public.books;
drop policy if exists "members_all_authenticated" on public.members;
drop policy if exists "loans_all_authenticated" on public.loans;

alter table public.profiles enable row level security;
alter table public.books    enable row level security;
alter table public.members  enable row level security;
alter table public.loans    enable row level security;

-- ---------- profiles ----------
-- Anyone signed in (any admin or staff) can see the full directory — this
-- is what the Manage Staff / Admin Registration pages already assume.
create policy "profiles_select_authenticated" on public.profiles
  for select
  using (auth.uid() is not null);

-- Self-service edits (name, avatar_url if added) are always allowed, but
-- the "with check" pins role to whatever it already was — so this policy
-- can never be used to self-escalate, even though it lets you update your
-- own row.
create policy "profiles_update_self" on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role is not distinct from (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Admins can update ANY profile, including role — this is the only path
-- that can promote/demote someone, matching the app's own "use Edit to
-- promote" design.
create policy "profiles_update_admin" on public.profiles
  for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (auth.uid() is not null);

-- Creating a directory-only entry for someone else (Add Staff Member,
-- Register Admin's rate-limit fallback) is an admin-only action in the UI
-- already — this makes it one at the database level too. New auth
-- signups still get their own profiles row from the on_auth_user_created
-- trigger, which runs as a security-definer function and bypasses RLS
-- entirely, so this doesn't affect that path.
create policy "profiles_insert_admin" on public.profiles
  for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Only admins can delete a profile (Trash's permanent-delete step).
create policy "profiles_delete_admin" on public.profiles
  for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ---------- books / members / loans ----------
-- This app has no public-facing/self-service portal — every page that
-- touches these tables is already behind the login wall (ProtectedRoute).
-- Any signed-in admin or staff gets full read/write; a request with no
-- valid session (auth.uid() is null) gets nothing.
create policy "books_all_authenticated" on public.books
  for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "members_all_authenticated" on public.members
  for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "loans_all_authenticated" on public.loans
  for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

-- ---------- verify ----------
-- Run this after the above to confirm what's actually in place. You
-- should see 8 rows (5 for profiles, 1 each for books/members/loans).
-- select schemaname, tablename, policyname, roles, cmd, qual, with_check
-- from pg_policies
-- where tablename in ('profiles', 'books', 'members', 'loans')
-- order by tablename, policyname;
