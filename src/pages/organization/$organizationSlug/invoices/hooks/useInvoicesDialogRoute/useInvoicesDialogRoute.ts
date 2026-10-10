import { useLocation, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import {
  organizationInvoice,
  organizationInvoiceEdit,
} from '@/lib/routes/invoice-builders.ts';
import { organizationPayments } from '@/lib/routes/payments-builders.ts';
import { PUBLIC_ID } from '@/lib/routes/search-params.ts';
import { fetchInvoice, invoiceQueryKeys } from '@/shared/api/clinic/invoices-api.ts';
import type { InvoiceDetail } from '@/shared/api/clinic/invoices-contracts.ts';
import { safeReferrer } from '@/shared/clinic/clinic-referrer.ts';
import {
  canPayment,
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
} from '@/shared/components/InvoiceDrawer/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicNavigate } from '@/shared/hooks/useClinicNavigate/index.ts';
import { useDialogRouteLocation } from '@/shared/hooks/useCrossRoomDialog/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  type InvoiceCreateSearch,
  validateInvoiceCreateSearch,
} from '../../invoices.dialog-search.ts';
import { validateInvoiceSearch } from '../../invoices.search.ts';

/** The dialog the invoices URL opens (KICKOFF §4, D24; `S:92–94`). */
export type InvoicesDialogRoute =
  | { kind: 'none' }
  /**
   * `/invoices/create` — New invoice, on `?type=&patient=`; on `?copyOf=` the
   * saved invoice it copies (`source`, once read — nothing opens before).
   */
  | { kind: 'create'; prefill: InvoiceCreateSearch; source?: InvoiceDetail }
  /** `/invoices/$invoiceId` — the preview with Print; `detail` arrives once loaded. */
  | ({ kind: 'preview' } & InvoiceRead)
  /** `/invoices/$invoiceId/edit` — Edit invoice. */
  | ({ kind: 'edit' } & InvoiceRead);

/** A routed invoice's read: the invoice once loaded, or a failure to read it with its Retry. */
export interface InvoiceRead {
  invoiceId: string;
  detail: InvoiceDetail | undefined;
  /** The read failed for another reason than a missing invoice (a dropped line, a 5xx). */
  failed: boolean;
  retry: () => void;
}

/** The dialog, how it closes, and the moves between the preview and the edit. */
export interface InvoicesDialogRouteState {
  dialog: InvoicesDialogRoute;
  /** Back to the room that opened it (`from`, allow-listed), else the Payments ledger. */
  close: () => void;
  /** From the preview to Edit invoice, keeping `from`. */
  openEdit: (invoiceId: string) => void;
  /** From a save to the preview — the invoice's own page. */
  openPreview: (invoiceId: string) => void;
}

const CREATE_PATH = /\/invoices\/create\/?$/;

/** An invoice id the API can name (`invc_…`) — a fixture-day link is "not found" at once. */
const isPublicId = (id: string) => PUBLIC_ID.test(id);
const EDIT_PATH = /\/invoices\/[^/]+\/edit\/?$/;

/**
 * Which dialog the invoices URL opens over its referrer (KICKOFF §4) — the
 * dialog routes render nothing, so the island reads them here. An invoice id
 * that names no invoice opens nothing: back to the referrer with "Invoice not
 * found · it may have been deleted" (`S:115`) — and so does a copy
 * (`?copyOf=`, the patient file's "Copy invoice") of an invoice that is gone,
 * and an id that is no public id (`invc_…`), never sent. A member without
 * `payment:create` who follows a create link goes back with the permission
 * toast, the invoice it would copy never read. `from`
 * (the room that opened it, allow-listed — `safeReferrer`) is where `close`
 * goes; without one, the Payments ledger, the island's default referrer. Over
 * that room's page (A-P1, `useCrossRoomDialog`) it reads the drawer's own
 * route, every way out goes back to the page as it was, and the move between
 * the preview and the edit stays over it.
 */
