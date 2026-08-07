import { useCallback, useEffect, useState } from 'react';
import { getLoansReport } from '../services/reportService';

export function useLoansReport(filters) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { startDate, endDate, status } = filters;

  const fetchReport = useCallback(() => {
    setLoading(true);
    setError(null);

    getLoansReport({ startDate, endDate, status })
      .then(setLoans)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [startDate, endDate, status]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return { loans, loading, error, refetch: fetchReport };
}
