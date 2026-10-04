import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPaymentsPending } from '@/lib/routes/index.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { CreditDirection } from '@/shared/api/clinic/clinic-schema.ts';
import { creditQueryKeys, fetchCredit } from '@/shared/api/clinic/credits-api.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../../payments.constants.ts';
import { validatePendingSearch } from '../../pending.search.ts';

/** The dialog the Pending URL opens over the page (KICKOFF §4, D24). */
export type PendingDialogRoute =
  | { kind: 'none' }
  /**
   * `/payments/pending/create` — Add pending, on `?direction=give|take` (`S:89`):
   * Pending's own `direction` filter, read as Which way when it names one.
   */
  | { kind: 'create'; prefill: { direction?: CreditDirection } }
  /** `/payments/pending/$creditId/edit` — Edit pending, while the credit is open (`S:90`). */
  | { kind: 'edit'; creditId: string; credit: CreditRow | undefined; readOnly: boolean };

/** The dialog, and how it closes: back to Pending with its own params. */
export interface PendingDialogRouteState {
  dialog: PendingDialogRoute;
  close: () => void;
}

const CREATE_PATH = /\/payments\/pending\/create\/?$/;

/**
 * Which dialog the URL opens over Payments › Pending — its dialog routes render
 * nothing, so the page reads them here. A credit id that names no credit opens
 * nothing: the URL goes back to `/payments/pending` with "Pending not found ·
 * it may have been deleted" (`S:115`); a settled credit goes back with its
 * state named (`S:90`). Without Create, a create link lands back on Pending
 * with the permission toast.
 */
export function usePendingDialogRoute(): PendingDialogRouteState {
  const { organizationSlug = '', creditId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation([PAYMENTS_NS, ERRORS_NS]);
  const access = useClinicAccess();

  const close = useCallback(() => {
    void navigate({
      ...organizationPaymentsPending(organizationSlug),
      search: (current: Record<string, unknown>) => validatePendingSearch(current),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug]);

  const credit = useDialogRouteRecord({
    id: creditId,
    queryKey: creditQueryKeys.detail,
    fetchRecord: fetchCredit,
    recordLabel: t(PAYMENTS_KEYS.dialog.credit, { ns: PAYMENTS_NS }),
    onMissing: close,
  });

  // A settled credit is no longer editable (`S:90`): back to Pending, named.
  const settled = credit.record && credit.record.status !== 'open' ? credit.record : null;
  const settledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!settled || settledFor.current === settled.id) return;
    settledFor.current = settled.id;
    notify.info(
      `${displayId.pendingCredit(settled.seq)} · ${t(
        PAYMENTS_KEYS.pending.states[settled.status],
        { ns: PAYMENTS_NS },
      )}`,
    );
    close();
  }, [settled, close, t]);

  const isCreate = creditId === undefined && CREATE_PATH.test(pathname);
  const refused = isCreate && access.isResolved && !access.can('payments', 'create');
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403, { ns: ERRORS_NS }));
    close();
  }, [refused, pathname, close, t]);

  if (creditId !== undefined) {
    if (!credit.isOpen || settled) return { dialog: { kind: 'none' }, close };
    return {
      dialog: {
        kind: 'edit',
        creditId,
        credit: credit.record,
        readOnly: access.isResolved && !access.can('payments', 'edit'),
      },
      close,
    };
  }
  if (isCreate && !refused) {
    const { direction } = validatePendingSearch(search);
    return {
      dialog: {
        kind: 'create',
        prefill: { direction: direction?.length === 1 ? direction[0] : undefined },
      },
      close,
    };
  }
  return { dialog: { kind: 'none' }, close };
}
