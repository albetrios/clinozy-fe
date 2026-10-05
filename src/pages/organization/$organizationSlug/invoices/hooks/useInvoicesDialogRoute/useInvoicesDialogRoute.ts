import { useLocation, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import {
  organizationInvoice,
  organizationInvoiceEdit,
} from '@/lib/routes/invoice-builders.ts';
import { organizationPayments } from '@/lib/routes/payments-builders.ts';
import { fetchInvoice, invoiceQueryKeys } from '@/shared/api/clinic/invoices-api.ts';
import type { InvoiceDetail } from '@/shared/api/clinic/invoices-contracts.ts';
import { safeReferrer } from '@/shared/clinic/clinic-referrer.ts';
import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
} from '@/shared/components/InvoiceDrawer/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { notify } from '@/shared/notify/index.ts';

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
  | { kind: 'preview'; invoiceId: string; detail: InvoiceDetail | undefined }
  /** `/invoices/$invoiceId/edit` — Edit invoice. */
  | { kind: 'edit'; invoiceId: string; detail: InvoiceDetail | undefined };

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
const EDIT_PATH = /\/invoices\/[^/]+\/edit\/?$/;

/**
 * Which dialog the invoices URL opens over its referrer (KICKOFF §4) — the
 * dialog routes render nothing, so the island reads them here. An invoice id
 * that names no invoice opens nothing: back to the referrer with "Invoice not
 * found · it may have been deleted" (`S:115`) — and so does a copy
 * (`?copyOf=`, the patient file's "Copy invoice") of an invoice that is gone.
 * A member without Payments Create who follows a create link goes back with
 * the permission toast, the invoice it would copy never read. `from`
 * (the room that opened it, allow-listed — `safeReferrer`) is where `close`
 * goes; without one, the Payments ledger, the island's default referrer.
 */
export function useInvoicesDialogRoute(): InvoicesDialogRouteState {
  const { organizationSlug = '', invoiceId } = useParams({ strict: false });
  const pathname = useLocation({ select: (location) => location.pathname });
  const search: Record<string, unknown> = useSearch({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation([INVOICE_DRAWER_NS, ERRORS_NS]);
  const access = useClinicAccess();

  const from = safeReferrer(validateInvoiceSearch(search).from, '');
  const close = useCallback(() => {
    if (from) {
      void navigate({ href: `/organization/${organizationSlug}/${from}`, replace: true });
      return;
    }
    void navigate({
      ...organizationPayments(organizationSlug),
      hash: true,
      replace: true,
    });
  }, [from, navigate, organizationSlug]);

  // Moving between the preview and the edit keeps the room to go back to.
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
    queryKey: invoiceQueryKeys.detail,
    fetchRecord: fetchInvoice,
    recordLabel: t(INVOICE_DRAWER_KEYS.record, { ns: INVOICE_DRAWER_NS }),
    onMissing: close,
  });

  const isCreate = invoiceId === undefined && CREATE_PATH.test(pathname);
  const prefill = validateInvoiceCreateSearch(search);
  const mayCreate = access.isResolved && access.can('payments', 'create');
  const createRefused = isCreate && access.isResolved && !mayCreate;
  // "Copy invoice": the invoice it copies, read once the member may create
  // one; one that is gone closes with the not-found toast.
  const source = useDialogRouteRecord({
    id: isCreate && mayCreate ? prefill.copyOf : undefined,
    queryKey: invoiceQueryKeys.detail,
    fetchRecord: fetchInvoice,
    recordLabel: t(INVOICE_DRAWER_KEYS.record, { ns: INVOICE_DRAWER_NS }),
    onMissing: close,
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
    return { dialog: { kind, invoiceId, detail: invoice.record }, ...state };
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
