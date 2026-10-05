import { keepPreviousData, useQueryClient } from '@tanstack/react-query';

import i18n from '@/lib/i18n/i18n.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import { isCommandSearchQuery } from '@/shared/api/clinic/command-search-api.ts';
import {
  assignLead,
  claimLead,
  convertLead,
  countOpenLeadTasks,
  countUnrepliedLeads,
  createLead,
  deleteLead,
  fetchLead,
  fetchLeadViewer,
  type LeadConversion,
  leadQueryKeys,
  type LeadSave,
  listLeads,
  markLeadRead,
  releaseLead,
  restoreLead,
  restoreLeadTeam,
  saveLead,
  searchLeadContacts,
  setLeadInvolved,
  undoLeadChange,
} from '@/shared/api/clinic/leads-api.ts';
import type {
  LeadContactHit,
  LeadCreateInput,
  LeadListParams,
  LeadPatch,
  LeadRecord,
  LeadTeam,
} from '@/shared/api/clinic/leads-contracts.ts';
import { messageQueryKeys } from '@/shared/api/clinic/messages-api.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import {
  type CrudMutationOptions,
  withUndoToast,
} from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedValue/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

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

/** The Undo write behind a claim's, an assignment's or a release's toast; silent unless it fails. */
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
 * new ones load the previous rows stay on screen (`isRefreshing`). A failed
 * page keeps the last rows and says so (`useListLoadError`, KICKOFF §6.0 List
 * error).
 */
export function useLeadList(
  params: LeadListParams,
  options: {
    /** Read only once the params are known — "Mine" waits for the viewer. */
    enabled?: boolean;
  } = {},
) {
  const list = useCursorList<LeadRecord>({
    queryKey: leadQueryKeys.list(params),
    queryFn: async (after) => {
      const page = await listLeads(params, after ?? null);
      return {
        rows: page.items,
        next: page.nextCursor,
        hasMore: page.nextCursor !== null,
      };
    },
    notifyOnError: false,
    ...(options.enabled === undefined ? {} : { enabled: options.enabled }),
  });
  useListLoadError(list, 'leads');
  return list;
}

/** A lead's open tasks — the drawer's Info count; idle without an id. */
export function useOpenLeadTasks(id: string | undefined) {
  return useAppQuery({
    queryKey: leadQueryKeys.openTasks(id ?? ''),
    queryFn: () => countOpenLeadTasks(id ?? ''),
    enabled: id !== undefined,
  });
}

/**
 * The signed-in member as the Leads room reads them (`fetchLeadViewer`): the
 * owner "Mine" and "Unreplied" mean, the claimer, the releaser. `null` until
 * known.
 */
