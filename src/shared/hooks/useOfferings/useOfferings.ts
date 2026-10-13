import i18n from '@/lib/i18n/i18n.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { DeleteReason, OfferingSpecialty } from '@/shared/api/app/app-schema.ts';
import {
  createOffering,
  deleteOffering,
  fetchAllOfferings,
  fetchOffering,
  offeringQueryKeys,
  offerQueryKeys,
  restoreOffering,
  updateOffering,
} from '@/shared/api/app/offerings-api.ts';
import type {
  OfferingFields,
  OfferingRecord,
} from '@/shared/api/app/offerings-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import {
  useOrganizationId,
  useOrganizationStore,
} from '@/shared/store/useOrganizationStore/index.ts';

/**
 * Whether the member may set an offering's lowest price — their own `offering:lower_price:read`.
 * Without it a write never names `min_price`: the field reads empty for them, and sent blind it
 * would wipe the floor (or answer 403 `field_permission_required`, D81).
 */
const useCanSetLowestPrice = () =>
  useOrganizationStore((state) =>
    state.permissions.includes('offering:lower_price:read'),
  );

/** "Offering #275 created" and its kin — the offering's display id in the clinic vocabulary. */
function offeringToast(key: string, offering: OfferingRecord): string {
  return i18n.t(key, { ns: APP_NS, id: displayId.offering(offering.offeringNumber) });
}

/** How a catalogue read reports its own failure, and what a room makes of the catalogue. */
export interface CatalogueReadOptions<TData = OfferingRecord[]> {
  /**
   * Toast a failed read (default true). The Offerings room passes `false`: it
   * shows the list error itself — the last copy and a Retry (KICKOFF §6.0).
   */
  notifyOnError?: boolean;
  /** Read at all (default true) — and only ever with an organization. */
  enabled?: boolean;
  /** How long this reader takes the cached copy as fresh (TanStack's `staleTime`). */
  staleTime?: number;
  /**
   * The room's own shape of the catalogue — "From offerings", a check-in's offerings, the plan
   * card's. A module-level function, so TanStack keeps its answer until the catalogue changes.
   */
  select?: (catalogue: OfferingRecord[]) => TData;
}

// ── Reads ──

/**
 * The whole offerings catalogue, active or not, every page (`GET /app/offerings`): the
 * Offerings room and every room that names an offering (the appointment form's treatments, a
 * check-in's offerings, the plan card) share this one cache entry — each `select`s its own
 * shape, and the Offerings room's writes refresh them all. Prices billed today come from
 * `effectivePrice` over {@link useOffers}' offers.
 */
export function useOfferings<TData = OfferingRecord[]>({
  notifyOnError = true,
  enabled = true,
  staleTime,
  select,
}: CatalogueReadOptions<TData> = {}) {
  const organizationId = useOrganizationId();
  return useAppQuery<OfferingRecord[], Error, TData>({
    queryKey: offeringQueryKeys.list(organizationId),
    queryFn: fetchAllOfferings,
    notifyOnError,
    enabled: enabled && organizationId !== null,
    // Only a reader that names its own: an explicit `undefined` would drop the app's default.
    ...(staleTime === undefined ? {} : { staleTime }),
    select,
  });
}

/** One offering by id; idle while there is no id. A deleted or unknown id fails (404 / 400). */
export function useOffering(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: offeringQueryKeys.detail(organizationId, id ?? ''),
    queryFn: () => fetchOffering(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
  });
}

// ── Writes ──

/** What a create sends: the drawer's fields. */
export interface OfferingCreateVars {
  fields: OfferingFields;
  /** The offering's specialty when not the clinic's first — a setup starter row's (D18). */
  specialty?: OfferingSpecialty;
}

/**
 * Create an offering — not optimistic (the drawer shows "Saving…"); on success "Offering #275
 * created" and the catalogue refetches, the new row first (D28). A taken name is `409
 * offering_name_taken` (`isOfferingNameTaken`).
 */
export function useCreateOffering(
  options: CrudMutationOptions<OfferingRecord, OfferingCreateVars> = {},
) {
  const canSetLowestPrice = useCanSetLowestPrice();
  return useAppMutation<OfferingRecord, OfferingCreateVars>({
    mutationFn: ({ fields, specialty }, action) =>
      createOffering({ fields, canSetLowestPrice, specialty, ...action }),
    invalidateKeys: [offeringQueryKeys.all],
    successMessage: (offering) =>
      offeringToast(APP_KEYS.offerings.toasts.offeringCreated, offering),
    ...options,
  });
}

/** What an offering save sends: the record as read and the drawer's fields. */
export interface OfferingUpdateVars {
  record: OfferingRecord;
  fields: OfferingFields;
}

/**
 * Save an offering's changes — only what changed, refused when someone saved it meanwhile
 * (`409 record_changed`); not optimistic; on success "Offering #273 saved".
 */
export function useUpdateOffering(
  options: CrudMutationOptions<OfferingRecord, OfferingUpdateVars> = {},
) {
  const canSetLowestPrice = useCanSetLowestPrice();
  return useAppMutation<OfferingRecord, OfferingUpdateVars>({
    mutationFn: ({ record, fields }, action) =>
      updateOffering({ record, fields, canSetLowestPrice, ...action }),
    invalidateKeys: [offeringQueryKeys.all],
    successMessage: (offering) =>
      offeringToast(APP_KEYS.offerings.toasts.offeringSaved, offering),
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
 * Delete an offering (`S:1546`) — optimistic: the row leaves the catalogue at once and comes
 * back if the write fails. The catalogue and the offers refresh (the offers stop naming it,
 * OFFERINGS-M4) — not the offering's own read, which would answer 404 while its drawer closes.
 * No toast of its own: the Reason confirm's `reason.undo` shows "Offering #272 removed"
 * (`APP_KEYS.offerings.toasts.offeringRemoved`) with Undo, which runs
 * {@link useRestoreOffering}.
 */
export function useDeleteOffering(
  options: CrudMutationOptions<void, OfferingDeleteVars> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, OfferingDeleteVars, OfferingRecord[]>({
    mutationFn: ({ id, reason, note }) =>
      deleteOffering({ offeringId: id, reason, note }),
    invalidateKeys: [offeringQueryKeys.list(organizationId), offerQueryKeys.all],
    optimistic: {
      queryKey: offeringQueryKeys.list(organizationId),
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
    mutationFn: (id, action) => restoreOffering(id, action.idempotencyKey),
    invalidateKeys: [offeringQueryKeys.all, offerQueryKeys.all],
    ...options,
  });
}
