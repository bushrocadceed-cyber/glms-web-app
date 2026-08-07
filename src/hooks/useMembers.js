import { useCallback, useEffect, useMemo, useState } from 'react';
import { getMembers } from '../services/memberService';
import { isTrashed } from '../lib/memberTrashStore';

// trash: false -> active (non-deleted) members, true -> the trash list.
// getMembers() itself is unfiltered — one fetch backs both `members` and
// `trashCount` here, rather than needing a second round-trip just to show
// a count badge on the Trash tab while the active view is showing.
export function useMembers({ trash = false } = {}) {
  const [allMembers, setAllMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMembers = useCallback(() => {
    setLoading(true);
    setError(null);

    getMembers()
      .then(setAllMembers)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const members = useMemo(
    () => allMembers.filter((member) => isTrashed(member.id) === trash),
    [allMembers, trash]
  );

  const trashCount = useMemo(
    () => allMembers.filter((member) => isTrashed(member.id)).length,
    [allMembers]
  );

  return { members, trashCount, loading, error, refetch: fetchMembers };
}
