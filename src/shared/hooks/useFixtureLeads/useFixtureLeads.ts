import {
  fetchFixtureLead,
  fetchFixtureLeadViewer,
  fixtureLeadQueryKeys,
  updateFixtureLead,
} from '@/shared/api/clinic/leads-fixture-api.ts';
import type {
  LeadPatch,
  LeadRecord,
} from '@/shared/api/clinic/leads-fixture-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

/*
 * The fixture world's leads for the rooms still on fixtures (D149) — the appointment form, New
 * task, the task assignees. The Leads room reads clinozy-be (`useLeads`); these go with the last
 * fixture room that reads a lead.
 */

/** The signed-in member as the fixture rooms read them (their staff profile); `null` until known. */
export function useFixtureLeadViewer() {
  const email = useAuthStore((state) => state.user?.email ?? null);
  return useAppQuery({
    queryKey: fixtureLeadQueryKeys.viewer(email),
    queryFn: () => fetchFixtureLeadViewer(email),
    staleTime: 5 * 60_000,
  });
}

/** One fixture lead by id; idle while there is no id. */
export function useFixtureLead(id: string | undefined) {
  return useAppQuery({
    queryKey: fixtureLeadQueryKeys.detail(id ?? ''),
    queryFn: () => fetchFixtureLead(id ?? ''),
    enabled: Boolean(id),
  });
}

/** What a fixture lead edit sends. */
export interface FixtureLeadUpdateVars {
  id: string;
  patch: LeadPatch;
}

/** Edit a fixture lead's person — the appointment form's inline contact editor. */
export function useUpdateFixtureLead(
  options: CrudMutationOptions<LeadRecord, FixtureLeadUpdateVars> = {},
) {
  return useAppMutation<LeadRecord, FixtureLeadUpdateVars>({
    mutationFn: ({ id, patch }) => updateFixtureLead(id, patch),
    invalidateKeys: [fixtureLeadQueryKeys.all],
    ...options,
  });
}