export function useInvoicesDialogRoute(): InvoicesDialogRouteState {
  const routeParams = useParams({ strict: false });
  const routePathname = useLocation({ select: (location) => location.pathname });
  const routeSearch: Record<string, unknown> = useSearch({ strict: false });
  const { params, pathname, search, crossRoom } = useDialogRouteLocation({
    params: routeParams,
    pathname: routePathname,
    search: routeSearch,
  });
  const { organizationSlug = '', invoiceId } = params;
  const navigate = useClinicNavigate();
  const { t } = useTranslation([INVOICE_DRAWER_NS, ERRORS_NS]);
  const access = useClinicAccess();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const detailKey = useCallback(
    (id: string) => invoiceQueryKeys.detail(organizationId, id),
    [organizationId],
  );

  const from = safeReferrer(validateInvoiceSearch(search).from, '');
  const close = useCallback(() => {
    if (crossRoom) {
      crossRoom.close();
      return;
    }
    if (from) {
      void navigate({ href: `/organization/${organizationSlug}/${from}`, replace: true });
      return;
    }
    void navigate({
      ...organizationPayments(organizationSlug),
      hash: true,
      replace: true,
    });
  }, [crossRoom, from, navigate, organizationSlug]);

  // Moving between the preview and the edit keeps the room to go back to —
  // and, over that room's page, the page (`useClinicNavigate`).
  const openEdit = useCallback(
    (id: string) => {
      void navigate({
        ...organizationInvoiceEdit(organizationSlug, id),
        search: from ? { from } : {},
        replace: true,
      });
    },
    [from, navigate, organizationSlug],
  );
  const openPreview = useCallback(
    (id: string) => {
      void navigate({
        ...organizationInvoice(organizationSlug, id),
        search: from ? { from } : {},
        replace: true,
      });
    },
    [from, navigate, organizationSlug],
  );

  const invoice = useDialogRouteRecord({
    id: invoiceId,
    queryKey: detailKey,
    fetchRecord: fetchInvoice,
    recordLabel: t(INVOICE_DRAWER_KEYS.record, { ns: INVOICE_DRAWER_NS }),
    onMissing: close,
    isWellFormed: isPublicId,
  });

  const isCreate = invoiceId === undefined && CREATE_PATH.test(pathname);
  const prefill = validateInvoiceCreateSearch(search);
  const mayCreate = canPayment(access, 'payment:create');
  const createRefused = isCreate && access.isResolved && !mayCreate;
  // "Copy invoice": the invoice it copies, read once the member may create
  // one; one that is gone closes with the not-found toast.
  const source = useDialogRouteRecord({
    id: isCreate && mayCreate ? prefill.copyOf : undefined,
    queryKey: detailKey,
    fetchRecord: fetchInvoice,
    recordLabel: t(INVOICE_DRAWER_KEYS.record, { ns: INVOICE_DRAWER_NS }),
    onMissing: close,
    isWellFormed: isPublicId,
  });
  const refusedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!createRefused || refusedFor.current === pathname) return;
    refusedFor.current = pathname;
    notify.info(t(ERRORS_KEYS.api.http403, { ns: ERRORS_NS }));
    close();
  }, [createRefused, pathname, close, t]);

  const state = { close, openEdit, openPreview };
  if (invoiceId !== undefined) {
    if (!invoice.isOpen) return { dialog: { kind: 'none' }, ...state };
    const kind = EDIT_PATH.test(pathname) ? 'edit' : 'preview';
    const read: InvoiceRead = {
      invoiceId,
      detail: invoice.record,
      failed: invoice.isError,
      retry: invoice.refetch,
    };
    return { dialog: { kind, ...read }, ...state };
  }
  if (isCreate && !createRefused) {
    return { dialog: createDialog(prefill, source.record), ...state };
  }
  return { dialog: { kind: 'none' }, ...state };
}

/** New invoice — a copy (`?copyOf=`) only once the invoice it copies is read. */
function createDialog(
  prefill: InvoiceCreateSearch,
  source: InvoiceDetail | undefined,
): InvoicesDialogRoute {
  if (prefill.copyOf === undefined) return { kind: 'create', prefill };
  return source ? { kind: 'create', prefill, source } : { kind: 'none' };
}
