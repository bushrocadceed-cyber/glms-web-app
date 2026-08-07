import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import MembersTable from '../components/members/MembersTable';
import MemberFormModal from '../components/members/MemberFormModal';
import MemberViewModal from '../components/members/MemberViewModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useMembers } from '../hooks/useMembers';
import {
  createMember,
  deleteMember,
  permanentlyDeleteMember,
  restoreMember,
  updateMember,
} from '../services/memberService';
import { setAvatar } from '../lib/avatarStore';
import { useToast } from '../context/ToastContext';

export default function MembersPage() {
  const [view, setView] = useState('active'); // 'active' | 'trash'
  const { members, trashCount, loading, error, refetch } = useMembers({ trash: view === 'trash' });
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [formModal, setFormModal] = useState(null); // { mode: 'add' | 'edit', member? }
  const [viewingMember, setViewingMember] = useState(null);
  const [deletingMember, setDeletingMember] = useState(null);
  const [permaDeletingMember, setPermaDeletingMember] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Shown inline in the modal itself (see formError prop below), not just
  // as a toast — a 409 duplicate-email/phone error is something the user
  // needs to actually read and act on while the form is still open, and a
  // toast auto-dismisses in 3s regardless of whether they've seen it yet.
  const [formError, setFormError] = useState('');

  // Lets the Dashboard's Quick Actions and global search deep-link here —
  // ?action=add opens this page straight into the add-member modal, ?q=
  // prefills the search box. Consumed once, then cleared from the URL so a
  // page refresh doesn't keep reopening the modal.
  useEffect(() => {
    const action = searchParams.get('action');
    const q = searchParams.get('q');
    if (action === 'add') setFormModal({ mode: 'add' });
    if (q) setSearch(q);
    if (action || q) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;
    return members.filter(
      (member) =>
        member.full_name?.toLowerCase().includes(term) || member.email?.toLowerCase().includes(term)
    );
  }, [members, search]);

  async function handleFormSubmit({ avatarDataUrl, ...values }) {
    setSubmitting(true);
    setFormError('');
    try {
      // avatarDataUrl never goes to Supabase — members has no column for
      // it, and sending a multi-hundred-KB base64 string in an insert/
      // update payload against a table that doesn't expect it would just
      // 400. It's saved separately, straight to localStorage, once the
      // row's real id is known — a new member doesn't have one until
      // createMember() returns it.
      if (formModal.mode === 'add') {
        const created = await createMember(values);
        setAvatar(created.id, avatarDataUrl);
        showToast('Member registered successfully.');
      } else {
        await updateMember(formModal.member.id, values);
        setAvatar(formModal.member.id, avatarDataUrl);
        showToast('Member updated successfully.');
      }
      setFormModal(null);
      refetch();
    } catch (err) {
      // createMember/updateMember already translate a 409 unique-constraint
      // violation (duplicate email/phone) into a plain-language message —
      // this just displays whatever they threw, generic or not, and
      // crucially never re-throws, so the modal always stays open and
      // interactive instead of hanging or silently closing on failure.
      const message = err.message || 'Something went wrong. Please try again.';
      setFormError(message);
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Soft delete — moves the member to Trash on this browser (see
  // memberTrashStore.js via memberService.js). Their row is untouched, so
  // this can be undone with handleRestore below.
  async function handleConfirmDelete() {
    setSubmitting(true);
    try {
      await deleteMember(deletingMember.id);
      showToast(`"${deletingMember.full_name}" moved to Trash.`);
      setDeletingMember(null);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to remove member.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestore(member) {
    try {
      await restoreMember(member.id);
      showToast(`"${member.full_name}" restored.`);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to restore member.', 'error');
    }
  }

  // The real delete — only reachable from the Trash view, and the only one
  // of these three that actually removes the database row.
  async function handleConfirmPermanentDelete() {
    setSubmitting(true);
    try {
      await permanentlyDeleteMember(permaDeletingMember.id);
      showToast(`"${permaDeletingMember.full_name}" permanently deleted.`);
      setPermaDeletingMember(null);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to permanently delete member.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {[
              { key: 'active', label: 'Members' },
              { key: 'trash', label: `Trash${trashCount > 0 ? ` (${trashCount})` : ''}` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  view === tab.key
                    ? 'bg-white text-primary-700 shadow-sm dark:bg-slate-700 dark:text-primary-300'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
          </div>
        </div>

        {view === 'active' && (
          <button
            type="button"
            onClick={() => {
              setFormError('');
              setFormModal({ mode: 'add' });
            }}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
          >
            <Plus className="h-4 w-4" />
            Add Member
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Failed to load members: {error.message}</span>
          <button type="button" onClick={refetch} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <MembersTable
        members={filteredMembers}
        loading={loading}
        view={view}
        onView={setViewingMember}
        onEdit={(member) => {
          setFormError('');
          setFormModal({ mode: 'edit', member });
        }}
        onDelete={setDeletingMember}
        onRestore={handleRestore}
        onPermanentDelete={setPermaDeletingMember}
      />

      {formModal && (
        <MemberFormModal
          mode={formModal.mode}
          initialValues={formModal.member}
          submitting={submitting}
          error={formError}
          onClose={() => {
            setFormError('');
            setFormModal(null);
          }}
          onSubmit={handleFormSubmit}
        />
      )}

      {viewingMember && <MemberViewModal member={viewingMember} onClose={() => setViewingMember(null)} />}

      {deletingMember && (
        <ConfirmDialog
          title="Move to Trash"
          message={`Move "${deletingMember.full_name}" to Trash? Their record can be restored later from the Trash tab.`}
          confirmLabel="Move to Trash"
          loading={submitting}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeletingMember(null)}
        />
      )}

      {permaDeletingMember && (
        <ConfirmDialog
          title="Delete Permanently"
          message={`Permanently delete "${permaDeletingMember.full_name}"? This removes their record from the database entirely and cannot be undone — unlike moving to Trash, there is no way to restore it afterward.`}
          confirmLabel="Delete Permanently"
          loading={submitting}
          onConfirm={handleConfirmPermanentDelete}
          onClose={() => setPermaDeletingMember(null)}
        />
      )}
    </div>
  );
}
