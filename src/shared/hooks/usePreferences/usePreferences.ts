import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  type ClinicPreferences,
  DEFAULT_CLINIC_PREFERENCES,
  fetchMyPreferences,
  preferencesQueryKeys,
  saveMyPreferences,
} from '@/shared/api/clinic/preferences-api.ts';
import { reportError } from '@/shared/errors/errorHandler.ts';

/** The user's clinic preferences, and a silent optimistic `update`. */
export interface UsePreferencesResult {
  preferences: ClinicPreferences;
  isPending: boolean;
  update: (patch: Partial<ClinicPreferences>) => void;
}

/**
 * The signed-in user's clinic preferences (pins, branch filter, file pins,
 * recent picks — KICKOFF §3.3, D32). Server state, so TanStack Query owns it.
 * A change shows at once and saves SILENTLY (`updatePreference`: no toast,
 * network errors retried); if every retry fails it rolls back and is reported,
 * still without a toast.
 */
export function usePreferences(): UsePreferencesResult {
  const queryClient = useQueryClient();
  const queryKey = preferencesQueryKeys.mine();
  const query = useQuery({ queryKey, queryFn: fetchMyPreferences, staleTime: Infinity });

  const mutation = useMutation({
    mutationFn: saveMyPreferences,
    retry: 3,
    onMutate: async (patch: Partial<ClinicPreferences>) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ClinicPreferences>(queryKey);
      queryClient.setQueryData<ClinicPreferences>(queryKey, {
        ...(previous ?? DEFAULT_CLINIC_PREFERENCES),
        ...patch,
      });
      return { previous };
    },
    onError: (error, _patch, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      reportError(error, { scope: 'clinic-preferences' });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved);
    },
  });

  const { mutate } = mutation;
  const update = useCallback(
    (patch: Partial<ClinicPreferences>) => mutate(patch),
    [mutate],
  );

  return {
    preferences: query.data ?? DEFAULT_CLINIC_PREFERENCES,
    isPending: query.isPending,
    update,
  };
}
