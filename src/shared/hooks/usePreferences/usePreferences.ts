import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  type AppPreferences,
  DEFAULT_APP_PREFERENCES,
  fetchMyPreferences,
  preferencesQueryKeys,
  saveMyPreferences,
} from '@/shared/api/app/preferences-api.ts';
import { reportError } from '@/shared/errors/errorHandler.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The user's clinic preferences, and a silent optimistic `update`. */
export interface UsePreferencesResult {
  preferences: AppPreferences;
  isPending: boolean;
  update: (patch: Partial<AppPreferences>) => void;
}

/**
 * The member's clinic preferences in the active organization (pins, branch
 * filter, file pins, recent picks — KICKOFF §3.3, D32). Server state, so
 * TanStack Query owns it. Read only for a signed-in member of an organization
 * — the record is the membership's; signed out (the sign-in pages render a
 * Picker) it is the defaults and nothing is saved. A change shows at once and
 * saves SILENTLY (no toast, network errors retried); if every retry fails it
 * rolls back and is reported, still without a toast.
 */
export function usePreferences(): UsePreferencesResult {
  const queryClient = useQueryClient();
  const signedIn = useAuthStore((state) => state.user !== null);
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const active = signedIn && organizationId !== null;
  const queryKey = preferencesQueryKeys.mine(organizationId);
  const query = useQuery({
    queryKey,
    queryFn: fetchMyPreferences,
    staleTime: Infinity,
    enabled: active,
  });

  const mutation = useMutation({
    mutationFn: saveMyPreferences,
    retry: 3,
    onMutate: async (patch: Partial<AppPreferences>) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<AppPreferences>(queryKey);
      queryClient.setQueryData<AppPreferences>(queryKey, {
        ...(previous ?? DEFAULT_APP_PREFERENCES),
        ...patch,
      });
      return { previous };
    },
    onError: (error, _patch, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      reportError(error, { scope: 'app-preferences' });
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved);
    },
  });

  const { mutate } = mutation;
  const update = useCallback(
    (patch: Partial<AppPreferences>) => {
      if (active) mutate(patch);
    },
    [active, mutate],
  );

  return {
    preferences: query.data ?? DEFAULT_APP_PREFERENCES,
    isPending: active && query.isPending,
    update,
  };
}
