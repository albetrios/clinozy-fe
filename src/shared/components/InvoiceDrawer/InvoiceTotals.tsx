import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_IDS,
} from './invoice-drawer.constants.ts';
import type { InvoiceDraftFigures } from './invoice-form.ts';

const K = INVOICE_DRAWER_KEYS.totals;

/** U+2212, the design's minus (KICKOFF §3.5). */
const MINUS = '−';

/**
 * The draft's totals above the footer (KICKOFF §6.9 Totals; AMBER placement):
 * Subtotal · "Discount + GST" ("−₹500 · +₹1,674") · Bill · "Due after this" —
 * blush while something is due, else sage. The prototype computes them and
 * never shows them (H:5067, §7.3). Four cells in a row from `md`, two by two
 * on a phone.
 */
export function InvoiceTotals({ figures }: { figures: InvoiceDraftFigures }) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const { totals, balance } = figures;
  const discount = totals.lineDiscount + totals.overallDiscount;
  const cells = [
    {
      id: 'subtotal',
      label: t(K.subtotal),
      value: formatPaise(Math.round(totals.subtotal)),
    },
    {
      id: 'discount-gst',
      label: t(K.discountGst),
      value: t(K.discountGstValue, {
        discount: `${MINUS}${formatPaise(Math.round(discount))}`,
        gst: formatPaise(Math.round(totals.gst)),
      }),
    },
    { id: 'bill', label: t(K.bill), value: formatPaise(totals.bill), strong: true },
    {
      id: 'due',
      label: t(K.dueAfter),
      value: formatPaise(balance.due),
      strong: true,
      ink: TONE_CLASSES[balance.due > 0 ? 'blush' : 'sage'].ink,
    },
  ];
  return (
    <dl
      aria-label={t(K.label)}
      data-testid={INVOICE_DRAWER_TEST_IDS.totals}
      className="bg-canvas grid grid-cols-2 gap-x-4 gap-y-1.5 border-t px-(--drawer-pad-x) py-2.5 md:grid-cols-4"
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
  );
}
