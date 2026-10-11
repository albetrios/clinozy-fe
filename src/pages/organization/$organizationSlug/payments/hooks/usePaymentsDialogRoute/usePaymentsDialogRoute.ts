import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { TFunction } from 'i18next';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPayments } from '@/lib/routes/payments-builders.ts';
import { fetchPayment, paymentQueryKeys } from '@/shared/api/app/payments-api.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { safeReferrer } from '@/shared/app/app-referrer.ts';
import {
  ledgerEntryEditable,
  ledgerEntryFixed,
  ledgerEntryLock,
} from '@/shared/components/LedgerCells/index.ts';
import { useDialogRouteLocation } from '@/shared/hooks/useCrossRoomDialog/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';
import {
  type DayCloseSearch,
  type PaymentPaySearch,
  type PaymentReceiveSearch,
  validateDayCloseSearch,
  validatePaymentPaySearch,
  validatePaymentReceiveSearch,
} from '../../payments.dialog-search.ts';
import { validatePaymentsSearch } from '../../payments.search.ts';

/** The dialog the Payments URL opens over the ledger (KICKOFF §4, D24). */
export type PaymentsDialogRoute =
  | { kind: 'none' }
  /** `/payments/receive` — Receive payment, prefilled from `?patient=&invoice=` (`S:85`). */
  | { kind: 'receive'; prefill: PaymentReceiveSearch }
  /** `/payments/pay` — Send payment, on `?bill=` when a room's "Pay ₹X" opened it (`S:86`). */
  | { kind: 'pay'; prefill: PaymentPaySearch }
  /** `/payments/$paymentId/edit` — the entry's drawer, while its day is open (`S:87`). */
  | {
      kind: 'edit';
      paymentId: string;
      payment: LedgerRow | undefined;
      /** No Edit: a read-only drawer. */
      readOnly: boolean;
    }
  /** `/payments/day-close` — Day close on `?date=` (default today) for `?branch=` (`S:91`). */
  | { kind: 'dayClose'; search: DayCloseSearch };

/** The dialog, and how it closes: back to the room it came from, else the ledger. */
export interface PaymentsDialogRouteState {
  dialog: PaymentsDialogRoute;
  close: () => void;
}

const RECEIVE_PATH = /\/payments\/receive\/?$/;
const PAY_PATH = /\/payments\/pay\/?$/;
const DAY_CLOSE_PATH = /\/payments\/day-close\/?$/;

/**
 * The dialog a path opens when it names no entry: Receive or Send payment with
 * their prefill, Day close on its day — else none.
 */
function pathDialog(
  pathname: string,
  search: Record<string, unknown>,
): PaymentsDialogRoute {
  if (RECEIVE_PATH.test(pathname)) {
    return { kind: 'receive', prefill: validatePaymentReceiveSearch(search) };
  }
  if (PAY_PATH.test(pathname)) {
    return { kind: 'pay', prefill: validatePaymentPaySearch(search) };
  }
  if (DAY_CLOSE_PATH.test(pathname)) {
    return { kind: 'dayClose', search: validateDayCloseSearch(search) };
  }
  return { kind: 'none' };
}

/**
 * Why an entry the URL names opens no drawer, or null when it opens: its day is closed or a
 * pending credit settled it (`S:87`), or — a refund, a reversal — its money is another write's.
 */
function entryRefusal(entry: LedgerRow, t: TFunction): string | null {
  const lock = ledgerEntryLock(entry, t);
  if (lock) return lock;
  return ledgerEntryEditable(entry) ? null : ledgerEntryFixed(entry, t);
}

/** An entry that can't be edited: back to the ledger, named — once per entry. */
function useLockedEntryRefusal(
  entry: LedgerRow | null,
  refusal: string | null,
  back: () => void,
) {
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!entry || refusedFor.current === entry.id) return;
    refusedFor.current = entry.id;
    notify.info(refusal ?? '');
    back();
  }, [entry, refusal, back]);
}

