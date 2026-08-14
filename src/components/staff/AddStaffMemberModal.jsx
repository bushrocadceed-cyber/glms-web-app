import { useState } from 'react';
import { Eye, EyeOff, Upload, UserRound } from 'lucide-react';
import Modal from '../ui/Modal';

const EMPTY_STAFF_FORM = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'staff',
  phone: '',
};

const STAFF_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024; // 1.5MB raw — matches the cap used elsewhere for avatars

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function staffInputClasses(hasError) {
  return `w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
      : 'border-slate-300 focus:border-primary-600 focus:ring-primary-600'
  }`;
}

export default function AddStaffMemberModal({ submitting, cooldownSeconds = 0, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_STAFF_FORM);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState(null);

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
    if (!form.fullName.trim()) nextErrors.fullName = 'Full name is required.';

    if (!form.email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!STAFF_EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!form.password) {
      nextErrors.password = 'Password is required.';
    } else if (form.password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }

    if (form.confirmPassword !== form.password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting || cooldownSeconds > 0) return;
    if (!validate()) return;
    if (errors.avatar) return;

    onSubmit({
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      role: form.role,
      phone: form.phone.trim() || null,
      avatarDataUrl,
    });
  }

  return (
    <Modal title="Add Staff Member" onClose={onClose}>
      <div className="mb-4 rounded-lg bg-primary-50 px-3 py-2.5 text-xs text-primary-700">
        This creates a real login — the new staff member can sign in right away with the email and
        password set here.
      </div>

      {cooldownSeconds > 0 && (
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          Supabase is rate-limiting new logins right now. You can try again in {cooldownSeconds}s.
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <fieldset disabled={submitting} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
            <input
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              className={staffInputClasses(errors.fullName)}
            />
            {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email Address</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className={staffInputClasses(errors.email)}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                className={`${staffInputClasses(errors.password)} pr-10`}
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
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              className={staffInputClasses(errors.confirmPassword)}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            >
              <option value="staff">Staff</option>
              <option value="librarian">Librarian</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-400">
              To create an Admin, use Register Admin from the Admin Registration page instead.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Phone Number <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              className={staffInputClasses(false)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Profile Picture <span className="font-normal text-slate-400">(optional, max 1.5MB)</span>
            </label>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                {avatarDataUrl ? (
                  <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserRound className="h-5 w-5 text-slate-400" />
                )}
              </div>
              <label className={staffInputClasses(errors.avatar) + ' flex cursor-pointer items-center gap-2 hover:bg-slate-50'}>
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
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || cooldownSeconds > 0}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {submitting
                ? 'Saving…'
                : cooldownSeconds > 0
                  ? `Try again in ${cooldownSeconds}s`
                  : 'Add Staff Member'}
            </button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
