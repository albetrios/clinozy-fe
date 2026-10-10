import i18n from '@/lib/i18n/i18n.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import { contactQueryKeys } from '@/shared/api/clinic/contacts-api.ts';
import {
  claimLead,
  countOpenLeadTasks,
  countUnrepliedLeads,
  createLead,
  deleteLead,
  fetchLead,
  type LeadPersonInput,
  leadQueryKeys,
  listLeads,
  releaseLead,
  restoreLead,
  updateLead,
} from '@/shared/api/clinic/leads-api.ts';
import type {
  LeadFields,
  LeadListParams,
  LeadRecord,
} from '@/shared/api/clinic/leads-contracts.ts';
import { messageQueryKeys } from '@/shared/api/clinic/messages-api.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { LEAD_TOASTS_KEYS, LEAD_TOASTS_NS } from './leads-toasts.constants.ts';

/** A toast in the Leads room's vocabulary. */
function leadToast(key: string, values: Record<string, string> = {}): string {
  return i18n.t(key, { ns: LEAD_TOASTS_NS, ...values });
}

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/** What a lead write changes: the leads, their tasks (a follow-up), the person's activity. */
const LEAD_WRITE_KEYS = [leadQueryKeys.all, taskQueryKeys.all, messageQueryKeys.all];

// ── Reads ──

/**
 * The pipeline, 50 rows a page (`GET /app/leads`) — the Leads list's infinite scroll, for the
 * URL's params; while new ones load the previous rows stay on screen. A failed page keeps the
 * last rows and says so (`useListLoadError`).
 */
export function useLeadList(
  params: LeadListParams,
  options: {
    /** Read only once the params are known — Mine and Unreplied wait for the viewer. */
    enabled?: boolean;
  } = {},
) {
  const organizationId = useOrganizationId();
  const list = useCursorList<LeadRecord>({
    queryKey: leadQueryKeys.list(organizationId, params),
    queryFn: async (after) => {
      const page = await listLeads(params, after);
      return { rows: page.rows, next: page.next, hasMore: page.next !== null };
    },
    notifyOnError: false,
    enabled: (options.enabled ?? true) && organizationId !== null,
  });
  useListLoadError(list, 'leads');
  return list;
}

/**
 * A lead's open tasks — the drawer's Info count; idle without an id, and while `enabled` is false
 * (a member without `task:read` would get a 403).
 */
export function useOpenLeadTasks(id: string | undefined, { enabled = true } = {}) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: leadQueryKeys.openTasks(organizationId, id ?? ''),
    queryFn: () => countOpenLeadTasks(id ?? ''),
    enabled: id !== undefined && enabled,
  });
}

/** One lead by id; idle while there is no id. A deleted or unknown id fails with a 404. */
export function useLead(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: leadQueryKeys.detail(organizationId, id ?? ''),
    queryFn: () => fetchLead(id ?? ''),
    enabled: Boolean(id),
  });
}

/** The Unreplied tab's count chip: the viewer's leads awaiting their reply; idle without a viewer. */
export function useUnrepliedLeadCount(viewerId: string | null) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: leadQueryKeys.unreplied(organizationId, viewerId),
    queryFn: () => countUnrepliedLeads(viewerId),
    enabled: viewerId !== null,
  });
}

// ── Writes ──

/** What a create sends: who the lead is for and its fields. */
export interface LeadCreateVars {
  person: LeadPersonInput;
  fields: LeadFields;
}

/**
 * Create a lead — not optimistic (the drawer shows "Saving…"); on success "Lead #2386 created"
 * and the list refetches with the new lead first (D28).
 */
export function useCreateLead(
  options: CrudMutationOptions<LeadRecord, LeadCreateVars> = {},
) {
  return useAppMutation<LeadRecord, LeadCreateVars>({
    mutationFn: (vars, action) => createLead({ ...vars, ...action }),
    invalidateKeys: [leadQueryKeys.all, contactQueryKeys.all],
    successMessage: (lead) =>
      leadToast(LEAD_TOASTS_KEYS.created, { id: displayId.lead(lead.leadNumber) }),
    ...options,
  });
}

/** What a lead save sends. */
export interface LeadUpdateVars {
  lead: LeadRecord;
  fields: Partial<LeadFields>;
}

/**
 * Save a lead from its drawer — not optimistic, refused when someone saved it meanwhile
 * (`409 record_changed`, the drawer's Reload). "Lead saved", or "<name> → <status>" when the
 * status moved — no Undo: the API has no way back (Q7).
 */
export function useUpdateLead(
  options: CrudMutationOptions<LeadRecord, LeadUpdateVars> = {},
) {
  return useAppMutation<LeadRecord, LeadUpdateVars>({
    mutationFn: ({ lead, fields }, action) =>
      updateLead({
        leadId: lead.id,
        fields,
        expectedUpdatedAt: lead.updatedAt,
        ...action,
      }),
    invalidateKeys: LEAD_WRITE_KEYS,
    successMessage: (saved, { lead }) => {
      if (saved.status === lead.status) return leadToast(LEAD_TOASTS_KEYS.saved);
      const status = i18n.t(CLINIC_KEYS.leads.statuses[saved.status], { ns: CLINIC_NS });
      return leadToast(LEAD_TOASTS_KEYS.statusChanged, { name: saved.name, status });
    },
    ...options,
  });
}

