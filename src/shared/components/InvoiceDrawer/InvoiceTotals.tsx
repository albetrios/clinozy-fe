import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_IDS,
} from './invoice-drawer.constants.ts';
import type { InvoiceFigures } from './invoice-figures.ts';

const K = INVOICE_DRAWER_KEYS.totals;

/** U+2212, the design's minus (KICKOFF §3.5). */
const MINUS = '−';

/** The figure shown while there is none to show: the preview refused, or failed. */
const NO_FIGURE = '—';

/** The preview behind an invoice's totals — what the caption says of them. */
export interface InvoiceTotalsPreview {
  failure: string | null;
  retry: (() => void) | null;
}

/** The caption's words for where the preview stands; none for a sale or an empty invoice. */
function captionKey(status: InvoiceFigures['status']): string | null {
  switch (status) {
    case 'ready':
      return K.preview;
    case 'pending':
      return K.pending;
    case 'refused':
      return K.refused;
    default:
      return null;
  }
}

/**
 * What the totals say of themselves on an invoice (D81 Q2): the server's figures "as the save
 * will write them", "Working out the totals…" while the preview is on its way, "Fix the marked
 * line" when it refused a line, or why it failed — with Retry when asking again can help.
 */
function TotalsCaption({
  status,
  preview,
}: {
  status: InvoiceFigures['status'];
  preview: InvoiceTotalsPreview;
}) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const key = captionKey(status);
  const failed = status === 'failed';
  if (!(key || failed)) return null;
  return (
    <p
      role={failed ? 'alert' : 'status'}
      data-testid={`${INVOICE_DRAWER_TEST_IDS.totals}-status`}
      data-status={status}
      className={cn(
        'text-tiny text-muted-foreground flex min-w-0 items-center gap-2',
        failed && TONE_CLASSES.blush.ink,
      )}
    >
      <span className="min-w-0 truncate">
        {failed ? (preview.failure ?? t(K.failed)) : t(key ?? '')}
      </span>
      {failed && preview.retry ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={preview.retry}
          data-testid={`${INVOICE_DRAWER_TEST_IDS.totals}-retry`}
        >
          {t(K.retry)}
        </Button>
      ) : null}
    </p>
  );
}

/**
 * The totals above the footer (KICKOFF §6.9 Totals; AMBER placement): Subtotal · "Discount +
 * GST" ("−₹500 · +₹1,674") · Bill · "Due after this" — blush while something is due, else sage.
 * An invoice's are the server's preview of the save, captioned as such (`preview`); a Medical
 * sale's the drawer's own sums at MRP (the server prices it on save). Four cells in a row from
 * `md`, two by two on a phone; dimmed while a new preview is on its way.
 */
export function InvoiceTotals({
  figures,
  preview = null,
}: {
  figures: InvoiceFigures;
  /** An invoice's preview — none on a sale. */
  preview?: InvoiceTotalsPreview | null;
}) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const shown = figures.status !== 'refused' && figures.status !== 'failed';
  const money = (paise: number) => (shown ? formatPaise(paise) : NO_FIGURE);
  const dueTone = figures.due > 0 ? 'blush' : 'sage';
  const cells = [
    { id: 'subtotal', label: t(K.subtotal), value: money(figures.subtotal) },
    {
      id: 'discount-gst',
      label: t(K.discountGst),
      value: shown
        ? t(K.discountGstValue, {
            discount: `${MINUS}${formatPaise(figures.discount)}`,
            gst: formatPaise(figures.gst),
          })
        : NO_FIGURE,
    },
    { id: 'bill', label: t(K.bill), value: money(figures.bill), strong: true },
    {
      id: 'due',
      label: t(K.dueAfter),
      value: money(figures.due),
      strong: true,
      ink: shown ? TONE_CLASSES[dueTone].ink : undefined,
    },
  ];
  return (
    <div
      data-testid={INVOICE_DRAWER_TEST_IDS.totals}
      className="bg-canvas flex flex-col gap-1.5 border-t px-(--drawer-pad-x) py-2.5"
    >
      {preview ? <TotalsCaption status={figures.status} preview={preview} /> : null}
      <dl
        aria-label={t(K.label)}
        aria-busy={figures.status === 'pending'}
        className={cn(
          'grid grid-cols-2 gap-x-4 gap-y-1.5 md:grid-cols-4',
          figures.status === 'pending' && 'opacity-60 transition-opacity',
        )}
      >
        {cells.map((cell) => (
          <div
            key={cell.id}
            data-testid={`${INVOICE_DRAWER_TEST_IDS.totals}-${cell.id}`}
            className="flex min-w-0 flex-col gap-0.5"
          >
            <dt className="text-tiny text-muted-foreground truncate font-semibold tracking-[0.04em] uppercase">
              {cell.label}
            </dt>
            <dd
              className={cn(
                'text-body truncate tabular-nums',
                cell.strong ? 'font-semibold' : 'font-medium',
                cell.ink,
              )}
            >
              {cell.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
