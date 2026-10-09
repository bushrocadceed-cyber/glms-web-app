import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Clock, DollarSign } from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import QuickActions from '../components/dashboard/QuickActions';
import InventoryChart from '../components/dashboard/InventoryChart';
import LoansChart from '../components/dashboard/LoansChart';
import DueDatesCalendar from '../components/dashboard/DueDatesCalendar';
import CategoriesSummary from '../components/dashboard/CategoriesSummary';
import RecentActivityFeed from '../components/dashboard/RecentActivityFeed';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { getDashboardChartData } from '../services/reportService';

export default function Dashboard() {
  const { stats, loading, error } = useDashboardStats();

  const [chartData, setChartData] = useState({ inventory: [], loans: [] });
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDashboardChartData()
      .then((data) => {
        if (!cancelled) setChartData(data);
      })
      .catch(() => {
        if (!cancelled) setChartData({ inventory: [], loans: [] });
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Xisaabinta saxda ah ee Copies by Status
  const availableCount = stats?.availableBooks ?? 0;
  const checkedOutCount = Math.max(0, (stats?.totalBooks ?? 0) - availableCount);

  const realInventoryData = [
    { name: 'Available', value: availableCount },
    { name: 'Checked Out', value: checkedOutCount },
  ];

  return (
    <div className="space-y-6">
      {/* Row 1: quick actions, full width */}
      <QuickActions />

      {/* Row 2: the four stat cards, evenly spaced across the full width */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="Total Books"
          value={stats.totalBooks}
          loading={loading}
          error={error}
        />
        <StatCard
          icon={CheckCircle2}
          label="Available Books"
          value={stats.availableBooks}
          loading={loading}
          error={error}
        />
        <StatCard
          icon={Clock}
          label="Overdue Loans"
          value={stats.overdueLoans}
          loading={loading}
          error={error}
          emphasize={!loading && !error && stats.overdueLoans > 0}
        />
        <StatCard
          icon={DollarSign}
          label="Outstanding Fines"
          value={stats.outstandingFines != null ? `$${Number(stats.outstandingFines).toFixed(2)}` : null}
          loading={loading}
          error={error}
          emphasize={!loading && !error && stats.outstandingFines > 0}
        />
      </div>

      {/* Row 3: the two charts, side by side */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <InventoryChart data={realInventoryData} loading={loading || chartLoading} />
        <LoansChart data={chartData.loans} loading={chartLoading} />
      </div>

      {/* Row 4: calendar, categories, activity */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <DueDatesCalendar />
        <CategoriesSummary />
        <RecentActivityFeed />
      </div>
    </div>
  );
}