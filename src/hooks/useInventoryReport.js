import { useCallback, useEffect, useState } from 'react';
import { getInventoryReport } from '../services/reportService';

export function useInventoryReport() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(() => {
    setLoading(true);
    setError(null);

    getInventoryReport()
      .then(setReport)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return { report, loading, error, refetch: fetchReport };
}
