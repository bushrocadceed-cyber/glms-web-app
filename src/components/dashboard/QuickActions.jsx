import { useNavigate } from 'react-router-dom';
import { BookPlus, PackageCheck, PackageOpen, UserPlus } from 'lucide-react';

const ACTIONS = [
  { label: 'Add Book', icon: BookPlus, to: '/inventory?action=add' },
  { label: 'Add Member', icon: UserPlus, to: '/members?action=add' },
  { label: 'Borrow Book', icon: PackageOpen, to: '/loans?action=borrow' },
  { label: 'Return Book', icon: PackageCheck, to: '/loans' },
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map(({ label, icon: Icon, to }) => (
        <button
          key={label}
          type="button"
          onClick={() => navigate(to)}
          className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md dark:bg-slate-800 dark:ring-slate-700"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/40">
            <Icon className="h-5 w-5 text-primary-600 dark:text-primary-300" />
          </div>
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
        </button>
      ))}
    </div>
  );
}
