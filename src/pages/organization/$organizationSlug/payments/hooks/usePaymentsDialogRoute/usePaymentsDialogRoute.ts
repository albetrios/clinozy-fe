import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationPayments } from '@/lib/routes/index.ts';
import { fetchPayment, paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { safeReferrer } from '@/shared/clinic/clinic-referrer.ts';
import { ledgerEntryLock } from '@/shared/components/LedgerCells/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';
import {
  type DayCloseSearch,
  type PaymentPaySearch,
  type PaymentReceiveSearch,
  validateDayCloseSearch,
  validatePaymentPaySearch,
  validatePaymentReceiveSearch,
  validatePaymentsSearch,
} from '../../payments.search.ts';

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

/** A closed day's entry can't be edited (`S:87`): back to the ledger, named — once per entry. */
function useLockedEntryRefusal(entry: LedgerRow | null, back: () => void) {
  const { t } = useTranslation(PAYMENTS_NS);
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!entry || refusedFor.current === entry.id) return;
    refusedFor.current = entry.id;
    notify.info(ledgerEntryLock(entry, t) ?? '');
    back();
  }, [entry, back, t]);
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
 * closed" (`S:87`). A member without Create who follows a Receive or Pay link
 * lands on the ledger with the permission toast. `close` returns to the
 * referrer `from` (allow-listed rooms, A-P1), else to the ledger with its own
 * params and nothing of the drawer's.
 */
export function usePaymentsDialogRoute(): PaymentsDialogRouteState {
  const { organizationSlug = '', paymentId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation(PAYMENTS_NS);
  const access = useClinicAccess();

  const backToLedger = useCallback(() => {
    void navigate({
      ...organizationPayments(organizationSlug),
      // The ledger's own params only: the drawer's (`patient`, `bill` …) close with it.
      search: (current: Record<string, unknown>) => validatePaymentsSearch(current),
      hash: true,
      replace: true,
    });
  }, [navigate, organizationSlug]);

  const entry = useDialogRouteRecord({
    id: paymentId,
    queryKey: paymentQueryKeys.detail,
    fetchRecord: fetchPayment,
    recordLabel: t(PAYMENTS_KEYS.dialog.record),
    onMissing: backToLedger,
  });

  const lockedEntry =
    entry.record && ledgerEntryLock(entry.record, t) !== null ? entry.record : null;
  useLockedEntryRefusal(lockedEntry, backToLedger);

  const isReceive = RECEIVE_PATH.test(pathname);
  const isCreate = isReceive || PAY_PATH.test(pathname);
  const createRefused =
    isCreate && access.isResolved && !access.can('payments', 'create');
  useRefusal(createRefused, pathname, backToLedger);

  // The drawer's params are parsed again here: from the ledger's own match the
  // router hands back the URL's raw values, not the dialog route's.
  const from = isReceive
    ? safeReferrer(validatePaymentReceiveSearch(search).from, '')
    : '';
  const close = useCallback(() => {
    if (from) {
      void navigate({ href: `/organization/${organizationSlug}/${from}` });
      return;
    }
    backToLedger();
  }, [from, navigate, organizationSlug, backToLedger]);

  if (paymentId !== undefined) {
    if (!entry.isOpen || lockedEntry) return { dialog: { kind: 'none' }, close };
    return {
      dialog: {
        kind: 'edit',
        paymentId,
        payment: entry.record,
        readOnly: access.isResolved && !access.can('payments', 'edit'),
      },
      close,
    };
  }
  if (createRefused) return { dialog: { kind: 'none' }, close };
  return { dialog: pathDialog(pathname, search), close };
}
