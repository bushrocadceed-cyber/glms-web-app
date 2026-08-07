import { useEffect, useRef, useState } from 'react';
import { ShieldPlus } from 'lucide-react';
import StaffTable from '../components/staff/StaffTable';
import EditStaffModal from '../components/staff/EditStaffModal';
import RegisterAdminModal from '../components/staff/RegisterAdminModal';
import ResetPasswordEmailModal from '../components/staff/ResetPasswordEmailModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useStaff } from '../hooks/useStaff';
import {
  deleteStaffProfile,
  permanentlyDeleteStaffProfile,
  registerAdmin,
  resetStaffPassword,
  restoreStaffProfile,
  saveStaffEmail,
  setStaffActive,
  updateStaffProfile,
} from '../services/staffService';
import { useToast } from '../context/ToastContext';
import { getStoredCooldownUntil, setStoredCooldownUntil } from '../lib/registerAdminCooldown';

export default function AdminRegistrationPage() {
  const [view, setView] = useState('active'); // 'active' | 'trash'
  const { staff, loading, error, refetch } = useStaff({ trash: view === 'trash', roleGroup: 'admin' });
  const { showToast } = useToast();

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [deletingPerson, setDeletingPerson] = useState(null);
  const [permaDeletingPerson, setPermaDeletingPerson] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetPasswordPromptPerson, setResetPasswordPromptPerson] = useState(null);

  // A rate-limited signUp() means Supabase itself is refusing more attempts
  // for a while — retrying immediately just produces another 429, so this
  // blocks the submit button for a cooldown window instead of letting the
  // admin hammer it. Persisted to localStorage (initial state reads it back
  // on mount) so a page reload right after a 429 doesn't reset the
  // countdown to zero and let the very next click immediately retry into
  // another 429. now ticks once a second only while a cooldown is active,
  // purely to re-render the countdown.
  const [cooldownUntil, setCooldownUntilState] = useState(() => getStoredCooldownUntil());
  const [now, setNow] = useState(Date.now());

  function setCooldownUntil(timestamp) {
    setCooldownUntilState(timestamp);
    setStoredCooldownUntil(timestamp);
  }

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  // A synchronous, ref-based lock in addition to the `submitting` state —
  // state updates only take effect on the next render, which leaves a
  // brief window where a second click (or a rapid double-click before
  // React re-renders the disabled button) could still slip a duplicate
  // registerAdmin() call through. This flips true immediately, in the same
  // tick as the click handler, closing that gap.
  const submitLockRef = useRef(false);

  async function handleRegisterAdmin(values) {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const result = await registerAdmin(values);

      if (result.rateLimited) {
        setCooldownUntil(Date.now() + 60_000);
        showToast(
          `${result.rateLimitMessage || 'Supabase is rate-limiting new logins right now.'} ${values.fullName} was saved as an Admin directory entry with no login yet — use Invite via Email, or try Register Admin again once the limit clears.`,
          'error'
        );
      } else if (result.updatedExisting) {
        showToast(`${values.email} already had a record — promoted to Admin.`);
      } else if (result.promotedToAdmin === false) {
        showToast(
          `Admin account created for ${values.email}, but it could not be promoted from Staff automatically — open Edit on their row to set the role to Admin.`,
          'error'
        );
      } else {
        showToast(`Admin account created for ${values.email}.`);
      }

      setIsRegisterModalOpen(false);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to register admin.', 'error');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(values) {
    setSubmitting(true);
    try {
      const result = await updateStaffProfile(editingPerson.id, values);
      showToast(`${editingPerson.full_name ?? 'Staff member'} updated.`);
      if (values.email && !result.emailSaved) {
        showToast(
          'Note: the email could not be saved — this database\'s profiles table has no email column yet.',
          'error'
        );
      }
      setEditingPerson(null);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to update staff member.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(person) {
    try {
      await setStaffActive(person.id, !person.active);
      showToast(`${person.full_name ?? 'Staff member'} marked ${person.active ? 'Inactive' : 'Active'}.`);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to update status.', 'error');
    }
  }

  // Does the actual work once an email is known — either read straight off
  // the row/modal, or just entered in the "no email yet" prompt below. Also
  // (re-)saves it via saveStaffEmail first, so confirming an email here
  // sticks even if the admin never opens Edit and clicks Save Changes.
  async function sendPasswordReset(person, email) {
    setResettingPassword(true);
    try {
      await saveStaffEmail(person.id, email);
      await resetStaffPassword(email);
      showToast(`Password reset email sent to ${email}.`);
      setResetPasswordPromptPerson(null);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to send password reset email.', 'error');
    } finally {
      setResettingPassword(false);
    }
  }

  // Entry point from the table's key icon and from Edit Staff's Reset
  // Password button. If there's no email on file at all (this database has
  // no profiles.email column, so that's the default state until one's been
  // typed in at least once), this opens a small prompt to collect it first
  // instead of failing outright.
  function handleResetPassword(person) {
    const email = person.email?.trim();
    if (!email) {
      setResetPasswordPromptPerson(person);
      return;
    }
    sendPasswordReset(person, email);
  }

  async function handleConfirmDelete() {
    setSubmitting(true);
    try {
      await deleteStaffProfile(deletingPerson.id);
      showToast(`${deletingPerson.full_name ?? 'Staff member'} moved to Trash.`);
      setDeletingPerson(null);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to remove staff member.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestore(person) {
    try {
      await restoreStaffProfile(person.id);
      showToast(`${person.full_name ?? 'Staff member'} restored.`);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to restore staff member.', 'error');
    }
  }

  async function handleConfirmPermanentDelete() {
    setSubmitting(true);
    try {
      await permanentlyDeleteStaffProfile(permaDeletingPerson.id);
      showToast(`${permaDeletingPerson.full_name ?? 'Staff member'} permanently deleted.`);
      setPermaDeletingPerson(null);
      refetch();
    } catch (err) {
      showToast(err.message || 'Failed to permanently delete staff member.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
            {[
              { key: 'active', label: 'Admins & Staff' },
              { key: 'trash', label: 'Trash' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  view === tab.key
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-slate-500">
            {view === 'trash'
              ? 'Removed admins and staff — restore them or delete permanently.'
              : 'Registered admins and staff with dashboard access.'}
          </p>
        </div>

        {view === 'active' && (
          <button
            type="button"
            onClick={() => setIsRegisterModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
          >
            <ShieldPlus className="h-4 w-4" />
            Register Admin
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Failed to load staff: {error.message}</span>
          <button type="button" onClick={refetch} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      <StaffTable
        staff={staff}
        loading={loading}
        view={view}
        onEdit={setEditingPerson}
        onDelete={setDeletingPerson}
        onRestore={handleRestore}
        onPermanentDelete={setPermaDeletingPerson}
        onToggleStatus={handleToggleStatus}
        onResetPassword={handleResetPassword}
      />

      {isRegisterModalOpen && (
        <RegisterAdminModal
          submitting={submitting}
          cooldownSeconds={cooldownSeconds}
          onClose={() => setIsRegisterModalOpen(false)}
          onSubmit={handleRegisterAdmin}
        />
      )}

      {editingPerson && (
        <EditStaffModal
          person={editingPerson}
          submitting={submitting}
          resettingPassword={resettingPassword}
          onClose={() => setEditingPerson(null)}
          onSubmit={handleEditSubmit}
          onResetPassword={handleResetPassword}
        />
      )}

      {deletingPerson && (
        <ConfirmDialog
          title="Move to Trash"
          message={`Move "${
            deletingPerson.full_name ?? deletingPerson.id
          }" to Trash? This revokes their dashboard access immediately, but their record can be restored later from the Trash tab.`}
          confirmLabel="Move to Trash"
          loading={submitting}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeletingPerson(null)}
        />
      )}

      {permaDeletingPerson && (
        <ConfirmDialog
          title="Delete Permanently"
          message={`Permanently delete "${
            permaDeletingPerson.full_name ?? permaDeletingPerson.id
          }"? This removes their profile from the database entirely and cannot be undone — unlike moving to Trash, there is no way to restore it afterward. This does not delete their Supabase Auth login — that has to be removed separately from Authentication → Users if needed.`}
          confirmLabel="Delete Permanently"
          loading={submitting}
          onConfirm={handleConfirmPermanentDelete}
          onClose={() => setPermaDeletingPerson(null)}
        />
      )}

      {resetPasswordPromptPerson && (
        <ResetPasswordEmailModal
          person={resetPasswordPromptPerson}
          submitting={resettingPassword}
          onClose={() => setResetPasswordPromptPerson(null)}
          onSubmit={(email) => sendPasswordReset(resetPasswordPromptPerson, email)}
        />
      )}
    </div>
  );
}