/** A create link the member's role can't follow: back to the ledger with the permission toast. */
function useRefusal(refused: boolean, pathname: string, back: () => void) {
  const { t } = useTranslation(ERRORS_NS);
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!refused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403));
    back();
  }, [refused, pathname, back, t]);
}

/**
 * Which dialog the URL opens over the Payments ledger — the room's dialog
 * routes render nothing, so the page reads them here. An entry id that names
 * no entry opens nothing: the URL goes back to `/payments`, the ledger's
 * filters kept, with "Payment not found · it may have been deleted" (`S:115`);
 * an entry whose day is closed goes back the same way with "PAY-5509 · Day
 * closed" (`S:87`), a refund or a reversal with "PAY-9 · its money can’t change"
 * (it is deleted on its day, never edited). A member without `payment:create` who
 * follows a Receive or Pay link
 * lands on the ledger with the permission toast. `close` returns to the
 * referrer `from` (allow-listed rooms, A-P1), else to the ledger with its own
 * params and nothing of the drawer's. Over another room's page (A-P1,
 * `useCrossRoomDialog`) it reads the drawer's own route, and every way out
 * goes back to that page.
 */
export function usePaymentsDialogRoute(): PaymentsDialogRouteState {
  const routeParams = useParams({ strict: false });
  const routePathname = useLocation({ select: (location) => location.pathname });
  const routeSearch: Record<string, unknown> = useSearch({ strict: false });
  const { params, pathname, search, crossRoom } = useDialogRouteLocation({
    params: routeParams,
    pathname: routePathname,
    search: routeSearch,
  });
  const { organizationSlug = '', paymentId } = params;
  const navigate = useNavigate();
  const { t } = useTranslation(PAYMENTS_NS);
  const access = usePaymentAccess();
  const organizationId = useOrganizationStore((state) => state.organizationId);

  const backToLedger = useCallback(() => {
    if (crossRoom) {
      crossRoom.close();
      return;
    }
    void navigate({
      ...organizationPayments(organizationSlug),
      // The ledger's own params only: the drawer's (`patient`, `bill` …) close with it.
      search: (current: Record<string, unknown>) => validatePaymentsSearch(current),
      hash: true,
      replace: true,
    });
  }, [crossRoom, navigate, organizationSlug]);

  const entry = useDialogRouteRecord({
    id: paymentId,
    queryKey: (id) => paymentQueryKeys.detail(organizationId, id),
    fetchRecord: fetchPayment,
    recordLabel: t(PAYMENTS_KEYS.dialog.record),
    onMissing: backToLedger,
  });

  const refusal = entry.record ? entryRefusal(entry.record, t) : null;
  const lockedEntry = refusal === null ? null : (entry.record ?? null);
  useLockedEntryRefusal(lockedEntry, refusal, backToLedger);

  const isReceive = RECEIVE_PATH.test(pathname);
  const isCreate = isReceive || PAY_PATH.test(pathname);
  const createRefused = isCreate && access.resolved && !access.canCreate;
  useRefusal(createRefused, pathname, backToLedger);

  // The drawer's params are parsed again here: from the ledger's own match the
  // router hands back the URL's raw values, not the dialog route's.
  const from = isReceive
    ? safeReferrer(validatePaymentReceiveSearch(search).from, '')
    : '';
  const close = useCallback(() => {
    if (from && !crossRoom) {
      void navigate({ href: `/organization/${organizationSlug}/${from}` });
      return;
    }
    backToLedger();
  }, [crossRoom, from, navigate, organizationSlug, backToLedger]);

  if (paymentId !== undefined) {
    if (!entry.isOpen || lockedEntry) return { dialog: { kind: 'none' }, close };
    return {
      dialog: {
        kind: 'edit',
        paymentId,
        payment: entry.record,
        readOnly: access.resolved && !access.canEdit,
      },
      close,
    };
  }
  if (createRefused) return { dialog: { kind: 'none' }, close };
  return { dialog: pathDialog(pathname, search), close };
}
