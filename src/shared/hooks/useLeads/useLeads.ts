import { useQueryClient } from '@tanstack/react-query';

import i18n from '@/lib/i18n/i18n.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { DeleteReason, LeadStatus } from '@/shared/api/clinic/clinic-schema.ts';
import {
  assignLead,
  claimLead,
  countUnrepliedLeads,
  createLead,
  deleteLead,
  fetchLead,
  leadQueryKeys,
  listLeads,
  markLeadRead,
  releaseLead,
  restoreLead,
  restoreLeadTeam,
  updateLead,
} from '@/shared/api/clinic/leads-api.ts';
import type {
  LeadCreateInput,
  LeadListParams,
  LeadPatch,
  LeadRecord,
  LeadTeam,
} from '@/shared/api/clinic/leads-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { LEAD_TOASTS_KEYS, LEAD_TOASTS_NS } from './leads-toasts.constants.ts';

/** A toast in the Leads room's vocabulary. */
function leadToast(key: string, values: Record<string, string> = {}): string {
  return i18n.t(key, { ns: LEAD_TOASTS_NS, ...values });
}

/** A lead's team as it stands — what a claim's or an assignment's Undo puts back. */
function teamOf(lead: LeadRecord): LeadTeam {
  return {
    ownerId: lead.ownerId,
    involvedIds: lead.involvedIds,
    touchedAt: lead.touchedAt,
    releasedAt: lead.releasedAt,
  };
}

/**
 * The success side of a write that offers Undo: its own toast unless the
 * caller brings a `successMessage` (shown instead, without Undo); the caller's
 * `onSuccess` runs either way.
 */
function withUndoToast<TData, TVars>(
  options: CrudMutationOptions<TData, TVars>,
  toast: (data: TData, vars: TVars) => void,
): CrudMutationOptions<TData, TVars> {
  return {
    ...options,
    onSuccess: async (data, vars) => {
      if (options.successMessage === undefined) toast(data, vars);
      await options.onSuccess?.(data, vars);
    },
  };
}

/** The Undo write behind a claim's or an assignment's toast; silent unless it fails. */
function useRestoreLeadTeam() {
  return useAppMutation<LeadRecord, { id: string; team: LeadTeam }>({
    mutationFn: ({ id, team }) => restoreLeadTeam(id, team),
    invalidateKeys: [leadQueryKeys.all],
  });
}

// ── Reads ──

/**
 * The pipeline, a cursor page of 50 at a time (D7, `S:1588`) — the Leads list's
 * infinite scroll. The params come from the URL (`leadListParamsOf`); while
 * new ones load the previous rows stay on screen (`isRefreshing`).
 */
export function useLeadList(params: LeadListParams) {
  return useCursorList<LeadRecord>({
    queryKey: leadQueryKeys.list(params),
    queryFn: async (after) => {
      const page = await listLeads(params, after ?? null);
      return {
        rows: page.items,
        next: page.nextCursor,
        hasMore: page.nextCursor !== null,
      };
    },
  });
}

/** One lead by id; idle while there is no id. A deleted, unknown or contact-thread id fails with a 404. */
export function useLead(id: string | undefined) {
  return useAppQuery({
    queryKey: leadQueryKeys.detail(id ?? ''),
    queryFn: () => fetchLead(id ?? ''),
    enabled: Boolean(id),
  });
}

/** The Unreplied tab's count chip: the viewer's leads with unread messages; idle without a viewer. */
export function useUnrepliedLeadCount(viewerId: string | null) {
  return useAppQuery({
    queryKey: leadQueryKeys.unreplied(viewerId),
    queryFn: () => countUnrepliedLeads(viewerId),
    enabled: viewerId !== null,
  });
}

// ── Writes ──

/**
 * Create a lead — not optimistic (the drawer shows "Saving…"); on success
 * "Lead #2386 created" and the list refetches with the new lead first (D28).
 */
export function useCreateLead(
  options: CrudMutationOptions<LeadRecord, LeadCreateInput> = {},
) {
  return useAppMutation<LeadRecord, LeadCreateInput>({
    mutationFn: createLead,
    invalidateKeys: [leadQueryKeys.all],
    successMessage: (lead) =>
      leadToast(LEAD_TOASTS_KEYS.created, { id: displayId.lead(lead.seq) }),
    ...options,
  });
}

/** What a lead save sends. */
export interface LeadUpdateVars {
  id: string;
  patch: LeadPatch;
  /** The signed-in member's staff id: a save by the owner counts as their activity (Q-L9). */
  viewerId?: string | null;
  /** The status the drawer opened with — when the save moves it, the toast names the move and offers Undo. */
  previousStatus?: LeadStatus | null;
}

/**
 * Save a lead — not optimistic. "Lead saved", or "<name> → <status>" with
 * Undo when the status moved (Undo puts the status back). The status's side
 * effects, and their undoing, are the lead drawer's (KICKOFF §6.3, L-34b).
 */
export function useUpdateLead(
  options: CrudMutationOptions<LeadRecord, LeadUpdateVars> = {},
) {
  const revert = useAppMutation<LeadRecord, { id: string; status: LeadStatus }>({
    mutationFn: ({ id, status }) => updateLead(id, { status }),
    invalidateKeys: [leadQueryKeys.all],
  });
  return useAppMutation<LeadRecord, LeadUpdateVars>({
    mutationFn: ({ id, patch, viewerId }) => updateLead(id, patch, viewerId ?? null),
    invalidateKeys: [leadQueryKeys.all],
    ...withUndoToast(options, (lead, { previousStatus }) => {
      if (!(previousStatus && lead.status) || lead.status === previousStatus) {
        notify.success(leadToast(LEAD_TOASTS_KEYS.saved));
        return;
      }
      const status = i18n.t(CLINIC_KEYS.leads.statuses[lead.status], { ns: CLINIC_NS });
      notify.undo(
        leadToast(LEAD_TOASTS_KEYS.statusChanged, { name: lead.name, status }),
        {
          onUndo: () => revert.mutate({ id: lead.id, status: previousStatus }),
        },
      );
    }),
  });
}

