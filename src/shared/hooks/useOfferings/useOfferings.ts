import i18n from '@/lib/i18n/i18n.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import {
  createOffering,
  deleteOffering,
  fetchAllOfferings,
  fetchOffering,
  offeringQueryKeys,
  restoreOffering,
  updateOffering,
} from '@/shared/api/clinic/offerings-api.ts';
import type {
  OfferingCreateInput,
  OfferingPatch,
  OfferingRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/** "Offering #275 created" and its kin — the offering's display id in the clinic vocabulary. */
function offeringToast(key: string, offering: OfferingRecord): string {
  return i18n.t(key, { ns: CLINIC_NS, id: displayId.offering(offering.seq) });
}

/** How a catalogue read reports its own failure. */
export interface CatalogueReadOptions {
  /**
   * Toast a failed read (default true). The Offerings room passes `false`: it
   * shows the list error itself — the last copy and a Retry (KICKOFF §6.0).
   */
  notifyOnError?: boolean;
}

/**
 * The whole offerings catalogue, every cursor page (KICKOFF §6.11 Lists): the
 * Offerings room, the Invoice drawer and the booking drawer share this one
 * cache entry and search, filter and sort it in place. Prices come from
 * `effectivePrice` over {@link useOffers}' offers.
 */
export function useOfferings({ notifyOnError = true }: CatalogueReadOptions = {}) {
  return useAppQuery({
    queryKey: offeringQueryKeys.list(),
    queryFn: () => fetchAllOfferings(),
    notifyOnError,
  });
}

/** One offering by id; idle while there is no id. A deleted or unknown id fails with a 404. */
export function useOffering(id: string | undefined) {
  return useAppQuery({
    queryKey: offeringQueryKeys.detail(id ?? ''),
    queryFn: () => fetchOffering(id ?? ''),
    enabled: Boolean(id),
  });
}

/**
 * Create an offering — not optimistic (the drawer shows "Saving…"); on success
 * "Offering #275 created" and the catalogue refetches, the new row first by
 * newest id (D28). The stacked "New offering" passes its own `successMessage`.
 */
export function useCreateOffering(
  options: CrudMutationOptions<OfferingRecord, OfferingCreateInput> = {},
) {
  return useAppMutation<OfferingRecord, OfferingCreateInput>({
    mutationFn: createOffering,
    invalidateKeys: [offeringQueryKeys.all],
    successMessage: (offering) =>
      offeringToast(CLINIC_KEYS.offerings.toasts.offeringCreated, offering),
    ...options,
  });
}

/** What an offering update sends: the record and the changed fields. */
export interface OfferingUpdateVars {
  id: string;
  patch: OfferingPatch;
}

/** Save an offering's changes — not optimistic; on success "Offering #273 saved". */
export function useUpdateOffering(
  options: CrudMutationOptions<OfferingRecord, OfferingUpdateVars> = {},
) {
  return useAppMutation<OfferingRecord, OfferingUpdateVars>({
    mutationFn: ({ id, patch }) => updateOffering(id, patch),
    invalidateKeys: [offeringQueryKeys.all],
    successMessage: (offering) =>
      offeringToast(CLINIC_KEYS.offerings.toasts.offeringSaved, offering),
    ...options,
  });
}

/** What a confirmed offering delete sends: the record and the Reason confirm's choice. */
export interface OfferingDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Soft-delete an offering (`S:1546`) — optimistic: the row leaves the
 * catalogue at once and comes back if the write fails. It raises no toast of
 * its own: the Reason confirm's `reason.undo` shows "Offering #272 removed"
 * (`CLINIC_KEYS.offerings.toasts.offeringRemoved`) with Undo, which runs
 * {@link useRestoreOffering}.
 */
export function useDeleteOffering(
  options: CrudMutationOptions<OfferingRecord, OfferingDeleteVars> = {},
) {
  return useAppMutation<OfferingRecord, OfferingDeleteVars, OfferingRecord[]>({
    mutationFn: ({ id, reason, note }) => deleteOffering(id, reason, note),
    invalidateKeys: [offeringQueryKeys.all],
    optimistic: {
      queryKey: offeringQueryKeys.list(),
      update: (previous, { id }) => previous?.filter((offering) => offering.id !== id),
    },
    ...options,
  });
}

/** Put a deleted offering back — the Undo of its "removed" toast (10s, D32); silent on success. */
export function useRestoreOffering(
  options: CrudMutationOptions<OfferingRecord, string> = {},
) {
  return useAppMutation<OfferingRecord, string>({
    mutationFn: restoreOffering,
    invalidateKeys: [offeringQueryKeys.all],
    ...options,
  });
}
