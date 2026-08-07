import { useState } from 'react';
import { Eye, EyeOff, Upload } from 'lucide-react';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';
import { getAvatar } from '../../lib/avatarStore';

const EMPTY_FORM = { full_name: '', email: '', phone: '', password: '' };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024; // 1.5MB raw — matches the cap used elsewhere for avatars

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

export default function MemberFormModal({ mode, initialValues, submitting, error, onClose, onSubmit }) {
  const [form, setForm] = useState(() =>
    initialValues
      ? {
          full_name: initialValues.full_name ?? '',
          email: initialValues.email ?? '',
          phone: initialValues.phone ?? '',
          password: '',
        }
      : EMPTY_FORM
  );
  // Starts from whatever's already stored for this member (edit mode) so
  // leaving the field untouched keeps their existing picture — see
  // MembersPage's handleFormSubmit, which just re-saves whatever this ends
  // up holding, changed or not.
  const [avatarDataUrl, setAvatarDataUrl] = useState(() =>
    initialValues ? getAvatar(initialValues.id) : null
  );
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  // A 409 duplicate-email/phone error mentions the specific field in its
  // message (see duplicateMemberMessage in memberService.js) — reused here
  // to also highlight the actual field at fault, not just show a banner.
  const errorLower = error?.toLowerCase() ?? '';
  const emailConflict = errorLower.includes('email');
  const phoneConflict = errorLower.includes('phone number');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, avatar: 'Please choose an image file.' }));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setErrors((prev) => ({ ...prev, avatar: 'Image must be 1.5MB or smaller.' }));
      return;
    }

    setErrors((prev) => ({ ...prev, avatar: undefined }));
    setAvatarDataUrl(await readFileAsDataUrl(file));
  }

  function validate() {
    const nextErrors = {};
    if (!form.full_name.trim()) nextErrors.full_name = 'Full name is required.';

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!form.phone.trim()) nextErrors.phone = 'Phone number is required.';

    // Optional on purpose: there's no member login system yet for this to
    // actually feed into (see the note on the field itself), so nothing
    // here requires it or checks a minimum length the way admin/staff
    // passwords do.

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    if (errors.avatar) return;
    // password is intentionally left out of what's submitted — nowhere in
    // this app persists a member password yet (there's no member auth
    // system, and storing one in a plain column instead would mean saving
    // it unhashed, which is a real security mistake, not a shortcut). It's
    // captured in local form state purely so the field behaves normally
    // while typing; wire this up for real once member login exists.
    const { password: _password, ...values } = form;
    onSubmit({ ...values, avatarDataUrl });
  }

  return (
    <Modal title={mode === 'add' ? 'Add Member' : 'Edit Member'} onClose={onClose}>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
          <input
            name="full_name"
            value={form.full_name}
            onChange={handleChange}
            className={fieldClasses(errors.full_name)}
          />
          {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            className={fieldClasses(errors.email || emailConflict)}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Phone Number</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className={fieldClasses(errors.phone || phoneConflict)}
          />
          {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Password <span className="font-normal text-slate-400">(optional — login access isn't set up for members yet)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              className={`${fieldClasses(false)} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Profile Picture <span className="font-normal text-slate-400">(optional, max 1.5MB)</span>
          </label>
          <div className="flex items-center gap-3">
            <Avatar src={avatarDataUrl} fullName={form.full_name} className="h-12 w-12 text-sm" />
            <label
              className={
                fieldClasses(errors.avatar) + ' flex w-auto cursor-pointer items-center gap-2 hover:bg-slate-50'
              }
            >
              <Upload className="h-4 w-4 text-slate-500" />
              {avatarDataUrl ? 'Change Photo' : 'Upload Photo'}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </label>
          </div>
          {errors.avatar && <p className="mt-1 text-xs text-red-600">{errors.avatar}</p>}
        </div>

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
            {submitting ? 'Saving…' : mode === 'add' ? 'Add Member' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
