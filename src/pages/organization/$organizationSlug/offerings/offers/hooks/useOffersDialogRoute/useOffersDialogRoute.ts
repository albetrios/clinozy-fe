import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationOffers } from '@/lib/routes/index.ts';
import { fetchOffer, offerQueryKeys } from '@/shared/api/clinic/offerings-api.ts';
import type { OfferRecord } from '@/shared/api/clinic/offerings-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { OFFERS_KEYS, OFFERS_NS } from '../../offers.constants.ts';
import { validateOffersSearch } from '../../offers.search.ts';

/** The dialog the Offers URL opens over the list (KICKOFF §4, D24). */
export type OffersDialogRoute =
  | { kind: 'none' }
  /** `/offerings/offers/create` — New offer (`S:102`). */
  | { kind: 'create' }
  /** `/offerings/offers/$offerId/edit` — Edit offer; `offer` arrives once loaded (`S:103`). */
  | { kind: 'edit'; offerId: string; offer: OfferRecord | undefined };

/** The dialog, and how it closes: back to the list with the list's own params. */
export interface OffersDialogRouteState {
  dialog: OffersDialogRoute;
  close: () => void;
}

const CREATE_PATH = /\/offers\/create\/?$/;

/**
 * Which dialog the URL opens over the Offers tab — the dialog routes render
 * nothing, so the page reads them here. A New offer link for a member who
 * cannot create offers (Offerings Create and the `prices` ability, Q-U8) lands
 * back on the list with the permission toast; an offer id that names no offer
 * goes back to the list with "Offer not found · it may have been deleted"
 * (`S:115`). The edit route stays open to a viewer: the drawer is view only.
 */
export function useOffersDialogRoute(): OffersDialogRouteState {
  const { organizationSlug = '', offerId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const { t } = useTranslation(ERRORS_NS);
  const { t: tRoom } = useTranslation(OFFERS_NS);
  const access = useClinicAccess();

  const close = useCallback(() => {
    void navigate({
      ...organizationOffers(organizationSlug),
      search: (current: Record<string, unknown>) => validateOffersSearch(current),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug]);

  const drawer = useDialogRouteRecord({
    id: offerId,
    queryKey: offerQueryKeys.detail,
    fetchRecord: fetchOffer,
    recordLabel: tRoom(OFFERS_KEYS.record),
    onMissing: close,
  });

  const isCreate = CREATE_PATH.test(pathname);
  const refused =
    isCreate &&
    access.isResolved &&
    !(access.can('offerings', 'create') && access.canAbility('prices'));
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
        ? { kind: 'edit', offerId, offer: drawer.record }
        : { kind: 'none' },
      close,
    };
  }
  return { dialog: isCreate && !refused ? { kind: 'create' } : { kind: 'none' }, close };
}
