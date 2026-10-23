import { useMemo } from 'react';

import {
  belowLowestPriceLines,
  type InvoiceInput,
  type InvoicePreview,
  type InvoiceRecord,
} from '@/shared/api/app/invoices-contracts.ts';
import { mapApiError } from '@/shared/errors/errorHandler.ts';
import { isClientRefusal } from '@/shared/errors/HttpError.ts';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue/index.ts';
import { useInvoicePreview } from '@/shared/hooks/useInvoices/index.ts';

import type { InvoiceFiguresStatus } from './invoice-figures.ts';
import { type InvoiceFormValues, invoiceInputOf, sentLines } from './invoice-form.ts';

/*
 * The server's preview of what the drawer holds (D81 Q2): the lines as the save would price
 * them — the best live offer at the invoice's branch and date, never under the lowest price —
 * and the totals, read as the member types (debounced), never worked out here. A preview is a
 * read: nothing is written until Save.
 */

/** How long the drawer waits after the last keystroke before it asks for a preview. */
const PREVIEW_DEBOUNCE_MS = 400;

/** One line of the preview, as the save would write it. */
export type InvoicePreviewLine = InvoicePreview['items'][number];

/** The preview as the drawer reads it. */
export interface DrawerPreview {
  /** The last answer — kept while the next is worked out; null before the first. */
  preview: InvoicePreview | null;
  status: InvoiceFiguresStatus;
  /**
   * A row's line in the preview — the one the server priced for this offering, quantity and
   * discount — and whether it answers what the row holds now; null when none does yet.
   */
  lineOf: (row: number) => { line: InvoicePreviewLine; current: boolean } | null;
  /** The form rows the server refused: each under its lowest price. */
  refusedRows: readonly number[];
  /** Why the preview failed, in the server's words — a refusal other than a line's floor. */
  failure: string | null;
  /** Ask again — only when asking again can help (not a 4xx). */
  retry: (() => void) | null;
}

/** What the preview asks: the save's input without "Paid now", the remark as saved. */
function previewInputOf(
  values: InvoiceFormValues,
  fallbackBranchId: string,
  invoice: InvoiceRecord | null,
): InvoiceInput | null {
  const input = invoiceInputOf(values, fallbackBranchId);
  if (input.items.length === 0 || input.branchId === '') return null;
  // Neither moves a figure: leaving them out keeps the preview from asking again as they change.
  return { ...input, paidNow: [], remark: invoice?.remark ?? null };
}

/** The input a debounced text holds again. */
const inputOfText = (text: string | null): InvoiceInput | null =>
  text === null ? null : (JSON.parse(text) as InvoiceInput);

/** Whether a preview line prices what a row holds: its offering, quantity and discount. */
function linePrices(
  line: InvoicePreviewLine | undefined,
  row: { offeringId: string; qty: number; discountPct: number },
): boolean {
  return (
    line !== undefined &&
    line.offeringId === row.offeringId &&
    line.qty === row.qty &&
    line.discountPct === Math.round(row.discountPct * 100) / 100
  );
}

/** Where the preview stands, from its query and whether the debounce has caught up. */
function statusOf({
  asked,
  settled,
  isPending,
  isPlaceholder,
  refused,
  error,
}: {
  asked: boolean;
  settled: boolean;
  isPending: boolean;
  isPlaceholder: boolean;
  refused: boolean;
  error: unknown;
}): InvoiceFiguresStatus {
  if (!asked) return 'empty';
  if (refused) return 'refused';
  if (error) return 'failed';
  if (!settled || isPending || isPlaceholder) return 'pending';
  return 'ready';
}

/**
 * The preview of the drawer's invoice — a new one (`POST /app/invoices/preview`) or a change
 * of `invoice` (`POST /app/invoices/:id/preview`) — asked {@link PREVIEW_DEBOUNCE_MS} after the
 * last change to a figure; idle when `enabled` is false (a Medical sale), with no line billed
 * or no branch yet.
 */
export function useDrawerPreview({
  values,
  invoice,
  enabled,
  fallbackBranchId,
}: {
  values: InvoiceFormValues;
  invoice: InvoiceRecord | null;
  enabled: boolean;
  fallbackBranchId: string;
}): DrawerPreview {
  const input = enabled ? previewInputOf(values, fallbackBranchId, invoice) : null;
  const text = input === null ? null : JSON.stringify(input);
  const debounced = useDebouncedValue(text, PREVIEW_DEBOUNCE_MS);
  const asked = useMemo(() => inputOfText(debounced), [debounced]);
  const query = useInvoicePreview(text === null ? null : asked, invoice);
  const rows = sentLines(values.items);
  const refusedRows = belowLowestPriceLines(query.error).flatMap((index) => {
    const row = rows[index]?.row;
    return row === undefined ? [] : [row];
  });
  const status = statusOf({
    asked: text !== null,
    settled: debounced === text,
    isPending: query.isPending,
    isPlaceholder: query.isPlaceholderData,
    refused: refusedRows.length > 0,
    error: query.error,
  });
  const preview =
    status === 'ready' || status === 'pending' ? (query.data ?? null) : null;
  const failed = status === 'failed';
  const retryable = failed && !isClientRefusal(query.error);
  return {
    preview,
    status,
    lineOf: (row) => {
      const at = rows.findIndex((sent) => sent.row === row);
      const sent = rows[at];
      const line = preview?.items[at];
      if (!(sent && line) || line.offeringId !== sent.line.offeringId) return null;
      return { line, current: status === 'ready' && linePrices(line, sent.line) };
    },
    refusedRows,
    failure: failed ? mapApiError(query.error) : null,
    retry: retryable ? () => void query.refetch() : null,
  };
}
