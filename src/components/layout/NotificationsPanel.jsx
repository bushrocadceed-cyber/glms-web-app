import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { getOverdueNotifications } from '../../services/loanService';

function daysOverdue(dueDate) {
  const diffMs = Date.now() - new Date(dueDate).getTime();
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function NotificationsPanel() {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await getOverdueNotifications();
      setNotifications(data ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !loadedOnce) loadNotifications();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        title="Overdue notifications"
        className="relative flex items-center justify-center rounded-lg p-2.5 text-primary-200 hover:bg-primary-700 hover:text-white"
      >
        <Bell className="h-5 w-5" />
        {loadedOnce && notifications.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 max-h-96 overflow-y-auto rounded-lg bg-white shadow-xl ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Overdue Books</h3>
          </div>

          {loading && <div className="px-4 py-4 text-sm text-slate-500">Loading…</div>}

          {!loading && notifications.length === 0 && (
            <div className="px-4 py-4 text-sm text-slate-500">No overdue books right now.</div>
          )}

          {!loading &&
            notifications.map((loan) => (
              <button
                key={loan.id}
                type="button"
                onClick={() => {
                  navigate('/loans');
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-4 py-2.5 text-left last:border-b-0 hover:bg-red-50"
              >
                <p className="truncate text-sm font-medium text-slate-900">
                  {loan.books?.title ?? 'Unknown book'}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {loan.members?.full_name ?? 'Unknown member'} — {daysOverdue(loan.due_date)} day
                  {daysOverdue(loan.due_date) === 1 ? '' : 's'} overdue
                </p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
