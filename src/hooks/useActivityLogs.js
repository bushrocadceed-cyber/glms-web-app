import { useCallback, useEffect, useState } from 'react';
import { getActivityLogs } from '../services/activityLogService';

export function useActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [tableReady, setTableReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    setError(null);

    getActivityLogs()
      .then(({ rows, tableReady: ready }) => {
        setLogs(rows);
        setTableReady(ready);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, tableReady, loading, error, refetch: fetchLogs };
}
