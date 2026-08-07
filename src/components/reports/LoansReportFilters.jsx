const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'borrowed', label: 'Borrowed' },
  { value: 'returned', label: 'Returned' },
  { value: 'overdue', label: 'Overdue' },
];

export default function LoansReportFilters({ filters, onChange }) {
  function handleChange(e) {
    const { name, value } = e.target;
    onChange({ ...filters, [name]: value });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
        <input
          type="date"
          name="startDate"
          value={filters.startDate}
          onChange={handleChange}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
        <input
          type="date"
          name="endDate"
          value={filters.endDate}
          onChange={handleChange}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">Status</label>
        <select
          name="status"
          value={filters.status}
          onChange={handleChange}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
