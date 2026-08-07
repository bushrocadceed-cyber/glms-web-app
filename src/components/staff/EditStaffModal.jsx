import { useState } from 'react';
import { KeyRound, Upload } from 'lucide-react';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';
import { getAvatar } from '../../lib/avatarStore';

const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024; // 1.5MB raw — matches the cap used elsewhere for avatars
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldClasses(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
  }`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export default function EditStaffModal({ person, submitting, resettingPassword, onClose, onSubmit, onResetPassword }) {
  const [fullName, setFullName] = useState(person.full_name ?? '');
  const [email, setEmail] = useState(person.email ?? '');
  const [role, setRole] = useState(person.role ?? 'staff');
  const [active, setActive] = useState(person.active ?? true);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');

  // Pre-filled from whatever's already stored for this person — shows up
  // as the existing picture in the preview the instant the modal opens,
  // and stays exactly as-is (re-saved unchanged) if never touched.
  const [avatarDataUrl, setAvatarDataUrl] = useState(() => getAvatar(person.id));
  const [avatarError, setAvatarError] = useState('');

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
    setAvatarDataUrl(await readFileAsDataUrl(file));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) {
      setEmailError('Enter a valid email address.');
      return;
    }
    if (avatarError) return;
    onSubmit({ fullName, email: email.trim() || null, role, active, avatarDataUrl });
  }

  return (
    <Modal title="Edit Staff Member" onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Profile Picture <span className="font-normal text-slate-400">(optional, max 1.5MB)</span>
          </label>
          <div className="flex items-center gap-3">
            <Avatar src={avatarDataUrl} fullName={fullName} className="h-12 w-12 text-sm" />
            <label
              className={
                fieldClasses(avatarError) + ' flex w-auto cursor-pointer items-center gap-2 hover:bg-slate-50'
              }
            >
              <Upload className="h-4 w-4 text-slate-500" />
              {avatarDataUrl ? 'Change Photo' : 'Upload Photo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          {avatarError && <p className="mt-1 text-xs text-red-600">{avatarError}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
          <input
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setError('');
            }}
            className={fieldClasses(error)}
          />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Email Address <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError('');
            }}
            className={fieldClasses(emailError)}
          />
          {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
          <p className="mt-1.5 text-xs text-slate-400">
            This updates their directory record only — it does not change the email they actually sign
            in with.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          >
            <option value="staff">Staff</option>
            <option value="librarian">Librarian</option>
            <option value="admin">Super Admin</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm font-medium">
            <button
              type="button"
              onClick={() => setActive(true)}
              className={`flex-1 px-3 py-2 transition-colors ${
                active ? 'bg-green-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setActive(false)}
              className={`flex-1 border-l border-slate-300 px-3 py-2 transition-colors ${
                !active ? 'bg-slate-500 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              Inactive
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            A bookkeeping flag only — marking someone Inactive does not revoke their login.
          </p>
        </div>

        {onResetPassword && (
          <div className="rounded-lg bg-slate-50 px-3 py-3">
            <button
              type="button"
              disabled={resettingPassword}
              onClick={() => {
                // Validated here, against whatever's currently typed in the
                // Email field above — even if it hasn't been saved with
                // Save Changes yet — rather than the (possibly empty) email
                // this modal opened with, so filling in the field and
                // clicking Reset Password works in one step.
                const trimmedEmail = email.trim();
                if (!trimmedEmail) {
                  setEmailError('Add an email address above first, then click Reset Password again.');
                  return;
                }
                if (!EMAIL_PATTERN.test(trimmedEmail)) {
                  setEmailError('Enter a valid email address.');
                  return;
                }
                onResetPassword({ ...person, email: trimmedEmail });
              }}
              className="flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800 disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              {resettingPassword ? 'Sending reset email…' : 'Reset Password'}
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Sends a password reset email to the address above — it's saved automatically, even if you
              haven't clicked Save Changes yet.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
