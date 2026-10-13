import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationOffers } from '@/lib/routes/offerings-builders.ts';
import { PUBLIC_ID } from '@/lib/routes/search-params.ts';
import { fetchOffer, offerQueryKeys } from '@/shared/api/app/offerings-api.ts';
import type { OfferRecord } from '@/shared/api/app/offerings-contracts.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { OFFER_PERMISSIONS, OFFERS_KEYS, OFFERS_NS } from '../../offers.constants.ts';
import { validateOffersSearch } from '../../offers.search.ts';

/** The dialog the Offers URL opens over the list (KICKOFF §4, D24). */
export type OffersDialogRoute =
  | { kind: 'none' }
  /** `/offerings/offers/create` — New offer (`S:102`). */
  | { kind: 'create' }
  /** `/offerings/offers/$offerId/edit` — Edit offer; `offer` arrives once loaded (`S:103`). */
  | {
      kind: 'edit';
      offerId: string;
      offer: OfferRecord | undefined;
      /** The offer's own read failed (a dropped connection, a 5xx) — not a missing offer. */
      failed: boolean;
      /** Read it again — the drawer's Retry. */
      retry: () => void;
    };

/** The dialog, and how it closes: back to the list with the list's own params. */
export interface OffersDialogRouteState {
  dialog: OffersDialogRoute;
  close: () => void;
}

const CREATE_PATH = /\/offers\/create\/?$/;

/**
 * Which dialog the URL opens over the Offers tab — the dialog routes render
 * nothing, so the page reads them here. A New offer link for a member without
 * `offering:create` lands back on the list with the permission toast. The
 * offer is read by its public id (`GET /app/offers/:offer_id`, the cache entry
 * the drawer's writes refresh); an id that names no offer (a deleted offer —
 * 404 — or no public id at all) goes back to the list with "Offer not found ·
 * it may have been deleted" (`S:115`). The edit route stays open to a viewer:
 * the drawer is view only.
 */
export function useOffersDialogRoute(): OffersDialogRouteState {
  const { organizationSlug = '', offerId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { t } = useTranslation(ERRORS_NS);
  const { t: tRoom } = useTranslation(OFFERS_NS);
  const access = useAppAccess();
  const organizationId = useOrganizationStore((state) => state.organizationId);

  const close = useCallback(() => {
    void navigate({
      ...organizationOffers(organizationSlug),
      search: (current: Record<string, unknown>) => validateOffersSearch(current),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug]);

  const recordLabel = tRoom(OFFERS_KEYS.record);
  const drawer = useDialogRouteRecord({
    id: offerId,
    queryKey: (id) => offerQueryKeys.detail(organizationId, id),
    fetchRecord: fetchOffer,
    recordLabel,
    onMissing: close,
    // An old uuid link or a mistyped one: "not found", never sent (the API answers it 400).
    isWellFormed: (id) => PUBLIC_ID.test(id),
  });

  const isCreate = CREATE_PATH.test(pathname);
  const refused =
    isCreate && access.isResolved && !access.canCode(OFFER_PERMISSIONS.create);
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403));
    close();
  }, [refused, pathname, close, t]);

  if (offerId !== undefined) {
    return {
      dialog: drawer.isOpen
        ? {
            kind: 'edit',
            offerId,
            offer: drawer.record,
            failed: drawer.isError,
            retry: drawer.refetch,
          }
        : { kind: 'none' },
      close,
    };
  }
  return { dialog: isCreate && !refused ? { kind: 'create' } : { kind: 'none' }, close };
}
