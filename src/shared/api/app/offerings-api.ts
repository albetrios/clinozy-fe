import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { pageOf } from '@/core/http/pagination.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import type { DeleteReason } from './app-schema.ts';
import {
  clinicSpecialtiesWire,
  type LowestPriceAccess,
  offerChangeOf,
  offerCreateBodyOf,
  type OfferFields,
  offeringChangeOf,
  offeringCreateBodyOf,
  type OfferingFields,
  type OfferingRecord,
  offeringRowWire,
  offeringWire,
  type OfferRecord,
  offerRowWire,
  offerWire,
  toOfferingRecord,
  toOfferRecord,
} from './offerings-contracts.ts';

/*
 * The Offerings domain on clinozy-be (`/app/offerings`, `/app/offers`, api-integration §5.9): the
 * whole catalogue and every offer, each read page by page in the server's order (the offers by
 * status: live, scheduled, paused, ended — newest first in each) and searched, filtered and
 * sorted in place; one of each; create, an edit that sends what changed with its read's
 * `updated_at`, delete with its reason and restore. Every write carries the action's key.
 */

/** TanStack Query keys for the offerings catalogue, each carrying the organization. */
export const offeringQueryKeys = {
  all: ['app', 'offerings'] as const,
  /** The whole catalogue — every room reads it from this one entry. */
  list: (organizationId: string | null) =>
    [...offeringQueryKeys.all, organizationId, 'list'] as const,
  detail: (organizationId: string | null, offeringId: string) =>
    [...offeringQueryKeys.all, organizationId, 'detail', offeringId] as const,
  /** The clinic's specialties — a new offering's default (Q-O6). */
  specialties: (organizationId: string | null) =>
    [...offeringQueryKeys.all, organizationId, 'specialties'] as const,
};

/** TanStack Query keys for the offers, each carrying the organization. */
export const offerQueryKeys = {
  all: ['app', 'offers'] as const,
  /** Every offer — the Offers tab and every price read it from this one entry. */
  list: (organizationId: string | null) =>
    [...offerQueryKeys.all, organizationId, 'list'] as const,
  detail: (organizationId: string | null, offerId: string) =>
    [...offerQueryKeys.all, organizationId, 'detail', offerId] as const,
};

/** The largest page the API serves. */
const PAGE_SIZE = 100;

/** How long the clinic's specialties are kept before a create reads them again. */
const SPECIALTIES_STALE_MS = 5 * 60_000;

const activeOrganizationId = () => useOrganizationStore.getState().organizationId;

// ── Search (the rooms', in place) ──

/** Whether an offering matches a search: its name, its search terms or "#274" (H:5454). */
export function offeringMatchesSearch(
  offering: Pick<OfferingRecord, 'name' | 'searchTerms' | 'offeringNumber'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${offering.name} ${offering.searchTerms.join(' ')} #${offering.offeringNumber}`
    .toLowerCase()
    .includes(needle);
}

/**
 * Whether an offer matches a search: its name, its code or the name of an offering it applies
 * to (H:5476) — the server's `q` reads the first two only, so the room searches in place.
 *
 * @param offeringName An offering's name by id (`undefined` when unknown).
 */
export function offerMatchesSearch(
  offer: Pick<OfferRecord, 'name' | 'code' | 'offeringIds'>,
  query: string,
  offeringName: (id: string) => string | undefined,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const names = offer.offeringIds.map((id) => offeringName(id) ?? '');
  return [offer.name, offer.code ?? '', ...names]
    .join(' ')
    .toLowerCase()
    .includes(needle);
}

// ── Offerings ──

/**
 * Every offering of the clinic, active or not — each page in turn, newest first. The catalogue
 * is tens to a few hundred rows, so the rooms read it whole (KICKOFF §6.11 Lists).
 */
export async function fetchAllOfferings(): Promise<OfferingRecord[]> {
  const rows = await collectAllPages(async (after) => {
    const response = await api.get('/app/offerings', {
      query: { limit: PAGE_SIZE, after: after ?? undefined },
    });
    return {
      rows: z.array(offeringRowWire).parse(response.data ?? []),
      next: pageOf(response.meta?.pagination).next,
    };
  }, 'offerings');
  return rows.map(toOfferingRecord);
}

/** One offering — a 404 when it is gone, a 400 for an id that is no offering's. */
export async function fetchOffering(offeringId: string): Promise<OfferingRecord> {
  const response = await api.get('/app/offerings/{offering_id}', {
    params: { offering_id: offeringId },
  });
  return toOfferingRecord(offeringWire.parse(response.data));
}

/** The clinic's specialties, the first its main one (`GET /tenancy/organization`). */
async function readSpecialties() {
  const response = await api.get('/tenancy/organization');
  return clinicSpecialtiesWire.parse(response.data).specialties;
}

/** The specialty a new offering takes — the clinic's first; `null` lets the server choose. */
async function clinicSpecialty() {
  const specialties = await queryClient.query({
    queryKey: offeringQueryKeys.specialties(activeOrganizationId()),
    queryFn: readSpecialties,
    staleTime: SPECIALTIES_STALE_MS,
  });
  return specialties[0] ?? null;
}

/**
 * A new offering, in the clinic's specialty (Q-O6). The lowest price goes only from a member
 * who may set it. `409 offering_name_taken` when another offering has the name (any case).
 */
