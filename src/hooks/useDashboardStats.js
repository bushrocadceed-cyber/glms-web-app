import { useEffect, useState } from 'react';
import { getAvailableBooksCount, getTotalBooksCount } from '../services/bookService';
import { getOverdueLoansCount, getTotalOutstandingFines } from '../services/loanService';

const INITIAL_STATS = {
  totalBooks: null,
  availableBooks: null,
  overdueLoans: null,
  outstandingFines: null,
};

export function useDashboardStats() {
  const [stats, setStats] = useState(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      getTotalBooksCount(),
      getAvailableBooksCount(),
      getOverdueLoansCount(),
      getTotalOutstandingFines(),
    ])
      .then(([totalBooks, availableBooks, overdueLoans, outstandingFines]) => {
        if (isMounted) setStats({ totalBooks, availableBooks, overdueLoans, outstandingFines });
      })
      .catch((err) => {
        if (isMounted) setError(err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { stats, loading, error };
}
