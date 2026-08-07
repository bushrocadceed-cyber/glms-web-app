import { downloadBlob } from './downloadBlob';

function escapeCSVField(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

// Generic CSV export, reused by every "Export to CSV" button in the app
// (ReportsPage, FinesReportSummary, ActivityLogsPage) instead of each one
// hand-rolling its own CSV/download logic.
//
// data: an array of flat plain objects — each object's own keys become the
// header row, in first-seen order across all rows (so callers shape their
// own column names/order by how they build the objects they pass in,
// rather than this function guessing what to include or how to label it).
//
// Returns false (and downloads nothing) for an empty/missing dataset, so
// callers can show a "nothing to export" message instead of silently
// producing a header-only file.
export function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) return false;

  const headers = [
    ...data.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set()),
  ];

  const csvRows = [
    headers.map(escapeCSVField).join(','),
    ...data.map((row) => headers.map((key) => escapeCSVField(row[key])).join(',')),
  ];

  // Leading BOM so Excel (Windows especially) opens the file as UTF-8
  // instead of guessing the system codepage and mangling anything non-ASCII.
  const BOM = String.fromCharCode(0xfeff);
  const csvContent = BOM + csvRows.join('\r\n');

  downloadBlob(csvContent, filename.endsWith('.csv') ? filename : `${filename}.csv`, 'text/csv;charset=utf-8;');
  return true;
}
