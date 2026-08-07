// Shared browser-download boilerplate — used by exportToCSV.js and
// Settings' Backup Library Data button, so the create-a-link/click/revoke
// dance is written once instead of duplicated at every download call site.
export function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
