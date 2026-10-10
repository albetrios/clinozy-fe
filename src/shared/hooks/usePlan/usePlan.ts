import { useRef } from 'react';

import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import {
  createPlanSuggestion,
  deletePlanSuggestion,
  fetchPlan,
  fetchPlanActivity,
  fetchPlanIdeas,
  fetchPlanOfferings,
  planContextQueryKeys,
  planQueryKeys,
  restorePlanSuggestion,
  updatePlanSuggestion,
} from '@/shared/api/clinic/plan-api.ts';
import type {
  PatientPlan,
  PlanSuggestionRow,
  SuggestionChange,
} from '@/shared/api/clinic/plan-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/*
 * A patient's plan on clinozy-be (api-integration §5.4) — the Offering suggestions card in the
 * patient file: its rows and total, the ideas, the catalogue it names and adds from, the
 * contact's last messages, and the row writes. A write refetches the plan and its ideas (an
 * offering in the plan is never an idea); an edit moves the card at once and goes back if it
 * fails.
 */

/** What a plan write may have changed: every patient's rows, total and ideas. */
const PLAN_WRITE_KEYS = [planQueryKeys.all];

/** The organization a read is keyed by; reads wait for one. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/** A patient's plan rows and the server's total; idle without a patient or an organization. */
export function usePlan(patientId: string | null) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: planQueryKeys.patient(organizationId, patientId ?? ''),
    queryFn: () => fetchPlan(patientId ?? ''),
    enabled: Boolean(patientId) && organizationId !== null,
  });
}

/** The patient's ideas from history (`…/offering-ideas`); idle without a patient. */
export function usePlanIdeas(patientId: string | null) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: planQueryKeys.ideas(organizationId, patientId ?? ''),
    queryFn: () => fetchPlanIdeas(patientId ?? ''),
    enabled: Boolean(patientId) && organizationId !== null,
  });
}

/** How long the offerings catalogue stays fresh — it changes in the Offerings room only. */
const CATALOGUE_STALE_MS = 5 * 60_000;

/** The clinic's offerings, active or not — what the card names its rows by and adds from. */
export function usePlanOfferings({ enabled = true }: { enabled?: boolean } = {}) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: planContextQueryKeys.offerings(organizationId),
    queryFn: fetchPlanOfferings,
    enabled: enabled && organizationId !== null,
    staleTime: CATALOGUE_STALE_MS,
  });
}

/**
 * The contact's last five messages and calls — "Contact activity"; idle without a contact or
 * when the member may not read the stream (`contact_activity:read`, the caller's `enabled`).
 */
export function usePlanActivity(
  contactId: string | null,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: planContextQueryKeys.activity(organizationId, contactId ?? ''),
    queryFn: () => fetchPlanActivity(contactId ?? ''),
    enabled: enabled && Boolean(contactId) && organizationId !== null,
  });
}

/** What "+ Add" or "Add offering" sends: the patient, the offering and why. */
export interface SuggestionAddVars {
  patientId: string;
  offeringId: string;
  reason: string | null;
}

/** Add an offering to the plan — the caller toasts; `409 suggestion_exists` toasts the server's words. */
export function useAddSuggestion(
  options: CrudMutationOptions<PlanSuggestionRow, SuggestionAddVars> = {},
) {
  return useAppMutation<PlanSuggestionRow, SuggestionAddVars>({
    mutationFn: ({ patientId, offeringId, reason }, action) =>
      createPlanSuggestion({
        patientId,
        input: { offeringId, reason },
        idempotencyKey: action.idempotencyKey,
      }),
    invalidateKeys: PLAN_WRITE_KEYS,
    ...options,
  });
}

/** What a row's edit sends: the row, its patient, the change and the `updated_at` it was read at. */
export interface SuggestionUpdateVars {
  patientId: string;
  suggestionId: string;
  change: SuggestionChange;
  expectedUpdatedAt: string;
}

/** A cached plan with one row's change applied — the optimistic side of an edit. */
export function withSuggestionChange(
  plan: PatientPlan,
  { suggestionId, change }: Pick<SuggestionUpdateVars, 'suggestionId' | 'change'>,
): PatientPlan {
  return {
    ...plan,
    suggestions: plan.suggestions.map((row) =>
      row.id === suggestionId ? { ...row, ...change } : row,
    ),
  };
}

/** Whether a cached value is a plan (the ideas sit under the same key). */
const isPlan = (data: unknown): data is PatientPlan =>
  typeof data === 'object' && data !== null && 'suggestions' in data;

/** The later of two ISO instants. */
const later = (first: string, second: string | undefined) =>
  second !== undefined && second > first ? second : first;

/**
 * Change a row's quantity, final amount or status — optimistic: the card moves at once and goes
 * back if the write fails. One write at a time per row, each sent with the row's latest
 * `updated_at` — this card's own last save counts — so a quick second step of the stepper waits
 * for the first instead of failing as a stale save; someone else's save in between still answers
 * `409 record_changed`.
 */
export function useUpdateSuggestion(
  options: CrudMutationOptions<PlanSuggestionRow, SuggestionUpdateVars> = {},
) {
  const writes = useRef(new Map<string, Promise<unknown>>());
  const savedAt = useRef(new Map<string, string>());
  return useAppMutation<PlanSuggestionRow, SuggestionUpdateVars>({
    mutationFn: (vars, action) => {
      const before = writes.current.get(vars.suggestionId) ?? Promise.resolve();
      const write = before
        .catch(() => undefined)
        .then(async () => {
          const saved = await updatePlanSuggestion({
            patientId: vars.patientId,
            suggestionId: vars.suggestionId,
            change: vars.change,
            expectedUpdatedAt: later(
              vars.expectedUpdatedAt,
              savedAt.current.get(vars.suggestionId),
            ),
            idempotencyKey: action.idempotencyKey,
          });
          savedAt.current.set(saved.id, saved.updatedAt);
          return saved;
        });
      writes.current.set(vars.suggestionId, write);
      return write;
    },
    invalidateKeys: PLAN_WRITE_KEYS,
    optimisticQueries: {
      queryKey: planQueryKeys.all,
      update: (data, vars) => (isPlan(data) ? withSuggestionChange(data, vars) : data),
    },
    ...options,
  });
}

/** What a confirmed remove sends: the row, its patient and the reason the confirm stored. */
export interface SuggestionRemoveVars {
  patientId: string;
  suggestionId: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Remove a row — no toast of its own: the caller's "<name> removed from suggestions" carries
 * Undo, which runs {@link useRestoreSuggestion}.
 */
export function useRemoveSuggestion(
  options: CrudMutationOptions<void, SuggestionRemoveVars> = {},
) {
  return useAppMutation<void, SuggestionRemoveVars>({
    mutationFn: (vars, action) =>
      deletePlanSuggestion({ ...vars, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: PLAN_WRITE_KEYS,
    ...options,
  });
}

/** What the remove toast's Undo sends: the row and its patient. */
export interface SuggestionRestoreVars {
  patientId: string;
  suggestionId: string;
}

/** Bring a removed row back — the Undo; silent on success. */
export function useRestoreSuggestion(
  options: CrudMutationOptions<PlanSuggestionRow, SuggestionRestoreVars> = {},
) {
  return useAppMutation<PlanSuggestionRow, SuggestionRestoreVars>({
    mutationFn: (vars, action) =>
      restorePlanSuggestion({ ...vars, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: PLAN_WRITE_KEYS,
    ...options,
  });
}
