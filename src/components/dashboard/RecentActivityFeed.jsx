import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { getRecentActivity } from '../../services/reportService';

function formatWhen(timestamp) {
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function RecentActivityFeed() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getRecentActivity(8)
      .then((data) => {
        if (!cancelled) setActivities(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setActivities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Recent Activity</h3>

      {loading && (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
          ))}
        </div>
      )}

      {!loading && activities.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">No recent activity yet.</p>
      )}

      {!loading && activities.length > 0 && (
        <ul className="flex-1 space-y-4">
          {activities.map((activity) => (
            <li key={activity.id} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/40">
                <Clock className="h-4 w-4 text-primary-600 dark:text-primary-300" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base text-slate-700 dark:text-slate-200">{activity.label}</p>
                <p className="text-sm text-slate-400">{formatWhen(activity.timestamp)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