/** What a claim sends: the lead as the row shows it. */
export interface LeadClaimVars {
  lead: LeadRecord;
  /** The previous owner's name for the toast; `null` when nobody held it. */
  ownerName: string | null;
  /** The drawer's own words ("Claimed by <me> …"). */
  message?: string;
}

/**
 * Claim a lead — "Open · Claim" from the row: "You now own <name> · <owner> stays involved".
 * No Undo: the API has no way back to the previous owner (Q7).
 */
export function useClaimLead(
  options: CrudMutationOptions<LeadRecord, LeadClaimVars> = {},
) {
  return useAppMutation<LeadRecord, LeadClaimVars>({
    mutationFn: ({ lead }, action) => claimLead(lead.id, action.idempotencyKey),
    invalidateKeys: [leadQueryKeys.all],
    successMessage: (_claimed, { lead, ownerName, message }) =>
      message ??
      (ownerName
        ? leadToast(LEAD_TOASTS_KEYS.claimed, { name: lead.name, owner: ownerName })
        : leadToast(LEAD_TOASTS_KEYS.claimedUnowned, { name: lead.name })),
    ...options,
  });
}

/** What an assignment sends. */
export interface LeadAssignVars {
  lead: LeadRecord;
  ownerId: string;
  /** The new owner's name for the toast. */
  ownerName: string;
  /** The caller's own words — a take-over says "You now own …". */
  message?: string;
}

/**
 * Assign a lead (`owner_membership_id`; a new owner starts a hold and the previous one stays
 * involved) — "<name> is now assigned · notified", or the caller's words; no Undo (Q7).
 */
export function useAssignLead(
  options: CrudMutationOptions<LeadRecord, LeadAssignVars> = {},
) {
  return useAppMutation<LeadRecord, LeadAssignVars>({
    mutationFn: ({ lead, ownerId }, action) =>
      updateLead({ leadId: lead.id, fields: { ownerId }, ...action }),
    invalidateKeys: LEAD_WRITE_KEYS,
    successMessage: (_assigned, { ownerName, message }) =>
      message ?? leadToast(LEAD_TOASTS_KEYS.assigned, { name: ownerName }),
    ...options,
  });
}

/** Release a lead to the team — "Released to the team · anyone can claim"; no Undo (Q7). */
export function useReleaseLead(
  options: CrudMutationOptions<LeadRecord, LeadRecord> = {},
) {
  return useAppMutation<LeadRecord, LeadRecord>({
    mutationFn: (lead, action) => releaseLead(lead.id, action.idempotencyKey),
    invalidateKeys: [leadQueryKeys.all],
    successMessage: () => leadToast(LEAD_TOASTS_KEYS.released),
    ...options,
  });
}

/** What an involved change sends: the new list. */
export interface LeadInvolvedVars {
  id: string;
  involvedIds: readonly string[];
}

/**
 * Add or remove someone involved — the people popover's toggle; applies at once, with no
 * stale check (a toggle carries no read) and no toast.
 */
export function useSetLeadInvolved() {
  return useAppMutation<LeadRecord, LeadInvolvedVars>({
    mutationFn: ({ id, involvedIds }, action) =>
      updateLead({ leadId: id, fields: { involvedIds: [...involvedIds] }, ...action }),
    invalidateKeys: LEAD_WRITE_KEYS,
  });
}

/** What a confirmed lead delete sends: the record and the Reason confirm's choice. */
export interface LeadDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Remove a lead — optimistic: the row leaves every cached list page at once and comes back if
 * the write fails. The lists and counts refresh — not the lead's own read, which would answer
 * 404 while its drawer closes. No toast of its own: the Reason confirm's "removed · <reason>"
 * with Undo runs {@link useRestoreLead}.
 */
export function useDeleteLead(options: CrudMutationOptions<void, LeadDeleteVars> = {}) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, LeadDeleteVars, unknown, LeadRecord>({
    mutationFn: ({ id, reason, note }) => deleteLead({ leadId: id, reason, note }),
    invalidateKeys: [
      leadQueryKeys.lists(organizationId),
      leadQueryKeys.unrepliedCounts(organizationId),
    ],
    optimisticInfinite: {
      queryKey: leadQueryKeys.lists(organizationId),
      update: (rows, { id }) => rows.filter((lead) => lead.id !== id),
    },
    ...options,
  });
}

/** Put a removed lead back — the Undo of its "removed" toast; silent on success. */
export function useRestoreLead(options: CrudMutationOptions<LeadRecord, string> = {}) {
  return useAppMutation<LeadRecord, string>({
    mutationFn: (id, action) => restoreLead(id, action.idempotencyKey),
    invalidateKeys: [leadQueryKeys.all],
    ...options,
  });
}