export async function createOffering({
  fields,
  canSetLowestPrice,
  idempotencyKey,
}: LowestPriceAccess & {
  fields: OfferingFields;
  idempotencyKey: string;
}): Promise<OfferingRecord> {
  const specialty = await clinicSpecialty();
  const response = await api.post('/app/offerings', {
    body: offeringCreateBodyOf(fields, { canSetLowestPrice, specialty }),
    idempotencyKey,
  });
  return toOfferingRecord(offeringWire.parse(response.data));
}

/**
 * An edit: only what changed, with the read's `updated_at` — `409 record_changed` when someone
 * saved it since, a 400 naming the price that breaks the order (O4). Nothing changed, nothing
 * is sent.
 */
export async function updateOffering({
  record,
  fields,
  canSetLowestPrice,
  idempotencyKey,
}: LowestPriceAccess & {
  record: OfferingRecord;
  fields: OfferingFields;
  idempotencyKey: string;
}): Promise<OfferingRecord> {
  const change = offeringChangeOf(record, fields, { canSetLowestPrice });
  if (!change) return record;
  const response = await api.patch('/app/offerings/{offering_id}', {
    params: { offering_id: record.id },
    body: { ...change, expected_updated_at: record.updatedAt },
    idempotencyKey,
  });
  return toOfferingRecord(offeringWire.parse(response.data));
}

/**
 * Delete an offering with the reason the member picked — restorable. Its offers stop naming it
 * until it is restored (OFFERINGS-M4).
 */
export async function deleteOffering({
  offeringId,
  reason,
  note,
}: {
  offeringId: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/offerings/{offering_id}', {
    params: { offering_id: offeringId },
    reason,
    note: note ?? undefined,
  });
}

/** Bring a deleted offering back — the Undo of its "removed" toast. */
export async function restoreOffering(
  offeringId: string,
  idempotencyKey: string,
): Promise<OfferingRecord> {
  const response = await api.post('/app/offerings/{offering_id}/restore', {
    params: { offering_id: offeringId },
    idempotencyKey,
  });
  return toOfferingRecord(offeringWire.parse(response.data));
}

// ── Offers ──

/**
 * Every offer, in any status — each page in turn, in the server's order: live, scheduled,
 * paused, ended, newest first in each (O10). The offers are few (KICKOFF §6.11 Lists).
 */
export async function fetchAllOffers(): Promise<OfferRecord[]> {
  const rows = await collectAllPages(async (after) => {
    const response = await api.get('/app/offers', {
      query: { limit: PAGE_SIZE, after: after ?? undefined },
    });
    return {
      rows: z.array(offerRowWire).parse(response.data ?? []),
      next: pageOf(response.meta?.pagination).next,
    };
  }, 'offers');
  return rows.map(toOfferRecord);
}

/** One offer — a 404 when it is gone. */
export async function fetchOffer(offerId: string): Promise<OfferRecord> {
  const response = await api.get('/app/offers/{offer_id}', {
    params: { offer_id: offerId },
  });
  return toOfferRecord(offerWire.parse(response.data));
}

/**
 * A new offer. `409 offer_code_in_use` when another live offer uses the code (any case); a 400
 * names an offering that is not active (O12).
 */
export async function createOffer({
  fields,
  idempotencyKey,
}: {
  fields: OfferFields;
  idempotencyKey: string;
}): Promise<OfferRecord> {
  const response = await api.post('/app/offers', {
    body: offerCreateBodyOf(fields),
    idempotencyKey,
  });
  return toOfferRecord(offerWire.parse(response.data));
}

/**
 * An edit: only what changed — the offerings only when the set did (OFFERINGS-M5) — with the
 * read's `updated_at` (`409 record_changed` when someone saved it since). Nothing changed,
 * nothing is sent.
 */
export async function updateOffer({
  record,
  fields,
  idempotencyKey,
}: {
  record: OfferRecord;
  fields: OfferFields;
  idempotencyKey: string;
}): Promise<OfferRecord> {
  const change = offerChangeOf(record, fields);
  if (!change) return record;
  const response = await api.patch('/app/offers/{offer_id}', {
    params: { offer_id: record.id },
    body: { ...change, expected_updated_at: record.updatedAt },
    idempotencyKey,
  });
  return toOfferRecord(offerWire.parse(response.data));
}

/**
 * Pause or resume an offer from its row (H:5483): `is_active` alone, so it overwrites nothing
 * else and carries no `updated_at`. The answer holds the status the server worked out.
 */
export async function setOfferActive({
  offerId,
  isActive,
  idempotencyKey,
}: {
  offerId: string;
  isActive: boolean;
  idempotencyKey: string;
}): Promise<OfferRecord> {
  const response = await api.patch('/app/offers/{offer_id}', {
    params: { offer_id: offerId },
    body: { is_active: isActive },
    idempotencyKey,
  });
  return toOfferRecord(offerWire.parse(response.data));
}

/** Delete an offer with the reason the member picked — restorable. */
export async function deleteOffer({
  offerId,
  reason,
  note,
}: {
  offerId: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/offers/{offer_id}', {
    params: { offer_id: offerId },
    reason,
    note: note ?? undefined,
  });
}

/** Bring a deleted offer back — the Undo of its "removed" toast. */
export async function restoreOffer(
  offerId: string,
  idempotencyKey: string,
): Promise<OfferRecord> {
  const response = await api.post('/app/offers/{offer_id}/restore', {
    params: { offer_id: offerId },
    idempotencyKey,
  });
  return toOfferRecord(offerWire.parse(response.data));
}
