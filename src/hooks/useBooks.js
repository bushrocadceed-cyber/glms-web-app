import { useCallback, useEffect, useState } from 'react';
import { getBooks, getDeletedBooks } from '../services/bookService';

export function useBooks(mode = 'active') {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBooks = useCallback(() => {
    setLoading(true);
    setError(null);

    const request = mode === 'trash' ? getDeletedBooks() : getBooks();

    request
      .then(setBooks)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  return { books, loading, error, refetch: fetchBooks };
}
