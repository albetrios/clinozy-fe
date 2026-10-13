import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { INVOICE_STATUS_TONES } from '@/shared/app/app-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useInvoiceList, useInvoiceTotals } from '@/shared/hooks/useInvoices/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { Eye, EyeOff, Receipt } from '@/shared/icons/index.ts';

import { useTableDay } from '../../../shared/components/PatientSectionTable/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import {
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';
import { BentoCard, BentoReadState, BentoRow } from './bento-card.tsx';
import type { BentoRead } from './bento-read.ts';

/** How many invoices the card lists (H:4996 `slice(0, 3)`). */
const LISTED = 3;

const K = TIMELINE_KEYS.billing;

/** The masked file's eye on the Due tile: its label, its state and its toggle. */
interface MoneyEye {
  label: string;
  shown: boolean;
  onToggle: () => void;
}

/** Due or Paid (H:776): its label over the amount, Due tinted while something is owed. */
function MoneyTile({
  label,
  amount,
  owed = false,
  eye,
  testId,
}: {
  label: string;
  amount: string;
  owed?: boolean;
  eye?: MoneyEye;
  testId: string;
}) {
  const Eyes = eye?.shown ? EyeOff : Eye;
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-lg p-2.5',
        owed ? 'bg-destructive-tint' : 'bg-canvas',
      )}
    >
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        <span
          dir="auto"
          data-testid={testId}
          className={cn(
            'text-[length:calc(var(--text-base)*15/16)] font-semibold tabular-nums',
            owed && 'text-tone-blush-foreground',
          )}
        >
          {amount}
        </span>
        {eye ? (
          <button
            type="button"
            onClick={eye.onToggle}
            aria-label={eye.label}
            aria-pressed={eye.shown}
            title={eye.label}
            data-testid={`${TIMELINE_TEST_IDS.card('billing')}-eye`}
            className="text-muted-foreground hover:bg-foreground/5 flex size-5.5 items-center justify-center rounded-md transition-colors"
          >
            <Eyes aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** Props of {@link BillingBentoCard}. */
export interface BillingBentoCardProps {
  /** "Open Invoices" — the section, for a member who may open it. */
  onOpen: (() => void) | null;
  /** "New invoice" — the head's plus, for a member who may bill (`payment:create`). */
  onNew: { label: string; run: () => void } | null;
  /** A listed invoice: Edit invoice, or its preview. */
  onInvoice: (invoice: InvoiceRecord) => void;
  /** "Collect payment" — Receive for the patient, for a member who may (`payment:create`). */
  onCollect: (() => void) | null;
}

/**
 * The card's reads — the server's totals over every invoice of hers and her newest invoices — as
 * one state: loading while either is out, failed when either failed with nothing to show, and
 * Retry reading both again.
 */
function useBillingReads(patientId: string) {
  const totals = useInvoiceTotals({ patientId });
  const invoices = useInvoiceList({ patientId });
  const failed =
    (totals.isError && !totals.data) || (invoices.isError && invoices.rows.length === 0);
  const read: BentoRead = {
    isPending: totals.isPending || invoices.isPending,
    isError: failed,
    isSuccess: totals.isSuccess && !invoices.isPending && !invoices.isError,
    retry: () => {
      void totals.refetch();
      invoices.refetch();
    },
  };
  return {
    read,
    ready: !(read.isPending || failed),
    totals: totals.data ?? null,
    rows: invoices.rows.slice(0, LISTED),
  };
}

/** Her newest invoices — "Clinic invoice #1042" over "24 Sep · ₹ ••••", the server's status. */
function BillingRows({
  rows,
  money,
  onInvoice,
  testId,
}: {
  rows: readonly InvoiceRecord[];
  money: (rupees: number) => string;
  onInvoice: (invoice: InvoiceRecord) => void;
  testId: string;
}) {
  const { t } = useTranslation([TIMELINE_NS, APP_NS]);
  const day = useTableDay();
  return (
    <div className="flex flex-col">
      {rows.map((invoice) => (
        <BentoRow
          key={invoice.id}
          title={t(K.invoice, {
            type: t(APP_KEYS.invoiceTypes[invoice.type], { ns: APP_NS }),
            number: displayId.invoiceNumber(invoice.seq),
          })}
          sub={t(K.sub, { date: day(invoice.date, true), amount: money(invoice.total) })}
          tag={{
            label: t(APP_KEYS.invoiceStatuses[invoice.status], { ns: APP_NS }),
            tone: INVOICE_STATUS_TONES[invoice.status],
          }}
          onClick={() => onInvoice(invoice)}
          testId={`${testId}-row`}
        />
      ))}
    </div>
  );
}

/**
 * Billing (H:776, H:4996–4997) on clinozy-be: "New invoice"; Due — masked with the file, its
 * eye — and Paid, the server's over every invoice of hers (`meta.due_total`,
 * `meta.paid_total`; never summed here); her newest three invoices (`GET
 * /app/invoices?patient_id=`, the Invoices section's first page) — "Clinic invoice #1042",
 * "24 Sep · ₹ ••••", the server's status — each opening the invoice; "Collect payment" while
 * she owes; the server's count beside the title. Its reads load in place with bars, fail in
 * place with Retry, and say "No invoices yet".
 */
export function BillingBentoCard({
  onOpen,
  onNew,
  onInvoice,
  onCollect,
}: BillingBentoCardProps) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId, masked, toggleMasked } = usePatientFileContext();
  const formatRupees = useRupeeFormat();
  const { read, ready, totals, rows } = useBillingReads(patientId);
  const title = t(TIMELINE_KEYS.cards.billing);
  const testId = TIMELINE_TEST_IDS.card('billing');
  const money = (rupees: number) => (masked ? t(K.masked) : formatRupees(rupees));
  const shown = ready ? totals : null;
  const due = shown?.due ?? 0;

  return (
    <BentoCard
      card="billing"
      title={title}
      icon={Receipt}
      count={totals?.count}
      onNew={onNew}
      onOpen={onOpen}
    >
      {shown ? (
        <div className="grid grid-cols-2 gap-2">
          <MoneyTile
            label={t(K.due)}
            amount={money(due)}
            owed={due > 0}
            eye={{
              label: t(masked ? K.show : K.hide),
              shown: !masked,
              onToggle: toggleMasked,
            }}
            testId={`${testId}-due`}
          />
          <MoneyTile
            label={t(K.paid)}
            amount={money(shown.paid)}
            testId={`${testId}-paid`}
          />
        </div>
      ) : null}
      {ready && rows.length > 0 ? (
        <BillingRows rows={rows} money={money} onInvoice={onInvoice} testId={testId} />
      ) : null}
      {due > 0 && onCollect ? (
        <Button
          type="button"
          onClick={onCollect}
          data-testid={`${testId}-collect`}
          className="text-body h-9 w-full rounded-lg"
        >
          {t(K.collect)}
        </Button>
      ) : null}
      <BentoReadState
        read={read}
        empty={!ready || rows.length === 0}
        label={title}
        emptyTitle={t(K.empty)}
        testId={testId}
      />
    </BentoCard>
  );
}
