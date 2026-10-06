import { useTranslation } from 'react-i18next';

import { occurrenceKeys } from '@/lib/occurrence-keys.ts';
import { cn } from '@/lib/utils.ts';
import {
  VISIT_CHECKS,
  VISIT_PAYMENT_MODES,
  type VisitDetail,
  type VisitPaymentMode,
  type VisitRecord,
  type VisitRxKit,
} from '@/shared/api/clinic/visits-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { WhatsAppMark } from '@/shared/icons/index.ts';

import type { VisitFlowActions } from './use-visit-flow.ts';
import {
  VISIT_FLOW_KEYS,
  VISIT_FLOW_NS,
  VISIT_FLOW_TEST_IDS,
} from './visit-flow.constants.ts';
import { DARK_BUTTON, OUTLINE_BUTTON } from './visit-flow.ts';

const K = VISIT_FLOW_KEYS;
const ids = VISIT_FLOW_TEST_IDS;

/** Each collect mode's tone (H:766): UPI sage, Cash butter, Card sky. */
const MODE_TONES = { upi: 'sage', cash: 'butter', card: 'sky' } as const;

/** Each mode's button under the pointer: its tone at 80%. */
const MODE_PRESS = {
  upi: 'hover:bg-tone-sage/80',
  cash: 'hover:bg-tone-butter/80',
  card: 'hover:bg-tone-sky/80',
} as const;

