import { useQueryClient } from '@tanstack/react-query';

import i18n from '@/lib/i18n/i18n.ts';
import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import {
  createOffer,
  deleteOffer,
  fetchAllOffers,
  fetchOffer,
  offerQueryKeys,
  restoreOffer,
  setOfferActive,
  updateOffer,
} from '@/shared/api/clinic/offerings-api.ts';
import type {
  OfferFields,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import type { CatalogueReadOptions } from '@/shared/hooks/useOfferings/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/** "Navratri glow saved" and its kin — the offer's name in the clinic vocabulary. */
function offerToast(key: string, offer: OfferRecord): string {
  return i18n.t(key, { ns: CLINIC_NS, name: offer.name });
}

// ── Reads ──

/**
 * Every offer, in any status, every page (`GET /app/offers`) in the server's order — live,
 * scheduled, paused, ended, newest first in each (O10). The Offers tab and every billed price
 * (`effectivePrice`) read this one cache entry; each offer's `status` is the server's.
 */
export function useOffers({ notifyOnError = true }: CatalogueReadOptions = {}) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: offerQueryKeys.list(organizationId),
    queryFn: fetchAllOffers,
    notifyOnError,
    enabled: organizationId !== null,
  });
}

/** One offer by id; idle while there is no id. A deleted or unknown id fails with a 404. */
export function useOffer(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: offerQueryKeys.detail(organizationId, id ?? ''),
    queryFn: () => fetchOffer(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
  });
}

// ── Writes ──

/** What a create sends: the drawer's fields. */
export interface OfferCreateVars {
  fields: OfferFields;
}

/**
 * Create an offer — not optimistic; on success "<name> created · applies automatically". A
 * taken code is `409 offer_code_in_use` (`isOfferCodeInUse`).
 */
export function useCreateOffer(
  options: CrudMutationOptions<OfferRecord, OfferCreateVars> = {},
) {
  return useAppMutation<OfferRecord, OfferCreateVars>({
    mutationFn: ({ fields }, action) => createOffer({ fields, ...action }),
    invalidateKeys: [offerQueryKeys.all],
    successMessage: (offer) =>
      offerToast(CLINIC_KEYS.offerings.toasts.offerCreated, offer),
    ...options,
  });
}

/** What an offer save sends: the record as read and the drawer's fields. */
export interface OfferUpdateVars {
  record: OfferRecord;
  fields: OfferFields;
}

/**
 * Save an offer's changes — only what changed (the offerings only when the set did,
 * OFFERINGS-M5), refused when someone saved it meanwhile (`409 record_changed`); not
 * optimistic; on success "<name> saved".
 */
export function useUpdateOffer(
  options: CrudMutationOptions<OfferRecord, OfferUpdateVars> = {},
) {
  return useAppMutation<OfferRecord, OfferUpdateVars>({
    mutationFn: ({ record, fields }, action) =>
      updateOffer({ record, fields, ...action }),
    invalidateKeys: [offerQueryKeys.all],
    successMessage: (offer) => offerToast(CLINIC_KEYS.offerings.toasts.offerSaved, offer),
    ...options,
  });
}

/** An offer as a pause or resume leaves it before the answer: paused at once, a resume's status still to come. */
function toggled(offer: OfferRecord, isActive: boolean): OfferRecord {
  return isActive ? { ...offer, isActive } : { ...offer, isActive, status: 'paused' };
}

/** What a row's Pause / Resume sends. */
export interface OfferActiveVars {
  id: string;
  /** False pauses, true resumes. */
  isActive: boolean;
}

/**
 * Pause or resume an offer from its row (H:5483) — optimistic: a pause reads Paused at once
 * (an inactive offer is paused, O10) and flips back if the write fails; a resume takes its
 * status from the answer, which replaces the row. Then "Navratri glow paused" / "Navratri glow
 * running again" — one toast id, so quick toggles replace rather than stack.
 */
export function useSetOfferActive(
  options: CrudMutationOptions<OfferRecord, OfferActiveVars> = {},
) {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  const listKey = offerQueryKeys.list(organizationId);
  const { onSuccess, ...rest } = options;
  return useAppMutation<OfferRecord, OfferActiveVars, OfferRecord[]>({
    mutationFn: ({ id, isActive }, action) =>
      setOfferActive({ offerId: id, isActive, ...action }),
    invalidateKeys: [offerQueryKeys.all],
    optimistic: {
      queryKey: listKey,
      update: (previous, { id, isActive }) =>
        previous?.map((offer) => (offer.id === id ? toggled(offer, isActive) : offer)),
    },
    successMessage: (offer) =>
      offerToast(
        offer.isActive
          ? CLINIC_KEYS.offerings.toasts.offerResumed
          : CLINIC_KEYS.offerings.toasts.offerPaused,
        offer,
      ),
    toastId: 'clinic-offer-paused',
    ...rest,
    onSuccess: async (offer, vars) => {
      queryClient.setQueryData<OfferRecord[]>(listKey, (previous) =>
        previous?.map((row) => (row.id === offer.id ? offer : row)),
      );
      await onSuccess?.(offer, vars);
    },
  });
}

/** What a confirmed offer delete sends: the record and the Reason confirm's choice. */
export interface OfferDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete an offer (`S:1546`) — optimistic: the row leaves at once and comes back if the write
 * fails. The list refreshes — not the offer's own read, which would answer 404 while its
 * drawer closes. No toast of its own: the Reason confirm's `reason.undo` shows "Navratri glow
 * removed" (`CLINIC_KEYS.offerings.toasts.offerRemoved`) with Undo, which runs
 * {@link useRestoreOffer}.
 */
export function useDeleteOffer(options: CrudMutationOptions<void, OfferDeleteVars> = {}) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, OfferDeleteVars, OfferRecord[]>({
    mutationFn: ({ id, reason, note }) => deleteOffer({ offerId: id, reason, note }),
    invalidateKeys: [offerQueryKeys.list(organizationId)],
    optimistic: {
      queryKey: offerQueryKeys.list(organizationId),
      update: (previous, { id }) => previous?.filter((offer) => offer.id !== id),
    },
    ...options,
  });
}

/** Put a deleted offer back — the Undo of its "removed" toast (10s, D32); silent on success. */
export function useRestoreOffer(options: CrudMutationOptions<OfferRecord, string> = {}) {
  return useAppMutation<OfferRecord, string>({
    mutationFn: (id, action) => restoreOffer(id, action.idempotencyKey),
    invalidateKeys: [offerQueryKeys.all],
    ...options,
  });
}
