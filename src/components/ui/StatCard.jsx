export default function StatCard({ icon: Icon, label, value, loading, error, emphasize = false }) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md dark:bg-slate-800 dark:ring-slate-700">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/40">
          <Icon className="h-6 w-6 text-primary-600 dark:text-primary-300" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>

          {loading && (
            <div className="mt-1.5 h-8 w-14 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          )}
          {error && <p className="mt-0.5 text-sm font-medium text-red-600">Failed to load</p>}
          {!loading && !error && (
            <p
              className={`text-3xl font-semibold tracking-tight ${
                emphasize ? 'text-red-600' : 'text-slate-900 dark:text-white'
              }`}
            >
              {value}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