/** Step 1 (H:762): the three safety checks, each a tile that ticks. */
export function ChecksStep({
  visit,
  onToggle,
}: {
  visit: VisitRecord;
  onToggle: VisitFlowActions['toggleCheck'];
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">
      {VISIT_CHECKS.map((check) => {
        const on = visit.checks[check];
        return (
          <button
            key={check}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => onToggle(check)}
            data-testid={ids.check(check)}
            className="bg-canvas hover:bg-muted flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-5 flex-none items-center justify-center rounded-md border-[1.5px] text-xs',
                on
                  ? 'bg-success border-success text-background'
                  : 'bg-background border-border-strong',
              )}
            >
              {on ? '✓' : ''}
            </span>
            <span className="flex flex-col">
              <span className="text-body leading-[1.3] font-medium">
                {t(K.checks.labels[check])}
              </span>
              <span className="text-caption text-muted-foreground">
                {t(K.checks.hints[check])}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Step 2 (H:763): the one-tap kits and "Write prescription". */
export function RxStep({
  kits,
  actions,
}: {
  kits: readonly VisitRxKit[];
  actions: VisitFlowActions;
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const { prescribeKit, writeRx } = actions;
  if (!(prescribeKit || writeRx)) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {prescribeKit
        ? kits.map((kit) => {
            const tone = TONE_CLASSES[kit.tone];
            return (
              <button
                key={kit.key}
                type="button"
                onClick={() => prescribeKit(kit)}
                data-testid={ids.kit}
                data-kit={kit.key}
                data-slot="pill"
                className={cn(
                  'h-6 rounded-full border border-dashed border-current px-2.5 text-xs font-medium whitespace-nowrap',
                  tone.surface,
                )}
              >
                {t(K.rx.kit, { name: kit.name })}
              </button>
            );
          })
        : null}
      {writeRx ? (
        <Button
          type="button"
          {...OUTLINE_BUTTON}
          onClick={writeRx}
          data-testid={ids.writeRx}
        >
          {t(K.rx.write)}
        </Button>
      ) : null}
    </div>
  );
}

/** Step 3 (H:764): "⚡ Repeat · …", "New treatment", the remembered settings and the package pill. */
export function TreatmentStep({
  detail,
  memo,
  actions,
}: {
  detail: VisitDetail | undefined;
  memo: string;
  actions: VisitFlowActions;
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const last = detail?.lastTreatment ?? null;
  const pack = detail?.pack ?? null;
  const usesPack = pack !== null && (detail?.treatment ?? last)?.packageId === pack.id;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.repeatTreatment && last ? (
        <Button
          type="button"
          size="sm"
          onClick={actions.repeatTreatment}
          data-testid={ids.repeat}
          className="bg-tone-lav text-tone-lav-foreground hover:bg-tone-lav/80 text-detail"
        >
          {t(K.treatment.repeat, { name: last.name, session: last.sessionNo + 1 })}
        </Button>
      ) : null}
      {actions.newTreatment ? (
        <Button
          type="button"
          {...OUTLINE_BUTTON}
          onClick={actions.newTreatment}
          data-testid={ids.newTreatment}
        >
          {t(K.treatment.new)}
        </Button>
      ) : null}
      {memo ? (
        <span className="text-muted-foreground text-xs">
          {t(K.treatment.memo, { memo })}
        </span>
      ) : null}
      {usesPack ? (
        <span
          data-slot="pill"
          className="bg-tone-lav text-tone-lav-foreground inline-flex h-6 max-w-full items-center truncate rounded-full px-2.5 text-xs font-medium tabular-nums"
        >
          {t(K.treatment.pack, { name: pack.name })}
        </span>
      ) : null}
    </div>
  );
}

/** Step 4 (H:765): the visit's lines and total, "Create invoice from visit" and "Custom invoice". */
export function InvoiceStep({
  invoice,
  actions,
}: {
  invoice: { lines: { name: string; amount: string }[]; total: string } | null;
  actions: VisitFlowActions;
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  if (!(actions.createInvoice || actions.customInvoice)) return null;
  const keys = occurrenceKeys(invoice?.lines.map((line) => line.name) ?? []);
  return (
    <div className="flex flex-col gap-2">
      {invoice ? (
        <div className="overflow-hidden rounded-xl border">
          {invoice.lines.map((line, index) => (
            <div
              key={keys[index]}
              className="text-body border-muted flex justify-between gap-3 border-b px-3 py-2"
            >
              <span className="min-w-0 break-words">{line.name}</span>
              <span className="tabular-nums">{line.amount}</span>
            </div>
          ))}
          <div className="bg-canvas text-body flex justify-between gap-3 px-3 py-2 font-semibold">
            <span>{t(K.invoice.total)}</span>
            <span className="tabular-nums">{invoice.total}</span>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {actions.createInvoice ? (
          <Button
            type="button"
            {...DARK_BUTTON}
            onClick={actions.createInvoice}
            data-testid={ids.createInvoice}
          >
            {t(K.invoice.create)}
          </Button>
        ) : null}
        {actions.customInvoice ? (
          <Button
            type="button"
            {...OUTLINE_BUTTON}
            onClick={actions.customInvoice}
            data-testid={ids.customInvoice}
          >
            {t(K.invoice.custom)}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Step 5 (H:766): collect what is due in a tap, and share the Rx, invoice and photos. */
export function CollectStep({
  due,
  modeLabel,
  actions,
}: {
  /** The oldest open invoice's due, as shown; null when nothing is due. */
  due: string | null;
  modeLabel: (mode: VisitPaymentMode) => string;
  actions: VisitFlowActions;
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const { collect } = actions;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {collect && due
        ? VISIT_PAYMENT_MODES.map((mode) => (
            <Button
              key={mode}
              type="button"
              size="sm"
              onClick={() => collect(mode)}
              data-testid={ids.collect(mode)}
              className={cn(
                'text-detail font-semibold',
                TONE_CLASSES[MODE_TONES[mode]].surface,
                MODE_PRESS[mode],
              )}
            >
              {mode === 'upi' ? t(K.collect.upi, { amount: due }) : modeLabel(mode)}
            </Button>
          ))
        : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={actions.share}
        data-testid={ids.share}
        className="border-tone-sage-border text-tone-sage-foreground hover:text-tone-sage-foreground text-detail shadow-none"
      >
        <WhatsAppMark aria-hidden="true" className="size-3.5 flex-none" />
        {t(K.collect.share)}
      </Button>
    </div>
  );
}
