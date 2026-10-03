import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { Presence } from '@/shared/api/clinic/clinic-schema.ts';
import {
  fetchMyPresence,
  presenceQueryKeys,
  saveMyPresence,
} from '@/shared/api/clinic/presence-api.ts';
import { reportError } from '@/shared/errors/errorHandler.ts';

/** The member's presence and an optimistic setter. */
export interface UsePresenceResult {
  presence: Presence;
  setPresence: (presence: Presence) => void;
}

/**
 * The signed-in member's presence — Online · Away · Busy, the Account menu's
 * Status (KICKOFF §3.2). The change shows at once; a failed save rolls back and
 * is reported.
 */
export function usePresence(): UsePresenceResult {
  const queryClient = useQueryClient();
  const queryKey = presenceQueryKeys.mine();
  const { data } = useQuery({ queryKey, queryFn: fetchMyPresence, staleTime: Infinity });

  const mutation = useMutation({
    mutationFn: saveMyPresence,
    retry: 3,
    onMutate: async (next: Presence) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Presence>(queryKey);
      queryClient.setQueryData<Presence>(queryKey, next);
      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      reportError(error, { scope: 'presence-save' });
    },
  });

  const { mutate } = mutation;
  const setPresence = useCallback((next: Presence) => mutate(next), [mutate]);
  return { presence: data ?? 'online', setPresence };
}
