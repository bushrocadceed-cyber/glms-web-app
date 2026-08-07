import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';
import { getAvatar } from '../../lib/avatarStore';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function MemberViewModal({ member, onClose }) {
  return (
    <Modal title="Member Details" onClose={onClose}>
      <div className="mb-4 flex justify-center">
        <Avatar src={getAvatar(member.id)} fullName={member.full_name} className="h-16 w-16 text-lg" />
      </div>

      <dl className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Full Name</dt>
          <dd className="text-slate-900">{member.full_name}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Email</dt>
          <dd className="text-slate-900">{member.email}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Phone</dt>
          <dd className="text-slate-900">{member.phone}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Member Since</dt>
          <dd className="text-slate-900">{formatDate(member.membership_date)}</dd>
        </div>
      </dl>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
