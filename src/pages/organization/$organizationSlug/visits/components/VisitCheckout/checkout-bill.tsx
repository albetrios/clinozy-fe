import { useNavigate, useParams } from '@tanstack/react-router';
import { Trans, useTranslation } from 'react-i18next';

import { occurrenceKeys } from '@/lib/occurrence-keys.ts';
import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { VisitDetail } from '@/shared/api/clinic/visits-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { clinicCommandNavigation } from '@/shared/clinic/clinic-command-targets.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import type { VisitBillRow, VisitBillSummary } from '../../visits.bill.ts';
import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';

const K = VISIT_KEYS.checkout;
const ids = VISIT_TEST_IDS.checkout;

/** The room the invoice preview goes back to (`from`, KICKOFF §4: `from=/today`). */
const REFERRER = 'today';

/** A total's row: the label (12.5px, muted) and its amount. */
function TotalRow({ label, amount }: { label: string; amount: string }) {
  return (
    <>
      <span className="text-muted-foreground-strong">{label}</span>
      <span className="text-end">{amount}</span>
    </>
  );
}

/** A line's sub-line: "From pack · no charge", "Discount 10% → ₹3,150", "GST exempt". */
function LineNote({ note }: { note: VisitBillRow['note'] }) {
  const { t } = useTranslation(VISIT_NS);
  const formatPaise = usePaiseFormat();
  if (!note) return null;
  let text = t(K.gstExempt);
  if (note.kind === 'fromPack') text = t(K.fromPack);
  if (note.kind === 'discount') {
    text = t(K.lineDiscount, { pct: note.pct, amount: formatPaise(note.final) });
  }
  return <span className="text-caption text-muted-foreground-strong">{text}</span>;
}

/** The lines and the totals, from the shared money module (H:2627–2640). */
function BillLines({ bill, detail }: { bill: VisitBillSummary; detail: VisitDetail }) {
  const { t } = useTranslation([VISIT_NS, CLINIC_NS]);
  const formatPaise = usePaiseFormat();
  const owed = detail.previousDue;
  const what = owed.invoice
    ? `${t(CLINIC_KEYS.invoiceTypes[owed.invoice.type], { ns: CLINIC_NS })} ${displayId.invoiceNumber(owed.invoice.seq)}`
    : '';
  const keys = occurrenceKeys(bill.rows.map((row) => row.name));
  return (
    <div className="text-body flex flex-col tabular-nums">
      {bill.rows.map((row, index) => (
        <div
          key={keys[index]}
          data-testid={ids.line}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b py-2"
        >
          <span className="break-words">{row.name}</span>
          <span>{formatPaise(row.amount)}</span>
          <LineNote note={row.note} />
        </div>
      ))}
      <div className="text-detail grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.25 pt-2.5">
        <TotalRow label={t(K.subtotal)} amount={formatPaise(bill.afterDiscount)} />
        {bill.discount > 0 ? (
          <TotalRow label={t(K.discount)} amount={formatPaise(-bill.discount)} />
        ) : null}
        {bill.gst.map((row) => (
          <TotalRow
            key={row.rate}
            label={t(K.gst, { rate: row.rate, base: formatPaise(row.base) })}
            amount={formatPaise(row.amount)}
          />
        ))}
        {owed.amount > 0 ? (
          <TotalRow
            label={t(K.previousDue, { what })}
            amount={formatPaise(owed.amount)}
          />
        ) : null}
        <span className="font-heading border-t pt-1.5 text-sm font-semibold tracking-[-0.02em]">
          {t(K.toPay)}
        </span>
        <span className="font-heading border-t pt-1.5 text-end text-sm font-semibold tracking-[-0.02em]">
          {formatPaise(bill.toPay)}
        </span>
      </div>
    </div>
  );
}

/** Props of {@link CheckoutBill}. */
export interface CheckoutBillProps {
  detail: VisitDetail;
  bill: VisitBillSummary;
  creating: boolean;
  onCreate: () => void;
}

/**
 * Checkout's "1 · Bill" (KICKOFF §6.13; `today.md:263`; H:2625–2645): the
 * visit's lines and totals, the server note, then "Create bill" — or, once it
 * exists, "✓ <number> finalised. Changes now go through Cancel bill or Credit
 * note.", both opening the invoice's own preview (`from=today`), where those
 * actions live.
 */
export function CheckoutBill({ detail, bill, creating, onCreate }: CheckoutBillProps) {
  const { t } = useTranslation(VISIT_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { invoice } = detail;
  const empty = bill.rows.length === 0;

  const openInvoice = () => {
    if (!invoice) return;
    void navigate(
      clinicCommandNavigation('invoice', {
        organizationSlug,
        recordId: invoice.id,
        referrer: REFERRER,
      }),
    );
  };

  return (
    <div className="flex min-h-0 flex-col gap-2.5 overflow-auto px-5.5 py-4 max-md:overflow-visible max-md:px-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-heading text-base font-semibold tracking-[-0.02em]">
          {t(K.bill)}
        </h3>
        <span className="text-muted-foreground-strong text-xs">{t(K.billSub)}</span>
      </div>
      {empty ? (
        <p className="text-body text-muted-foreground-strong">{t(K.nothing)}</p>
      ) : (
        <BillLines bill={bill} detail={detail} />
      )}
      <p className="text-caption text-muted-foreground-strong">{t(K.serverNote)}</p>
      {invoice ? (
        <p
          data-testid={ids.made}
          className="text-body bg-tone-sage border-tone-sage-border text-tone-sage-foreground rounded-lg border px-3 py-2.25"
        >
          <Trans
            t={t}
            i18nKey={K.finalised}
            values={{ number: displayId.invoiceNumber(invoice.seq) }}
            components={{
              cancel: (
                <button
                  type="button"
                  onClick={openInvoice}
                  className="underline underline-offset-2"
                />
              ),
              credit: (
                <button
                  type="button"
                  onClick={openInvoice}
                  className="underline underline-offset-2"
                />
              ),
            }}
          />
        </p>
      ) : (
        <button
          type="button"
          aria-disabled={empty || creating}
          onClick={empty ? undefined : onCreate}
          data-testid={ids.create}
          className={cn(
            'hover:bg-muted rounded-lg border bg-transparent px-3.5 py-2.5 text-sm font-medium shadow-(--elevation-control) max-md:min-h-11',
            empty && 'cursor-not-allowed opacity-55',
          )}
        >
          {creating ? t(K.creating) : t(K.create)}
        </button>
      )}
    </div>
  );
}
