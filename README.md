# Galkio Library Management System (GLMS)

A full-stack library management dashboard for administrators and staff — book inventory, member records, loans and fines, staff/admin accounts, and an audit trail, built on React and Supabase.

## Tech Stack

- [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/) (with dark/light theme support)
- [Supabase](https://supabase.com/) — Postgres database, Authentication, Row Level Security, Edge Functions
- [React Router](https://reactrouter.com/)
- [Recharts](https://recharts.org/) for dashboard charts
- [lucide-react](https://lucide.dev/) for icons

## Core Features

- **Authentication & Role-Based Access Control** — Supabase Auth login; Admin, Librarian, and Staff roles gate both routes (frontend) and data access (Row Level Security). Admin-only areas show a clear access message instead of failing silently.
- **Book Inventory Management** — add/edit books with cover image and PDF upload, categories, low-stock highlighting, and a Trash/Restore workflow.
- **Loans & Fine System** — checkout and return workflow with overdue detection, a Renew action, All/Active/Overdue/Returned filter tabs, and an automatic fine calculator with an admin-adjustable daily rate. Returning an overdue book opens a confirmation step showing the calculated fine, with the option to adjust, waive, or mark it paid on the spot.
- **Member Management** — member directory with profile pictures and a Trash/Restore workflow.
- **Staff & Admin Management** — separate Staff and Admin directories, profile pictures, Active/Inactive status, password reset, and Trash/Restore. Admin Registration creates real dashboard logins.
- **Activity Logs / Audit Trail** — every key action (adding a book, issuing or returning a loan, updating system settings, and more) is recorded with who performed it, when, and what changed. Searchable and filterable by action, role, and date.
- **Reports & CSV Export** — loans, inventory, and fines reports, each exportable to CSV.
- **Settings** — editable profile, library-wide rules (loan duration, max books per member, fine rate), password change, and a one-click JSON backup of books/members/active loans.
- **Dashboard** — live stats, inventory/loan charts, a due-dates calendar, recent activity feed, quick actions, and overdue notifications.
- **Global Search** — search books and members from the header.
- **Dark / Light Theme** — persisted per browser.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- A [Supabase](https://supabase.com/) project (free tier is sufficient) with Authentication enabled

### Environment Variables

Copy `.env.example` to `.env` and fill in your Supabase project's URL and anon/publishable key (Project Settings → API):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key-here
```

Only the anon/publishable key ever belongs here — never a service_role/secret key.

### Installation

```
npm install
```

### Database Setup

In the Supabase SQL Editor, run **`supabase/schema.sql`** once. It creates every table, function, index, and Row Level Security policy the application needs, and is safe to re-run.

> `supabase/schema.sql` reconstructs the base `profiles` / `books` / `members` / `loans` tables and their `create_loan` / `return_loan` / `soft_delete_book` functions from the columns and behavior the application relies on. If you're pointing this project at a Supabase database that already has data in it, compare that section against Database → Functions / Table Editor in your dashboard before assuming an exact match — the fine tracking, avatar storage, activity log, and RLS sections lower in the file are authoritative either way.

### Running the App

```
npm run dev
```

Then open the printed local URL (typically `http://localhost:5173`).

### Production Build

```
npm run build
```

Output is written to `dist/`. Preview it locally with `npm run preview`.

### Optional: Edge Functions

`supabase/functions/invite-staff` and `supabase/functions/create-staff-account` back the "Invite via Email" flow. Deploy them with the [Supabase CLI](https://supabase.com/docs/guides/cli) if you want that flow available:

```
supabase functions deploy invite-staff
supabase functions deploy create-staff-account
```

## Project Structure

```
src/
  pages/        top-level routed pages
  components/   reusable UI, layout, and feature components
  context/      React context providers (Auth, Theme, Toast)
  services/     Supabase data-access functions
  hooks/        data-fetching hooks
  lib/          utility modules (Supabase client, CSV export, local caches)
supabase/
  schema.sql          full database schema — run this for setup
  rls_policies.sql    Row Level Security policies (standalone reference)
  fines_schema.sql    fine tracking columns (standalone reference)
  activity_logs_schema.sql   activity log table (standalone reference)
  profile_avatar_schema.sql  avatar storage column (standalone reference)
  functions/          Edge Functions (email invites)
```

## Security Notes

- Row Level Security is enforced at the database level (see `supabase/schema.sql`) — the frontend's route guards are a UX convenience, not the actual access control boundary.
- A new signup is always created with the `staff` role by a database trigger; promoting an account to `admin` is always a separate, already-authenticated-admin action, never something a signup can grant itself.
- Profile pictures are stored as base64 data in `profiles.avatar_url`, cached locally for fast, synchronous access, and re-synced from the database whenever a profile loads — no Supabase Storage bucket required.
