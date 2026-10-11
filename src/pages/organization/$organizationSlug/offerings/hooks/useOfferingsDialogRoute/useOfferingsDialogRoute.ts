import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationOfferings } from '@/lib/routes/offerings-builders.ts';
import { PUBLIC_ID } from '@/lib/routes/search-params.ts';
import { fetchOffering, offeringQueryKeys } from '@/shared/api/app/offerings-api.ts';
import type { OfferingRecord } from '@/shared/api/app/offerings-contracts.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { OFFERINGS_KEYS, OFFERINGS_NS } from '../../offerings.constants.ts';
import {
  type OfferingCreateSearch,
  validateOfferingCreateSearch,
} from '../../offerings.dialog-search.ts';
import { validateOfferingsSearch } from '../../offerings.search.ts';

/** The dialog the Offerings URL opens over the list (KICKOFF §4, D24). */
export type OfferingsDialogRoute =
  | { kind: 'none' }
  /** `/offerings/create` — New offering, prefilled from `?name=` (`S:99`). */
  | { kind: 'create'; prefill: OfferingCreateSearch }
  /** `/offerings/$offeringId/edit` — Edit offering; `offering` arrives once loaded (`S:100`). */
  | { kind: 'edit'; offeringId: string; offering: OfferingRecord | undefined };

/** The dialog, and how it closes: back to the list with the list's own params. */
export interface OfferingsDialogRouteState {
  dialog: OfferingsDialogRoute;
  close: () => void;
}

const CREATE_PATH = /\/offerings\/create\/?$/;

/**
 * Which dialog the URL opens over the Offerings list — the room's dialog
 * routes render nothing, so the page reads them here. A member without
 * `offering:create` who follows a create link lands back on the list with the
 * permission toast. The offering is read by its public id
 * (`GET /app/offerings/:offering_id`, the cache entry the drawer's writes
 * refresh); an id that names no offering (a stale link, a deleted offering —
 * 404 — or no public id at all) opens nothing: the URL goes back to the list
 * in place, with "Offering not found · it may have been deleted" (`S:115`).
 * The edit route stays open to a viewer — the drawer is view only (`S:100`).
 * `close` returns to the list with its search, filters and sort, and drops the
 * prefill.
 */
export function useOfferingsDialogRoute(): OfferingsDialogRouteState {
  const { organizationSlug = '', offeringId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation(ERRORS_NS);
  const { t: tRoom } = useTranslation(OFFERINGS_NS);
  const access = useAppAccess();
  const organizationId = useOrganizationStore((state) => state.organizationId);

  const close = useCallback(() => {
    void navigate({
      ...organizationOfferings(organizationSlug),
      search: (current: Record<string, unknown>) => validateOfferingsSearch(current),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug]);

  const recordLabel = tRoom(OFFERINGS_KEYS.record);
  const drawer = useDialogRouteRecord({
    id: offeringId,
    queryKey: (id) => offeringQueryKeys.detail(organizationId, id),
    fetchRecord: fetchOffering,
    recordLabel,
    onMissing: close,
    // An old uuid link or a mistyped one: "not found", never sent (the API answers it 400).
    isWellFormed: (id) => PUBLIC_ID.test(id),
  });

  const isCreate = CREATE_PATH.test(pathname);
  const refused = isCreate && access.isResolved && !access.canCode('offering:create');
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403));
    close();
  }, [refused, pathname, close, t]);

  if (offeringId !== undefined) {
    return {
      dialog: drawer.isOpen
        ? { kind: 'edit', offeringId, offering: drawer.record }
        : { kind: 'none' },
      close,
    };
  }
  if (!isCreate || refused) return { dialog: { kind: 'none' }, close };
  // The prefill is parsed again here: from the list's own match the router
  // hands back the URL's raw values, not the create route's.
  return {
    dialog: { kind: 'create', prefill: validateOfferingCreateSearch(search) },
    close,
  };
}
