import i18n from '@/lib/i18n/i18n.ts';
import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import {
  createOffer,
  deleteOffer,
  fetchAllOffers,
  fetchOffer,
  offerQueryKeys,
  restoreOffer,
  setOfferPaused,
  updateOffer,
} from '@/shared/api/clinic/offerings-api.ts';
import type {
  OfferCreateInput,
  OfferPatch,
  OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import type { CatalogueReadOptions } from '@/shared/hooks/useOfferings/index.ts';

/** "Navratri glow saved" and its kin — the offer's name in the clinic vocabulary. */
function offerToast(key: string, offer: OfferRecord): string {
  return i18n.t(key, { ns: CLINIC_NS, name: offer.name });
}

/**
 * Every offer, every cursor page (KICKOFF §6.11 Lists) — the Offers tab and
 * every billed price (`effectivePrice`) read this one cache entry. Their state
 * is derived on the clinic's today (`offerState`), never stored.
 */
export function useOffers({ notifyOnError = true }: CatalogueReadOptions = {}) {
  return useAppQuery({
    queryKey: offerQueryKeys.list(),
    queryFn: () => fetchAllOffers(),
    notifyOnError,
  });
}

/** One offer by id; idle while there is no id. A deleted or unknown id fails with a 404. */
export function useOffer(id: string | undefined) {
  return useAppQuery({
    queryKey: offerQueryKeys.detail(id ?? ''),
    queryFn: () => fetchOffer(id ?? ''),
    enabled: Boolean(id),
  });
}

/** Create an offer — not optimistic; on success "<name> created · applies automatically". */
export function useCreateOffer(
  options: CrudMutationOptions<OfferRecord, OfferCreateInput> = {},
) {
  return useAppMutation<OfferRecord, OfferCreateInput>({
    mutationFn: createOffer,
    invalidateKeys: [offerQueryKeys.all],
    successMessage: (offer) =>
      offerToast(CLINIC_KEYS.offerings.toasts.offerCreated, offer),
    ...options,
  });
}

/** What an offer update sends: the record and the changed fields. */
export interface OfferUpdateVars {
  id: string;
  patch: OfferPatch;
}

/** Save an offer's changes — not optimistic; on success "<name> saved". */
export function useUpdateOffer(
  options: CrudMutationOptions<OfferRecord, OfferUpdateVars> = {},
) {
  return useAppMutation<OfferRecord, OfferUpdateVars>({
    mutationFn: ({ id, patch }) => updateOffer(id, patch),
    invalidateKeys: [offerQueryKeys.all],
    successMessage: (offer) => offerToast(CLINIC_KEYS.offerings.toasts.offerSaved, offer),
    ...options,
  });
}

/** What a row's Pause / Resume sends. */
export interface OfferPauseVars {
  id: string;
  paused: boolean;
}

/**
 * Pause or resume an offer from its row (H:5483) — optimistic: the status pill
 * and every price it touched flip at once and flip back if the write fails;
 * then "Navratri glow paused" / "Navratri glow running again". One toast id,
 * so quick toggles replace rather than stack.
 */
export function useSetOfferPaused(
  options: CrudMutationOptions<OfferRecord, OfferPauseVars> = {},
) {
  return useAppMutation<OfferRecord, OfferPauseVars, OfferRecord[]>({
    mutationFn: ({ id, paused }) => setOfferPaused(id, paused),
    invalidateKeys: [offerQueryKeys.all],
    optimistic: {
      queryKey: offerQueryKeys.list(),
      update: (previous, { id, paused }) =>
        previous?.map((offer) => (offer.id === id ? { ...offer, paused } : offer)),
    },
    successMessage: (offer) =>
      offerToast(
        offer.paused
          ? CLINIC_KEYS.offerings.toasts.offerPaused
          : CLINIC_KEYS.offerings.toasts.offerResumed,
        offer,
      ),
    toastId: 'clinic-offer-paused',
    ...options,
  });
}

/** What a confirmed offer delete sends: the record and the Reason confirm's choice. */
export interface OfferDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Soft-delete an offer (`S:1546`) — optimistic: the row leaves at once and
 * comes back if the write fails. No toast of its own: the Reason confirm's
 * `reason.undo` shows "Navratri glow removed"
 * (`CLINIC_KEYS.offerings.toasts.offerRemoved`) with Undo, which runs
 * {@link useRestoreOffer}.
 */
export function useDeleteOffer(
  options: CrudMutationOptions<OfferRecord, OfferDeleteVars> = {},
) {
  return useAppMutation<OfferRecord, OfferDeleteVars, OfferRecord[]>({
    mutationFn: ({ id, reason, note }) => deleteOffer(id, reason, note),
    invalidateKeys: [offerQueryKeys.all],
    optimistic: {
      queryKey: offerQueryKeys.list(),
      update: (previous, { id }) => previous?.filter((offer) => offer.id !== id),
    },
    ...options,
  });
}

/** Put a deleted offer back — the Undo of its "removed" toast (10s, D32); silent on success. */
export function useRestoreOffer(options: CrudMutationOptions<OfferRecord, string> = {}) {
  return useAppMutation<OfferRecord, string>({
    mutationFn: restoreOffer,
    invalidateKeys: [offerQueryKeys.all],
    ...options,
  });
}
