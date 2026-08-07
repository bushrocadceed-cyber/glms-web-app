import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = { Active: '#2563EB', Overdue: '#DC2626', Returned: '#94A3B8' };

export default function LoansChart({ data, loading }) {
  const hasData = (data ?? []).some((entry) => entry.value > 0);

  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Loans Breakdown</h3>

      {loading ? (
        <div className="flex h-56 items-center justify-center">
          <div className="h-40 w-40 animate-pulse rounded-full bg-slate-100 dark:bg-slate-700" />
        </div>
      ) : !hasData ? (
        <div className="flex h-56 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          No loan activity yet.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {(data ?? []).map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name] ?? '#94A3B8'} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 13 }} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: '#64748B' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
