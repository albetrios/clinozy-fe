import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import i18n from '@/lib/i18n/i18n.ts';
import {
  fetchSignInClinic,
  saveSignInClinic,
  userSettingsQueryKeys,
} from '@/shared/api/user-settings-api.ts';
import { reportError } from '@/shared/errors/errorHandler.ts';
import { mapFrontendError } from '@/shared/errors/map-frontend-error.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { notify } from '@/shared/notify/index.ts';
import {
  type MyOrganizationSummary,
  useMyOrganizationSummaries,
} from '@/shared/tenancy/my-organization-summaries.ts';

/** The clinic that opens at sign-in, the clinics to choose from, and an optimistic setter. */
export interface UseSignInClinicResult {
  /** The person's clinics (team organizations), in the order the list serves them. */
  clinics: readonly MyOrganizationSummary[];
  /** The pinned clinic's id, or `null` for "the clinic I used last". */
  pinnedId: string | null;
  /** Two or more clinics and the choice is known — the only time there is something to choose. */
  canChoose: boolean;
  /** Pin a clinic, or `null` for automatic; shows at once, rolls back on failure. */
  choose: (organizationId: string | null) => void;
}

const keys = LAYOUT_KEYS.app.signInClinic;

/**
 * The clinic that opens at sign-in (clinozy-be `feat-choose-default-clinic`): automatic — the
 * clinic used last — unless the person pins one. Shared by Settings › Account and the account
 * menu, under one query key, so a change in either shows in both.
 *
 * @remarks
 * - A pin that is not among the person's clinics (the list moved first) reads as automatic, as
 *   clinozy-be itself treats it.
 * - The change shows at once; a toast names the result. A failed save puts the previous choice
 *   back and says why.
 */
export function useSignInClinic(): UseSignInClinicResult {
  const queryClient = useQueryClient();
  const queryKey = userSettingsQueryKeys.signInClinic();
  const organizations = useMyOrganizationSummaries();
  const pinned = useQuery({ queryKey, queryFn: fetchSignInClinic, staleTime: 60_000 });

  const clinics = (organizations.data ?? []).filter(
    (organization) => organization.type === 'TEAM',
  );

  const mutation = useMutation({
    mutationFn: saveSignInClinic,
    onMutate: async (next: string | null) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<string | null>(queryKey) ?? null;
      queryClient.setQueryData<string | null>(queryKey, next);
      return { previous };
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<string | null>(queryKey, saved);
      const name = clinics.find((clinic) => clinic.id === saved)?.name;
      notify.success(
        name
          ? i18n.t(keys.savedClinic, { ns: LAYOUT_NS, name })
          : i18n.t(keys.savedAutomatic, { ns: LAYOUT_NS }),
      );
    },
    onError: (error, _next, context) => {
      queryClient.setQueryData<string | null>(queryKey, context?.previous ?? null);
      reportError(error, { scope: 'sign-in-clinic-save' });
      notify.error(mapFrontendError(error));
    },
  });

  const { mutate } = mutation;
  const choose = useCallback((next: string | null) => mutate(next), [mutate]);
  const pinnedId =
    pinned.data && clinics.some((clinic) => clinic.id === pinned.data)
      ? pinned.data
      : null;

  return {
    clinics,
    pinnedId,
    canChoose: clinics.length >= 2 && pinned.isSuccess,
    choose,
  };
}
