import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import type { DeleteReason } from './clinic-schema.ts';
import { patientQueryKeys } from './patients-api.ts';
import {
  type PatientPlan,
  PLAN_ACTIVITY_TYPES,
  type PlanActivityRow,
  planActivityWire,
  type PlanIdeaRow,
  planIdeaWire,
  type PlanSuggestionRow,
  planSuggestionWire,
  type SuggestionChange,
  type SuggestionCreateInput,
  toPlanActivityRow,
  toPlanIdeaRow,
  toPlanSuggestionRow,
} from './plan-contracts.ts';

/*
 * A patient's plan on clinozy-be (api-integration §5.4): the rows and their total
 * (`…/offering-suggestions`, every page), the ideas (`…/offering-ideas`), the contact's last
 * messages — and the row writes: add (409 `suggestion_exists`), change (`expected_updated_at`),
 * remove with a reason, restore. The offerings the card names and adds from are the one
 * catalogue (`useOfferings`). Linking an invoice line to a row is the invoice's
 * `patient_offering_suggestion_id` — no call here.
 */

/** TanStack Query keys for the plans — under the patients' key. */
export const planQueryKeys = {
  all: [...patientQueryKeys.all, 'plan'] as const,
  /** One patient's rows and total; their ideas sit under it. */
  patient: (organizationId: string | null, patientId: string) =>
    [...planQueryKeys.all, organizationId, patientId] as const,
  ideas: (organizationId: string | null, patientId: string) =>
    [...planQueryKeys.patient(organizationId, patientId), 'ideas'] as const,
};

/**
 * TanStack Query keys for what the card reads around a plan — the contact's last messages —
 * apart from the plan's, so a plan write does not refetch them. (The offerings catalogue is the
 * Offerings room's own entry, `offeringQueryKeys.list`.)
 */
export const planContextQueryKeys = {
  all: ['clinic', 'plan-context'] as const,
  activity: (organizationId: string | null, contactId: string) =>
    [...planContextQueryKeys.all, organizationId, 'activity', contactId] as const,
};

/** The most one page of a list takes. */
const PAGE_SIZE = 100;

/** How many lines "Contact activity" lists (H:2823). */
const ACTIVITY_LINES = 5;

/** The cursor of the page after this one, `null` on the last. */
const nextCursor = (meta?: {
  pagination?: { has_more: boolean; next: string | null };
}) => (meta?.pagination?.has_more ? meta.pagination.next : null);

/** The plan list's own `meta` field — the planned and accepted rows' total. */
const planMetaWire = z.object({ plan_total: z.number().optional() });

/** A patient's plan: every row, newest first, and the server's `meta.plan_total`. */
export async function fetchPlan(patientId: string): Promise<PatientPlan> {
  let planTotal = 0;
  const suggestions = await collectAllPages(async (after) => {
    const response = await api.get('/app/patients/{patient_id}/offering-suggestions', {
      params: { patient_id: patientId },
      query: {
        sort: 'created_at',
        order: 'desc',
        limit: PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    planTotal = planMetaWire.parse(response.meta ?? {}).plan_total ?? planTotal;
    return {
      rows: z
        .array(planSuggestionWire)
        .parse(response.data ?? [])
        .map(toPlanSuggestionRow),
      next: nextCursor(response.meta),
    };
  }, 'offering-suggestions');
  return { suggestions, planTotal };
}

/** The patient's ideas — the server's, at most four, never an offering already in the plan. */
export async function fetchPlanIdeas(patientId: string): Promise<PlanIdeaRow[]> {
  const response = await api.get('/app/patients/{patient_id}/offering-ideas', {
    params: { patient_id: patientId },
  });
  return z.array(planIdeaWire).parse(response.data).map(toPlanIdeaRow);
}

/** The contact's last five messages and calls, newest first. */
export async function fetchPlanActivity(contactId: string): Promise<PlanActivityRow[]> {
  const response = await api.get('/app/contacts/{contact_id}/activities', {
    params: { contact_id: contactId },
    query: {
      type: PLAN_ACTIVITY_TYPES.join(','),
      sort: 'occurred_at',
      order: 'desc',
      limit: ACTIVITY_LINES,
    },
  });
  return z
    .array(planActivityWire)
    .parse(response.data ?? [])
    .flatMap((row) => toPlanActivityRow(row) ?? []);
}

/** The row a write answers. */
const rowOf = (data: unknown): PlanSuggestionRow =>
  toPlanSuggestionRow(planSuggestionWire.parse(data));

/**
 * Add an offering to the plan — one unit at its billed price, Planned; `409 suggestion_exists`
 * when the plan already holds it.
 */
export async function createPlanSuggestion({
  patientId,
  input,
  idempotencyKey,
}: {
  patientId: string;
  input: SuggestionCreateInput;
  idempotencyKey: string;
}): Promise<PlanSuggestionRow> {
  const response = await api.post('/app/patients/{patient_id}/offering-suggestions', {
    params: { patient_id: patientId },
    body: { offering_id: input.offeringId, reason: input.reason },
    idempotencyKey,
  });
  return rowOf(response.data);
}

/**
 * Change a row's quantity, final amount or status — `400` names `quantity` below what was
 * invoiced; `409 record_changed` when it changed since `expectedUpdatedAt`.
 */
export async function updatePlanSuggestion({
  patientId,
  suggestionId,
  change,
  expectedUpdatedAt,
  idempotencyKey,
}: {
  patientId: string;
  suggestionId: string;
  change: SuggestionChange;
  expectedUpdatedAt: string;
  idempotencyKey: string;
}): Promise<PlanSuggestionRow> {
  const response = await api.patch(
    '/app/patients/{patient_id}/offering-suggestions/{patient_offering_suggestion_id}',
    {
      params: { patient_id: patientId, patient_offering_suggestion_id: suggestionId },
      body: { ...change, expected_updated_at: expectedUpdatedAt },
      idempotencyKey,
    },
  );
  return rowOf(response.data);
}

/** Remove a row with the reason the confirm stored (`other` needs its note). */
export async function deletePlanSuggestion({
  patientId,
  suggestionId,
  reason,
  note,
  idempotencyKey,
}: {
  patientId: string;
  suggestionId: string;
  reason: DeleteReason;
  note: string | null;
  idempotencyKey: string;
}): Promise<void> {
  await api.delete(
    '/app/patients/{patient_id}/offering-suggestions/{patient_offering_suggestion_id}',
    {
      params: { patient_id: patientId, patient_offering_suggestion_id: suggestionId },
      reason,
      note: note ?? undefined,
      idempotencyKey,
    },
  );
}

/** Bring a removed row back — the remove toast's Undo; `409` when the plan holds it again. */
export async function restorePlanSuggestion({
  patientId,
  suggestionId,
  idempotencyKey,
}: {
  patientId: string;
  suggestionId: string;
  idempotencyKey: string;
}): Promise<PlanSuggestionRow> {
  const response = await api.post(
    '/app/patients/{patient_id}/offering-suggestions/{patient_offering_suggestion_id}/restore',
    {
      params: { patient_id: patientId, patient_offering_suggestion_id: suggestionId },
      idempotencyKey,
    },
  );
  return rowOf(response.data);
}
