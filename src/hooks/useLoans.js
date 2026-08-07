import { useCallback, useEffect, useState } from 'react';
import { getAllLoans } from '../services/loanService';

export function useLoans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLoans = useCallback(() => {
    setLoading(true);
    setError(null);

    getAllLoans()
      .then(setLoans)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  return { loans, loading, error, refetch: fetchLoans };
}
