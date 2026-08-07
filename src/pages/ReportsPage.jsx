import { useState } from 'react';
import { Download } from 'lucide-react';
import LoansReportFilters from '../components/reports/LoansReportFilters';
import LoansReportTable from '../components/reports/LoansReportTable';
import InventoryReportSummary from '../components/reports/InventoryReportSummary';
import FinesReportSummary from '../components/reports/FinesReportSummary';
import { useLoansReport } from '../hooks/useLoansReport';
import { useInventoryReport } from '../hooks/useInventoryReport';
import { exportToCSV } from '../lib/exportToCSV';
import { useToast } from '../context/ToastContext';

const TABS = [
  { key: 'loans', label: 'Loans Report' },
  { key: 'inventory', label: 'Inventory Report' },
  { key: 'fines', label: 'Fines' },
];

function loanStatusLabel(loan) {
  if (loan.return_date) return 'Returned';
  return new Date(loan.due_date) < new Date() ? 'Overdue' : 'Borrowed';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '';
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('loans');
  const [filters, setFilters] = useState({ startDate: '', endDate: '', status: 'all' });
  const { showToast } = useToast();

  const { loans, loading: loansLoading, error: loansError } = useLoansReport(filters);
  const { report, loading: inventoryLoading, error: inventoryError } = useInventoryReport();

  // Each tab exports exactly what it currently has on screen — the Loans
  // tab respects whatever filters are applied above the table, Inventory
  // exports the low-stock list shown below (the only per-book detail this
  // report has; totals/availability % have nothing to put in a row). Fines
  // has its own Export button inside FinesReportSummary, since that
  // component owns its own data and isn't lifted up to this page.
  function handleExportLoans() {
    const rows = loans.map((loan) => ({
      'Book Title': loan.books?.title ?? '',
      'Member Name': loan.members?.full_name ?? '',
      'Loan Date': formatDate(loan.loan_date),
      'Due Date': formatDate(loan.due_date),
      'Return Date': formatDate(loan.return_date),
      Status: loanStatusLabel(loan),
    }));
    if (!exportToCSV(rows, 'loans-report.csv')) {
      showToast('No loans to export.', 'error');
    }
  }

  function handleExportInventory() {
    const rows = (report?.lowStockBooks ?? []).map((book) => ({
      Title: book.title ?? '',
      'Available Copies': book.available_copies ?? 0,
    }));
    if (!exportToCSV(rows, 'inventory-low-stock.csv')) {
      showToast('No low-stock books to export.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-primary-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'fines' && (
          <button
            type="button"
            onClick={activeTab === 'loans' ? handleExportLoans : handleExportInventory}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export to CSV
          </button>
        )}
      </div>

      {activeTab === 'loans' && (
        <div className="space-y-4">
          <LoansReportFilters filters={filters} onChange={setFilters} />
          {loansError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              Failed to load loans report: {loansError.message}
            </div>
          )}
          <LoansReportTable loans={loans} loading={loansLoading} />
        </div>
      )}

      {activeTab === 'inventory' && (
        <InventoryReportSummary report={report} loading={inventoryLoading} error={inventoryError} />
      )}

      {activeTab === 'fines' && <FinesReportSummary />}
    </div>
  );
}
