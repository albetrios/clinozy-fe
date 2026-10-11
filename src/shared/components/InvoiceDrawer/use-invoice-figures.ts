import { useEffect, useMemo, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { paiseOfRupees } from '@/lib/number-text.ts';
import { discountForFinal, lineFinal } from '@/shared/api/app/app-money.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import { useOffers } from '@/shared/hooks/useOffers/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { INVOICE_DRAWER_KEYS, INVOICE_DRAWER_NS } from './invoice-drawer.constants.ts';
import { type InvoiceFigures, previewFigures, saleFigures } from './invoice-figures.ts';
import {
  type InvoiceFormValues,
  type InvoiceLineForm,
  paidNowTotal,
} from './invoice-form.ts';
import type { InvoiceRowFigures } from './InvoiceItemsField.tsx';
import { draftFigures } from './sale-form.ts';
import type { InvoiceCatalog } from './use-invoice-catalog.ts';
import type { DrawerPreview, InvoicePreviewLine } from './use-invoice-preview.ts';
import { belowLowestMessage } from './use-invoice-save.ts';

/*
 * The drawer's figures and each row's: a Medical sale's from the fixture world's own sums, an
 * invoice's from the server's preview — or, when the invoice cannot change here, as it was saved.
 * A typed Final turns into the line's discount (a preview of what the member types — the server's
 * figure replaces it).
 */

/** What {@link useDrawerFigures} reads. */
interface DrawerFiguresInput {
  form: UseFormReturn<InvoiceFormValues>;
  values: InvoiceFormValues;
  /** A Medical sale (the fixture world's). */
  sale: boolean;
  /** The saved invoice an edit opened on. */
  invoice: InvoiceRecord | null;
  /** The drawer reads only: its figures are the invoice as saved. */
  readOnly: boolean;
  preview: DrawerPreview;
  catalog: InvoiceCatalog;
  floorVisible: boolean;
  /** The drawer opened with lines of its own (an edit, a copy): their offers go unsaid. */
  openedWithLines: boolean;
}

/** What the drawer shows of the money: the totals, each row's cells and the typed Final. */
export interface DrawerFigures {
  figures: InvoiceFigures;
  rowFigures: (row: InvoiceLineForm, index: number) => InvoiceRowFigures;
  onFinal: (index: number, final: number) => void;
  /** The lines' sessions as the server counts them — "Covers 6 sessions". */
  sessionLines: readonly { qty: number; sessionsTotal: number | null }[];
}

/** A saved invoice's figures as it stands — a read-only drawer asks for no preview. */
function savedFigures(invoice: InvoiceRecord): InvoiceFigures {
  return {
    status: 'ready',
    subtotal: paiseOfRupees(invoice.subtotal),
    discount: paiseOfRupees(invoice.discountTotal),
    gst: paiseOfRupees(invoice.gstTotal),
    bill: paiseOfRupees(invoice.total),
    paidBefore: paiseOfRupees(invoice.paid),
    paidNow: 0,
    dueBefore: paiseOfRupees(invoice.due),
    due: paiseOfRupees(invoice.due),
  };
}

/** A row nothing knows the figures of yet. */
const UNKNOWN_ROW: InvoiceRowFigures = {
  rate: null,
  gstPct: null,
  final: null,
  offers: [],
  stale: false,
};

/**
 * The discount a typed Final asks of a priced line (paise): the line's own discount that brings
 * its quantity at the server's rate — GST on top unless included — to the Final, two places,
 * before any overall discount. A preview of what is typed: the server's figure replaces it.
 */
function discountForTypedFinal(line: InvoicePreviewLine, final: number): number {
  const gross = paiseOfRupees(line.rate) * line.qty;
  const full = line.isGstInclusive ? gross : gross * (1 + line.gstPct / 100);
  if (full <= 0) return 0;
  const wanted = Math.min(full, Math.max(0, final));
  return Math.round((1 - wanted / full) * 10_000) / 100;
}

/** A sale's row as the fixture world sums it. */
function saleRow(row: InvoiceLineForm): InvoiceRowFigures {
  const named = row.name.trim() !== '';
  return {
    rate: row.rate,
    gstPct: row.gstPct,
    final: named ? lineFinal(row) : 0,
    offers: [],
    stale: false,
  };
}

/** A saved line's figures, by the row's line id. */
function savedRow(invoice: InvoiceRecord, row: InvoiceLineForm): InvoiceRowFigures {
  const line = invoice.items.find((saved) => saved.id === row.id);
  if (!line) return UNKNOWN_ROW;
  return {
    rate: paiseOfRupees(line.rate),
    gstPct: line.gstPct,
    final: paiseOfRupees(line.amount),
    offers: [],
    stale: false,
  };
}

/**
 * "<offer> applied to <offering>" once for each live offer the server's preview applies to a
 * line the member added — never, when the drawer opened with lines (`quietFirst`: an edit, a
 * copy), for those.
 */
function usePromoToasts(
  preview: DrawerPreview['preview'],
  offerNames: ReadonlyMap<string, string>,
  quietFirst: boolean,
): void {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const seenRef = useRef<Set<string> | null>(quietFirst ? null : new Set());
  useEffect(() => {
    if (!preview) return;
    const applied = preview.items.flatMap((line) =>
      line.offerIds.map((offerId) => ({
        key: `${line.offeringId}:${offerId}`,
        offerId,
        line,
      })),
    );
    if (seenRef.current === null) {
      seenRef.current = new Set(applied.map((entry) => entry.key));
      return;
    }
    for (const { key, offerId, line } of applied) {
      const offer = offerNames.get(offerId);
      if (seenRef.current.has(key) || !offer) continue;
      seenRef.current.add(key);
      notify.info(t(INVOICE_DRAWER_KEYS.toasts.promo, { offer, offering: line.name }));
    }
  }, [preview, offerNames, t]);
}

/**
 * The drawer's figures (paise, like the form's money fields) and each row's Rate, GST and Final:
 * a Medical sale's own sums; a read-only invoice as saved; else the server's preview — a row's
 * figures dimmed while a new one is on its way, a row the server refuses under its lowest price
 * said on its Final.
 */
export function useDrawerFigures({
  form,
  values,
  sale,
  invoice,
  readOnly,
  preview,
  catalog,
  floorVisible,
  openedWithLines,
}: DrawerFiguresInput): DrawerFigures {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatRupees = useRupeeFormat();
  const offers = useOffers();
  const offerNames = useMemo(
    () => new Map((offers.data ?? []).map((offer) => [offer.id, offer.name])),
    [offers.data],
  );
  usePromoToasts(sale ? null : preview.preview, offerNames, openedWithLines);
  const setDiscount = (index: number, discountPct: number) =>
    form.setValue(`items.${index}.discountPct`, discountPct, { shouldDirty: true });

  if (sale) {
    return {
      figures: saleFigures(draftFigures(values)),
      rowFigures: saleRow,
      onFinal: (index, final) => {
        const row = form.getValues(`items.${index}`);
        setDiscount(index, discountForFinal(row, final));
      },
      sessionLines: [],
    };
  }
  if (readOnly && invoice) {
    return {
      figures: savedFigures(invoice),
      rowFigures: (row) => savedRow(invoice, row),
      onFinal: () => undefined,
      sessionLines: [],
    };
  }
  const invoiceRow = (row: InvoiceLineForm, index: number): InvoiceRowFigures => {
    const error = preview.refusedRows.includes(index)
      ? belowLowestMessage({ row, catalog, floorVisible, t, formatRupees, inCell: true })
      : undefined;
    const found = preview.lineOf(index);
    if (!found) return { ...UNKNOWN_ROW, error };
    return {
      rate: paiseOfRupees(found.line.rate),
      gstPct: found.line.gstPct,
      final: paiseOfRupees(found.line.amount),
      offers: found.line.offerIds.flatMap((id) => offerNames.get(id) ?? []),
      stale: !found.current,
      error,
    };
  };
  return {
    figures: previewFigures({
      preview: preview.preview,
      status: preview.status,
      paidNow: invoice ? 0 : paidNowTotal(values.paidNow),
      paidBefore: invoice ? paiseOfRupees(invoice.paid) : 0,
    }),
    rowFigures: invoiceRow,
    onFinal: (index, final) => {
      const found = preview.lineOf(index);
      if (found) setDiscount(index, discountForTypedFinal(found.line, final));
    },
    sessionLines: preview.preview?.items ?? [],
  };
}