/** What a claim sends. */
export interface LeadClaimVars {
  /** The lead as the row shows it — its team is what Undo puts back. */
  lead: LeadRecord;
  /** The signed-in member's staff id: they become the owner. */
  viewerId: string;
  /** The previous owner's name for the toast; `null` when nobody held it. */
  ownerName: string | null;
}

/**
 * Claim a lead — "Open · Claim" from the row: "You now own <name> · <owner>
 * stays involved" with Undo, which puts the team back. The drawer's claim
 * says its own ("Claimed by <me> after <n> idle days …") through `successMessage`.
 */
export function useClaimLead(
  options: CrudMutationOptions<LeadRecord, LeadClaimVars> = {},
) {
  const restoreTeam = useRestoreLeadTeam();
  return useAppMutation<LeadRecord, LeadClaimVars>({
    mutationFn: ({ lead, viewerId }) => claimLead(lead.id, viewerId),
    invalidateKeys: [leadQueryKeys.all],
    ...withUndoToast(options, (_claimed, { lead, ownerName }) => {
      const message = ownerName
        ? leadToast(LEAD_TOASTS_KEYS.claimed, { name: lead.name, owner: ownerName })
        : leadToast(LEAD_TOASTS_KEYS.claimedUnowned, { name: lead.name });
      notify.undo(message, {
        onUndo: () => restoreTeam.mutate({ id: lead.id, team: teamOf(lead) }),
      });
    }),
  });
}

/** What an assignment sends. */
export interface LeadAssignVars {
  /** The lead as the drawer shows it — its team is what Undo puts back. */
  lead: LeadRecord;
  ownerId: string;
  /** The new owner's name for the toast. */
  ownerName: string;
}

/**
 * Assign a lead — "<name> is now assigned · notified" with Undo; the previous
 * owner stays involved. Who may assign whom is the people popover's rule.
 */
export function useAssignLead(
  options: CrudMutationOptions<LeadRecord, LeadAssignVars> = {},
) {
  const restoreTeam = useRestoreLeadTeam();
  return useAppMutation<LeadRecord, LeadAssignVars>({
    mutationFn: ({ lead, ownerId }) => assignLead(lead.id, ownerId),
    invalidateKeys: [leadQueryKeys.all],
    ...withUndoToast(options, (_assigned, { lead, ownerName }) => {
      notify.undo(leadToast(LEAD_TOASTS_KEYS.assigned, { name: ownerName }), {
        onUndo: () => restoreTeam.mutate({ id: lead.id, team: teamOf(lead) }),
      });
    }),
  });
}

/** What a release sends. */
export interface LeadReleaseVars {
  id: string;
  /** The signed-in member's staff id — only the owner may release. */
  viewerId: string;
}

/** Release a lead to the team — "Released to the team · anyone can claim". */
export function useReleaseLead(
  options: CrudMutationOptions<LeadRecord, LeadReleaseVars> = {},
) {
  return useAppMutation<LeadRecord, LeadReleaseVars>({
    mutationFn: ({ id, viewerId }) => releaseLead(id, viewerId),
    invalidateKeys: [leadQueryKeys.all],
    successMessage: () => leadToast(LEAD_TOASTS_KEYS.released),
    ...options,
  });
}

/**
 * Mark a lead read — opening it from the list. Optimistic on the cached
 * lists (the name drops from 600 to 500 at once) and silent: a failed receipt
 * rolls back without a toast. The Unreplied count refetches; the open lead's
 * cached record takes the result.
 */
export function useMarkLeadRead() {
  const queryClient = useQueryClient();
  return useAppMutation<LeadRecord, string, unknown, LeadRecord>({
    mutationFn: markLeadRead,
    invalidateKeys: [leadQueryKeys.unrepliedCounts()],
    notifyOnError: false,
    optimisticInfinite: {
      queryKey: leadQueryKeys.lists(),
      update: (rows, id) =>
        rows.map((lead) => (lead.id === id ? { ...lead, unreadCount: 0 } : lead)),
    },
    onSuccess: (lead) => {
      queryClient.setQueryData(leadQueryKeys.detail(lead.id), lead);
    },
  });
}

/** What a confirmed lead delete sends: the record and the Reason confirm's choice. */
export interface LeadDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Remove a lead (`S:1546`) — optimistic: the row leaves every cached list page
 * at once and comes back if the write fails. No toast of its own: the Reason
 * confirm's `reason.undo` shows "Lead #<seq> removed · <reason>" with Undo,
 * which runs {@link useRestoreLead}.
 */
export function useDeleteLead(
  options: CrudMutationOptions<LeadRecord, LeadDeleteVars> = {},
) {
  return useAppMutation<LeadRecord, LeadDeleteVars, unknown, LeadRecord>({
    mutationFn: ({ id, reason, note }) => deleteLead(id, reason, note),
    invalidateKeys: [leadQueryKeys.all],
    optimisticInfinite: {
      queryKey: leadQueryKeys.lists(),
      update: (rows, { id }) => rows.filter((lead) => lead.id !== id),
    },
    ...options,
  });
}

/** Put a removed lead back — the Undo of its "removed" toast (10s, D32); silent on success. */
export function useRestoreLead(options: CrudMutationOptions<LeadRecord, string> = {}) {
  return useAppMutation<LeadRecord, string>({
    mutationFn: restoreLead,
    invalidateKeys: [leadQueryKeys.all],
    ...options,
  });
}
