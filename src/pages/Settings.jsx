import { useState } from 'react';
import {
  Camera,
  Database,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  Shield,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isAdminRole } from '../lib/roles';
import { getLibraryRules, setLibraryRules } from '../lib/libraryRules';
import { getFineRate, setFineRate } from '../lib/fines';
import { downloadBlob } from '../lib/downloadBlob';
import { getLibraryBackup } from '../services/backupService';
import { logUserActivity } from '../services/activityLogService';
import Avatar from '../components/ui/Avatar';

const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024; // 1.5MB raw — matches the cap used for book covers

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function formatRole(role) {
  if (!role) return 'Staff';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// Cosmetic label only — the underlying profile.role value stays 'admin' /
// 'staff' everywhere else (route gating, Manage Staff), this just renders
// nicer on the profile card.
function roleLabel(role) {
  if (isAdminRole(role)) return 'Super Admin';
  return formatRole(role);
}

function fieldClasses(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 dark:bg-slate-900 dark:text-slate-100 ${
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600 dark:border-slate-600'
  }`;
}

const CARD_CLASSES = 'rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700';

export default function Settings() {
  const { user, profile, signOut, updateProfile, updateAvatar, changePassword } = useAuth();
  const { showToast } = useToast();

  // ----- Profile card -----
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [avatarDataUrl, setAvatarDataUrl] = useState(profile?.avatar_url ?? null);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image must be 1.5MB or smaller.');
      return;
    }

    setAvatarError('');
    const dataUrl = await readFileAsDataUrl(file);
    setAvatarDataUrl(dataUrl);

    setAvatarSaving(true);
    try {
      await updateAvatar(dataUrl);
      showToast('Profile picture updated.');
    } catch (err) {
      showToast(err.message || 'Failed to save profile picture.', 'error');
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('Full name is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ full_name: fullName.trim() });
      showToast('Profile updated successfully.');
    } catch (err) {
      showToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ----- Library Rules & System Configuration (admin only) -----
  const [rules, setRules] = useState(() => {
    const stored = getLibraryRules();
    return {
      loanDurationDays: String(stored.loanDurationDays),
      maxBooksPerMember: String(stored.maxBooksPerMember),
      fineRatePerDay: String(getFineRate()),
    };
  });
  const [rulesErrors, setRulesErrors] = useState({});
  const [rulesSaving, setRulesSaving] = useState(false);

  function handleRulesChange(field, value) {
    setRules((prev) => ({ ...prev, [field]: value }));
    setRulesErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handleSaveRules(e) {
    e.preventDefault();
    const loanDurationDays = Number(rules.loanDurationDays);
    const maxBooksPerMember = Number(rules.maxBooksPerMember);
    const fineRatePerDay = Number(rules.fineRatePerDay);

    const nextErrors = {};
    if (!Number.isInteger(loanDurationDays) || loanDurationDays < 1) {
      nextErrors.loanDurationDays = 'Enter a whole number of days, 1 or more.';
    }
    if (!Number.isInteger(maxBooksPerMember) || maxBooksPerMember < 1) {
      nextErrors.maxBooksPerMember = 'Enter a whole number, 1 or more.';
    }
    if (!Number.isFinite(fineRatePerDay) || fineRatePerDay < 0) {
      nextErrors.fineRatePerDay = 'Enter a valid, non-negative amount.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setRulesErrors(nextErrors);
      return;
    }

    setRulesSaving(true);
    setLibraryRules({ loanDurationDays, maxBooksPerMember });
    setFineRate(Number(fineRatePerDay.toFixed(2)));
    showToast('System rules saved.');
    logUserActivity(
      'Updated Settings',
      `Loan duration: ${loanDurationDays}d, Max books/member: ${maxBooksPerMember}, Fine rate: $${fineRatePerDay.toFixed(2)}/day`
    );
    setRulesSaving(false);
  }

  // ----- Database Backup (admin only) -----
  const [backupSaving, setBackupSaving] = useState(false);

  async function handleBackup() {
    setBackupSaving(true);
    try {
      const backup = await getLibraryBackup();
      const json = JSON.stringify(backup, null, 2);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(json, `library-backup-${date}.json`, 'application/json');
      showToast('Backup downloaded.');
      logUserActivity(
        'Downloaded Backup',
        `${backup.books.length} books, ${backup.members.length} members, ${backup.activeLoans.length} active loans`
      );
    } catch (err) {
      showToast(err.message || 'Failed to create backup.', 'error');
    } finally {
      setBackupSaving(false);
    }
  }

  // ----- Change Password -----
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  function handlePasswordChange(field, value) {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();

    const nextErrors = {};
    if (!passwordForm.currentPassword) nextErrors.currentPassword = 'Enter your current password.';
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 8) {
      nextErrors.newPassword = 'New password must be at least 8 characters.';
    }
    if (passwordForm.confirmNewPassword !== passwordForm.newPassword) {
      nextErrors.confirmNewPassword = 'Passwords do not match.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setPasswordErrors(nextErrors);
      return;
    }

    setPasswordSaving(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      showToast('Password updated successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (err) {
      const message = err.message || 'Failed to update password.';
      if (message.toLowerCase().includes('current password')) {
        setPasswordErrors({ currentPassword: message });
      }
      showToast(message, 'error');
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Profile card: centered avatar, name, role, and the primary
          "Change Photo" action — the picture upload lives here, not in the
          edit form below. */}
      <div className={`flex flex-col items-center p-8 text-center ${CARD_CLASSES}`}>
        <Avatar
          src={avatarDataUrl}
          fullName={fullName || profile?.full_name}
          className="h-28 w-28 text-3xl ring-4 ring-primary-100 dark:ring-primary-900/40"
        />

        <h2 className="mt-4 text-xl font-semibold text-slate-900 dark:text-white">
          {profile?.full_name || 'Account'}
        </h2>
        <p className="mt-1 text-sm font-medium text-primary-600 dark:text-primary-400">
          {roleLabel(profile?.role)}
        </p>

        <label className="mt-5 flex cursor-pointer items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-60">
          <Camera className="h-4 w-4" />
          {avatarSaving ? 'Saving…' : 'Change Photo'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={avatarSaving}
            onChange={handleAvatarChange}
          />
        </label>
        {avatarError && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{avatarError}</p>}
      </div>

      {/* Account details card */}
      <div className={CARD_CLASSES}>
        <h2 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">Account Details</h2>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Full Name
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={user?.email ?? ''}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Role
            </label>
            <div className="relative">
              <Shield className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={roleLabel(profile?.role)}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400"
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              Role changes are managed by an admin from the Manage Staff page.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Library Rules & System Configuration — admin only, since this is
          library-wide policy rather than a personal preference. */}
      {isAdminRole(profile?.role) && (
        <div className={CARD_CLASSES}>
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Library Rules &amp; System Configuration
            </h2>
          </div>

          <form onSubmit={handleSaveRules} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Default Loan Duration <span className="font-normal text-slate-400">(days)</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={rules.loanDurationDays}
                onChange={(e) => handleRulesChange('loanDurationDays', e.target.value)}
                className={fieldClasses(rulesErrors.loanDurationDays)}
              />
              {rulesErrors.loanDurationDays && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{rulesErrors.loanDurationDays}</p>
              )}
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Used as the default due date when checking out a book — e.g. 7 or 14.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Max Books Per Member
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={rules.maxBooksPerMember}
                onChange={(e) => handleRulesChange('maxBooksPerMember', e.target.value)}
                className={fieldClasses(rulesErrors.maxBooksPerMember)}
              />
              {rulesErrors.maxBooksPerMember && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{rulesErrors.maxBooksPerMember}</p>
              )}
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Blocks checkout once a member already has this many books out — e.g. 3.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Overdue Fine Rate Per Day <span className="font-normal text-slate-400">($)</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  $
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={rules.fineRatePerDay}
                  onChange={(e) => handleRulesChange('fineRatePerDay', e.target.value)}
                  className={`${fieldClasses(rulesErrors.fineRatePerDay)} pl-7`}
                />
              </div>
              {rulesErrors.fineRatePerDay && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{rulesErrors.fineRatePerDay}</p>
              )}
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Same rate shown on the Fines report and the Return Book modal — e.g. 0.50.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={rulesSaving}
                className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {rulesSaving ? 'Saving…' : 'Save System Rules'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Database Backup — admin only, same reasoning as Library Rules
          above: this is library-wide data, not a personal setting. */}
      {isAdminRole(profile?.role) && (
        <div className={CARD_CLASSES}>
          <div className="mb-1 flex items-center gap-2">
            <Database className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Database Backup</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Download every book and member record, plus all currently active loans, as a single JSON
            file.
          </p>
          <button
            type="button"
            onClick={handleBackup}
            disabled={backupSaving}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Download className="h-4 w-4" />
            {backupSaving ? 'Preparing backup…' : 'Backup Library Data'}
          </button>
        </div>
      )}

      {/* Security / Change Password */}
      <div className={CARD_CLASSES}>
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Security</h2>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords ? 'text' : 'password'}
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                className={`${fieldClasses(passwordErrors.currentPassword)} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPasswords((prev) => !prev)}
                tabIndex={-1}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {passwordErrors.currentPassword && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{passwordErrors.currentPassword}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              New Password
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
              className={fieldClasses(passwordErrors.newPassword)}
            />
            {passwordErrors.newPassword && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{passwordErrors.newPassword}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Confirm New Password
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={passwordForm.confirmNewPassword}
              onChange={(e) => handlePasswordChange('confirmNewPassword', e.target.value)}
              className={fieldClasses(passwordErrors.confirmNewPassword)}
            />
            {passwordErrors.confirmNewPassword && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{passwordErrors.confirmNewPassword}</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={passwordSaving}
              className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {passwordSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Session */}
      <div className={CARD_CLASSES}>
        <h2 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Session</h2>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Sign out of this browser session.</p>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
