import { AlertTriangle, BookOpen, CheckCircle2 } from 'lucide-react';
import StatCard from '../ui/StatCard';

export default function InventoryReportSummary({ report, loading, error }) {
  if (error) {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        Failed to load inventory report: {error.message}
      </div>
    );
  }

  const { totalBooks = 0, availableBooks = 0, lowStockBooks = [] } = report ?? {};
  const availabilityPercent = totalBooks > 0 ? Math.round((availableBooks / totalBooks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard icon={BookOpen} label="Total Books" value={totalBooks} loading={loading} />
        <StatCard icon={CheckCircle2} label="Available Books" value={availableBooks} loading={loading} />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock Titles"
          value={lowStockBooks.length}
          loading={loading}
          emphasize={!loading && lowStockBooks.length > 0}
        />
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Catalog Availability</span>
          <span className="text-slate-500">{availabilityPercent}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-primary-600 transition-all"
            style={{ width: `${availabilityPercent}%` }}
          />
        </div>
      </div>

      {!loading && lowStockBooks.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Low Stock Alerts</h3>
          <ul className="space-y-3">
            {lowStockBooks.map((book) => (
              <li key={book.id} className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-900">{book.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-red-600">
                    {book.available_copies ?? 0} left
                  </span>
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        (book.available_copies ?? 0) === 0 ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${((book.available_copies ?? 0) / 2) * 100}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
