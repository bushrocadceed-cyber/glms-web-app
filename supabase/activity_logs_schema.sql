-- Superseded by schema.sql, which includes this file's content along with
-- every table/column/index the project needs. Kept here standalone in case
-- you ever want to re-apply just this piece on its own.
--
-- Activity Logs — audit trail of key actions taken by admins/staff.
-- Run this once in the Supabase SQL Editor. Safe to re-run.
--
-- user_id references auth.users but ON DELETE SET NULL rather than CASCADE
-- — a log entry is a historical record; if the account that performed an
-- action is later deleted, the entry should survive (with user_id null),
-- not disappear. user_name/user_role are captured at write time for the
-- same reason: what the log shows should reflect who they were when the
-- action happened, not a live join that could change (or vanish) later.
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

create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_user_id_idx on public.activity_logs (user_id);

alter table public.activity_logs enable row level security;

drop policy if exists "activity_logs_insert_self" on public.activity_logs;
drop policy if exists "activity_logs_select_admin" on public.activity_logs;

-- Any signed-in admin or staff can write a log entry, but only for
-- themselves — user_id must match the caller's own auth.uid(), so nobody
-- can attribute an action to someone else's name. Matches this project's
-- established auth.uid()-based policy style (see rls_policies.sql) rather
-- than "to authenticated" role-scoping.
create policy "activity_logs_insert_self" on public.activity_logs
  for insert
  with check (auth.uid() is not null and user_id = auth.uid());

-- Only admins can read the log — this is an oversight tool for monitoring
-- staff activity, not something every staff account should be able to
-- browse. The ActivityLogsPage route is also gated to admins in the
-- frontend (App.jsx); this is what actually enforces it at the database
-- level, the same "route gate is UX, RLS is the real enforcement" split
-- already used for profiles' admin-only policies.
create policy "activity_logs_select_admin" on public.activity_logs
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- No update/delete policy on purpose — an audit log should be
-- append-only. With RLS enabled and no policy for those commands, both are
-- denied by default for every role except a service_role connection
-- (Supabase dashboard SQL editor, or a future Edge Function), which is the
-- correct place for any log-retention/cleanup job to live, not the app.

-- ---------- verify ----------
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where tablename = 'activity_logs'
-- order by policyname;
