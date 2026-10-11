import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import type { PrescriptionKit } from '@/shared/api/app/prescriptions-contracts.ts';
import { VISIT_CHECKS, type VisitChecks } from '@/shared/api/app/visits-contracts.ts';
import { TONE_CLASSES, toneForLabel } from '@/shared/app/app-tones.ts';
import { Button } from '@/shared/components/ui/button.tsx';

import type { VisitFlowActions, VisitFlowRecords } from './use-visit-flow.ts';
import {
  VISIT_FLOW_KEYS,
  VISIT_FLOW_NS,
  VISIT_FLOW_TEST_IDS,
  type VisitFlowStep,
} from './visit-flow.constants.ts';
import { DARK_BUTTON, nextSessionNumber, OUTLINE_BUTTON } from './visit-flow.ts';

const K = VISIT_FLOW_KEYS;
const ids = VISIT_FLOW_TEST_IDS;

/** A step whose read failed: its Retry, in place of its controls. */
export function StepRetry({
  step,
  onRetry,
}: {
  step: VisitFlowStep;
  onRetry: () => void;
}) {
  const { t } = useTranslation(ERRORS_NS);
  return (
    <div>
      <Button
        type="button"
        {...OUTLINE_BUTTON}
        onClick={onRetry}
        data-testid={ids.retry(step)}
      >
        {t(ERRORS_KEYS.widget.retry)}
      </Button>
    </div>
  );
}

/**
 * Step 1 (H:762): the three safety checks, each a tile that ticks — read-only for a member who
 * may not write the patient's clinical record, waiting while its write is in flight.
 */
export function ChecksStep({
  checks,
  actions,
}: {
  checks: VisitChecks;
  actions: Pick<VisitFlowActions, 'toggleCheck' | 'checkSaving'>;
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const { toggleCheck, checkSaving } = actions;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">
      {VISIT_CHECKS.map((check) => {
        const on = checks[check] !== null;
        const saving = checkSaving(check);
        return (
          <button // NOSONAR(S6819): styled-button checkbox; a native checkbox input cannot hold this two-line tile
            key={check}
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-busy={saving || undefined}
            disabled={!toggleCheck || saving}
            onClick={() => toggleCheck?.(check)}
            data-testid={ids.check(check)}
            className="bg-canvas hover:bg-muted disabled:hover:bg-canvas flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-start disabled:cursor-default"
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

/** Step 2 (H:763): the member's one-tap kits and "Write prescription". */
export function RxStep({
  kits,
  actions,
}: {
  kits: readonly PrescriptionKit[];
  actions: Pick<VisitFlowActions, 'prescribeKit' | 'writeRx'>;
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const { prescribeKit, writeRx } = actions;
  if (!(prescribeKit || writeRx)) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {prescribeKit
        ? kits.map((kit) => (
            <button
              key={kit.id}
              type="button"
              onClick={() => prescribeKit(kit)}
              data-testid={ids.kit}
              data-kit={kit.id}
              data-slot="pill"
              className={cn(
                'h-6 rounded-full border border-dashed border-current px-2.5 text-xs font-medium whitespace-nowrap',
                // A kit has no tone of its own on the API: its name picks one.
                TONE_CLASSES[toneForLabel(kit.name)].surface,
              )}
            >
              {t(K.rx.kit, { name: kit.name })}
            </button>
          ))
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
  records,
  memo,
  actions,
}: {
  records: Pick<VisitFlowRecords, 'lastTreatment' | 'pack'>;
  memo: string;
  actions: Pick<VisitFlowActions, 'repeatTreatment' | 'newTreatment'>;
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const { lastTreatment: last, pack } = records;
  let repeatLabel = '';
  if (last) {
    repeatLabel = pack
      ? t(K.treatment.repeatPackage, { name: last.name })
      : t(K.treatment.repeat, { name: last.name, session: nextSessionNumber(last) });
  }
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
          {repeatLabel}
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
      {pack ? (
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

/**
 * Step 4 (H:765; D156): "Create invoice from visit" — the Invoice drawer on the visit's sessions
 * still to bill, priced by the server there — and "Custom invoice", until the visit has its
 * invoice; nothing for a member who may not bill.
 */
export function InvoiceStep({
  actions,
}: {
  actions: Pick<VisitFlowActions, 'createInvoice' | 'customInvoice'>;
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const { createInvoice, customInvoice } = actions;
  if (!(createInvoice || customInvoice)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {createInvoice ? (
        <Button
          type="button"
          {...DARK_BUTTON}
          onClick={createInvoice}
          data-testid={ids.createInvoice}
        >
          {t(K.invoice.create)}
        </Button>
      ) : null}
      {customInvoice ? (
        <Button
          type="button"
          {...OUTLINE_BUTTON}
          onClick={customInvoice}
          data-testid={ids.customInvoice}
        >
          {t(K.invoice.custom)}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Step 5 (H:766; D156): "Collect ₹1,500" — Receive payment against the visit's invoice while it
 * owes (the share goes, §6 #26); nothing once it is paid or for a member who may not collect.
 */
export function CollectStep({
  due,
  onCollect,
}: {
  /** What the visit's invoice still owes, as shown (masked with the file); null when nothing. */
  due: string | null;
  onCollect: VisitFlowActions['collect'];
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  if (!(onCollect && due)) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        {...DARK_BUTTON}
        onClick={onCollect}
        data-testid={ids.collect}
      >
        {t(K.collect.action, { amount: due })}
      </Button>
    </div>
  );
}
