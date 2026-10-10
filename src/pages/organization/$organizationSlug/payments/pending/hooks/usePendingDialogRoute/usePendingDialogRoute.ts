import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPaymentsPending } from '@/lib/routes/payments-builders.ts';
import type { CreditDirection } from '@/shared/api/clinic/clinic-schema.ts';
import { creditQueryKeys, fetchCredit } from '@/shared/api/clinic/credits-api.ts';
import type { CreditRow } from '@/shared/api/clinic/credits-contracts.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../../payments.constants.ts';
import { useCreditLockLabel } from '../../components/PendingCells/index.ts';
import { validatePendingSearch } from '../../pending.search.ts';

/** The dialog the Pending URL opens over the page (KICKOFF §4, D24). */
export type PendingDialogRoute =
  | { kind: 'none' }
  /**
   * `/payments/pending/create` — Add pending, on `?direction=give|take` (`S:89`):
   * Pending's own `direction` filter, read as Which way when it names one.
   */
  | { kind: 'create'; prefill: { direction?: CreditDirection } }
  /** `/payments/pending/$creditId/edit` — Edit pending, while nothing of the credit is settled (`S:90`). */
  | { kind: 'edit'; creditId: string; credit: CreditRow | undefined; readOnly: boolean };

/** The dialog, and how it closes: back to Pending with its own params. */
export interface PendingDialogRouteState {
  dialog: PendingDialogRoute;
  close: () => void;
}

const CREATE_PATH = /\/payments\/pending\/create\/?$/;

/**
 * Once per credit: a credit that no longer changes — `label` says why — goes back to Pending
 * with that named (`S:90`).
 */
function useLockedCreditBack(
  credit: CreditRow | undefined,
  label: string | null,
  close: () => void,
) {
  const lockedId = label === null ? null : (credit?.id ?? null);
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    if (label === null || lockedId === null || shownFor.current === lockedId) return;
    shownFor.current = lockedId;
    notify.info(label);
    close();
  }, [label, lockedId, close]);
}

/** Once per path: a create link the member may not use goes back with the permission toast. */
function useRefusedCreateBack(refused: boolean, pathname: string, close: () => void) {
  const { t } = useTranslation(ERRORS_NS);
  const shownFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || shownFor.current === pathname) return;
    shownFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403));
    close();
  }, [refused, pathname, close, t]);
}

/**
 * Which dialog the URL opens over Payments › Pending — its dialog routes render
 * nothing, so the page reads them here. A credit id that names no credit opens
 * nothing: the URL goes back to `/payments/pending` with "Pending not found ·
 * it may have been deleted" (`S:115`); a credit settled in full or in part — the
 * API keeps it as it is from the first settlement — goes back with that named
 * ("CR-1 · Received", "CR-1 · ₹50 settled · it can’t change now", `S:90`).
 * Without `payment:create`, a create link lands back on Pending with the
 * permission toast; without `payment:update` the credit opens view only.
 */
export function usePendingDialogRoute(): PendingDialogRouteState {
  const { organizationSlug = '', creditId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const { t: tPayments } = useTranslation(PAYMENTS_NS);
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const access = usePaymentAccess();
  const lockLabel = useCreditLockLabel();

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
    queryKey: (id) => creditQueryKeys.detail(organizationId, id),
    fetchRecord: fetchCredit,
    recordLabel: tPayments(PAYMENTS_KEYS.dialog.credit),
    onMissing: close,
  });

  // A credit settled in full or in part no longer changes (`S:90`): back to Pending, named.
  const settled = credit.record ? lockLabel(credit.record) : null;
  useLockedCreditBack(credit.record, settled, close);

  const isCreate = creditId === undefined && CREATE_PATH.test(pathname);
  const refused = isCreate && access.resolved && !access.canCreate;
  useRefusedCreateBack(refused, pathname, close);

  if (creditId !== undefined) {
    if (!credit.isOpen || settled) return { dialog: { kind: 'none' }, close };
    return {
      dialog: {
        kind: 'edit',
        creditId,
        credit: credit.record,
        readOnly: access.resolved && !access.canEdit,
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