export function useLeadViewer() {
  const email = useAuthStore((state) => state.user?.email ?? null);
  return useAppQuery({
    queryKey: leadQueryKeys.viewer(email),
    queryFn: () => fetchLeadViewer(email),
    staleTime: 5 * 60_000,
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

/** New lead's search waits this long after the last keystroke (as ⌘K's, KICKOFF §6.0 Timers). */
const CONTACT_SEARCH_DEBOUNCE_MS = 250;

/** New lead's contact search as the drawer reads it. */
export interface LeadContactSearch {
  /** The people for the query as typed — or, while it loads, for the last one asked. */
  hits: readonly LeadContactHit[];
  /** The query as typed has its answer and it is empty: "No existing match". */
  noMatch: boolean;
}

/**
 * New lead's contact search (`searchLeadContacts`): debounced 250ms, from two
 * characters, up to five people; the previous answer stays up while the next
 * one loads.
 */
export function useLeadContactSearch(query: string): LeadContactSearch {
  const typed = query.trim();
  const { debounced, isPending } = useDebouncedSearch(typed, CONTACT_SEARCH_DEBOUNCE_MS);
  const live = isCommandSearchQuery(typed);
  const search = useAppQuery({
    queryKey: leadQueryKeys.contactSearch(debounced.toLowerCase()),
    queryFn: () => searchLeadContacts(debounced),
    enabled: isCommandSearchQuery(debounced),
    placeholderData: keepPreviousData,
  });
  const hits = live ? (search.data ?? []) : [];
  const settled = live && !isPending && debounced === typed && !search.isPlaceholderData;
  return { hits, noMatch: settled && search.isSuccess && hits.length === 0 };
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
}

/**
 * Save a lead from its drawer (`saveLead`) — not optimistic. "Lead saved", or
 * "<name> → <status>" with Undo when the status moved (" · follow-up task for
 * tomorrow" after Follow-up); Undo reverses the status and its side effects
 * together (KICKOFF §6.3 Save, §7.3).
 */
export function useUpdateLead(
  options: CrudMutationOptions<LeadSave, LeadUpdateVars> = {},
) {
  const undo = useUndoLeadChange();
  return useAppMutation<LeadSave, LeadUpdateVars>({
    mutationFn: ({ id, patch, viewerId }) => saveLead(id, patch, viewerId ?? null),
    invalidateKeys: [leadQueryKeys.all, taskQueryKeys.all, messageQueryKeys.all],
    ...withUndoToast(options, ({ lead, undoToken, statusMoved, followUpTask }) => {
      if (!(statusMoved && lead.status)) {
        notify.success(leadToast(LEAD_TOASTS_KEYS.saved));
        return;
      }
      const status = i18n.t(CLINIC_KEYS.leads.statuses[lead.status], { ns: CLINIC_NS });
      const message = leadToast(LEAD_TOASTS_KEYS.statusChanged, {
        name: lead.name,
        status,
      });
      notify.undo(
        followUpTask ? `${message}${leadToast(LEAD_TOASTS_KEYS.followUpTask)}` : message,
        { onUndo: () => undo.mutate(undoToken) },
      );
    }),
  });
}

/** Undo a drawer save or a conversion (`undoLeadChange`) — silent; the lists refetch. */
function useUndoLeadChange() {
  return useAppMutation<void, string>({
    mutationFn: undoLeadChange,
    invalidateKeys: [leadQueryKeys.all, taskQueryKeys.all, messageQueryKeys.all],
  });
}

/** What a conversion sends. */
export interface LeadConvertVars {
  id: string;
  /** The person's name for the toast. */
  name: string;
}

/**
 * "Convert to patient" — "Patient record created for <name> · lead stays
 * linked" with Undo, which removes the patient and puts the lead back.
 */
export function useConvertLead(
  options: CrudMutationOptions<LeadConversion, LeadConvertVars> = {},
) {
  const undo = useUndoLeadChange();
  return useAppMutation<LeadConversion, LeadConvertVars>({
    mutationFn: ({ id }) => convertLead(id),
    invalidateKeys: [leadQueryKeys.all, patientQueryKeys.all, messageQueryKeys.all],
    ...withUndoToast(options, ({ undoToken }, { name }) => {
      notify.undo(leadToast(LEAD_TOASTS_KEYS.converted, { name }), {
        onUndo: () => undo.mutate(undoToken),
      });
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
  /** The drawer's own words ("Claimed by <me> after <n> idle days …"), still with Undo. */
  message?: string;
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
    ...withUndoToast(options, (_claimed, { lead, ownerName, message: given }) => {
      const fallback = ownerName
        ? leadToast(LEAD_TOASTS_KEYS.claimed, { name: lead.name, owner: ownerName })
        : leadToast(LEAD_TOASTS_KEYS.claimedUnowned, { name: lead.name });
      const message = given ?? fallback;
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
    // The chat shows the assignment's system line (H:5705) at once.
    invalidateKeys: [leadQueryKeys.all, messageQueryKeys.all],
    ...withUndoToast(options, (_assigned, { lead, ownerName }) => {
      notify.undo(leadToast(LEAD_TOASTS_KEYS.assigned, { name: ownerName }), {
        onUndo: () => restoreTeam.mutate({ id: lead.id, team: teamOf(lead) }),
      });
    }),
  });
}

/** What a release sends. */
export interface LeadReleaseVars {
  /** The lead as the row shows it — its team is what Undo puts back. */
  lead: LeadRecord;
  /** The signed-in member's staff id — only the owner may release. */
  viewerId: string;
}

/**
 * Release a lead to the team — "Released to the team · anyone can claim" with
 * Undo for 10s, which puts the team back (L-64), as a claim's and an
 * assignment's do.
 */
export function useReleaseLead(
  options: CrudMutationOptions<LeadRecord, LeadReleaseVars> = {},
) {
  const restoreTeam = useRestoreLeadTeam();
  return useAppMutation<LeadRecord, LeadReleaseVars>({
    mutationFn: ({ lead, viewerId }) => releaseLead(lead.id, viewerId),
    invalidateKeys: [leadQueryKeys.all],
    ...withUndoToast(options, (_released, { lead }) => {
      notify.undo(leadToast(LEAD_TOASTS_KEYS.released), {
        onUndo: () => restoreTeam.mutate({ id: lead.id, team: teamOf(lead) }),
      });
    }),
  });
}

/** What an involved change sends: the new list. */
export interface LeadInvolvedVars {
  id: string;
  involvedIds: readonly string[];
}

/**
 * Add or remove someone involved — the people popover's toggle; applies at
 * once. Its feedback is the chat's system line ("Added <name> as involved",
 * H:5707), so the thread is read again; no toast.
 */
export function useSetLeadInvolved() {
  return useAppMutation<LeadRecord, LeadInvolvedVars>({
    mutationFn: ({ id, involvedIds }) => setLeadInvolved(id, involvedIds),
    invalidateKeys: [leadQueryKeys.all, messageQueryKeys.all],
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
