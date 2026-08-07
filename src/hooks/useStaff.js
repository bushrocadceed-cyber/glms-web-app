import { useCallback, useEffect, useState } from 'react';
import { getStaffProfiles } from '../services/staffService';

export function useStaff({ trash = false, roleGroup } = {}) {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStaff = useCallback(() => {
    setLoading(true);
    setError(null);

    getStaffProfiles({ trash, roleGroup })
      .then(setStaff)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [trash, roleGroup]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  return { staff, loading, error, refetch: fetchStaff };
}
