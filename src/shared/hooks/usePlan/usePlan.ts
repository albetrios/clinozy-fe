import { appointmentQueryKeys } from '@/shared/api/clinic/appointments-api.ts';
import type {
  DeleteReason,
  OfferingSuggestion,
} from '@/shared/api/clinic/clinic-schema.ts';
import {
  addSuggestion,
  fetchPlan,
  planQueryKeys,
  removeSuggestion,
  restoreSuggestion,
  updateSuggestion,
} from '@/shared/api/clinic/plan-api.ts';
import type {
  PatientPlan,
  SuggestionCreateInput,
  SuggestionPatch,
} from '@/shared/api/clinic/plan-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/**
 * A patient's plan (`getPlan`, `S:1635`) — the Offering suggestions card in
 * the appointment form and the patient file. A suggestion write refetches the
 * plan and the appointment reads ("Plan ready · <n> offerings").
 */

/** What a suggestion write may have changed. */
const PLAN_WRITE_KEYS = [planQueryKeys.all, appointmentQueryKeys.all];

/** The patient's plan; idle without a patient. */
export function usePlan(patientId: string | null) {
  return useAppQuery({
    queryKey: planQueryKeys.detail(patientId ?? ''),
    queryFn: () => fetchPlan(patientId ?? ''),
    enabled: patientId !== null,
  });
}

/** Add an offering to the plan — an idea's "+ Add" or "Add offering"; the caller toasts. */
export function useAddSuggestion(
  options: CrudMutationOptions<OfferingSuggestion, SuggestionCreateInput> = {},
) {
  return useAppMutation<OfferingSuggestion, SuggestionCreateInput>({
    mutationFn: addSuggestion,
    invalidateKeys: PLAN_WRITE_KEYS,
    ...options,
  });
}

/** What a suggestion edit sends: the suggestion, its patient's plan and the change. */
export interface SuggestionUpdateVars {
  id: string;
  patientId: string;
  patch: SuggestionPatch;
}

/** The plan with one suggestion's change applied — the optimistic side of an edit. */
export function withSuggestionPatch(
  plan: PatientPlan | undefined,
  { id, patch }: Pick<SuggestionUpdateVars, 'id' | 'patch'>,
): PatientPlan | undefined {
  if (!plan) return plan;
  return {
    ...plan,
    suggestions: plan.suggestions.map((row) =>
      row.id === id ? { ...row, ...patch } : row,
    ),
  };
}

/**
 * Edit a suggestion's quantity, price or status — optimistic (`S:1646`): the
 * card moves at once and goes back if the write fails.
 */
export function useUpdateSuggestion(
  options: CrudMutationOptions<OfferingSuggestion, SuggestionUpdateVars> = {},
) {
  return useAppMutation<OfferingSuggestion, SuggestionUpdateVars, PatientPlan>({
    mutationFn: ({ id, patch }) => updateSuggestion(id, patch),
    invalidateKeys: PLAN_WRITE_KEYS,
    optimisticQueries: {
      queryKey: planQueryKeys.all,
      update: (data, vars) =>
        typeof data === 'object' && data !== null && 'suggestions' in data
          ? withSuggestionPatch(data as PatientPlan, vars)
          : data,
    },
    ...options,
  });
}

/** What a confirmed remove sends: the suggestion and the reason confirm's choice. */
export interface SuggestionRemoveVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Remove a suggestion — no toast of its own: the caller's "<name> removed
 * from suggestions" carries Undo, which runs {@link useRestoreSuggestion}.
 */
export function useRemoveSuggestion(
  options: CrudMutationOptions<OfferingSuggestion, SuggestionRemoveVars> = {},
) {
  return useAppMutation<OfferingSuggestion, SuggestionRemoveVars>({
    mutationFn: ({ id, reason, note }) => removeSuggestion(id, reason, note),
    invalidateKeys: PLAN_WRITE_KEYS,
    ...options,
  });
}

/** Bring a removed suggestion back — the Undo; silent on success. */
export function useRestoreSuggestion(
  options: CrudMutationOptions<OfferingSuggestion, string> = {},
) {
  return useAppMutation<OfferingSuggestion, string>({
    mutationFn: restoreSuggestion,
    invalidateKeys: PLAN_WRITE_KEYS,
    ...options,
  });
}
