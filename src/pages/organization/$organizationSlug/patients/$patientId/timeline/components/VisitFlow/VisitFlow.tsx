import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { invoiceTotals } from '@/shared/api/clinic/clinic-money.ts';
import type { VisitDetail, VisitRecord } from '@/shared/api/clinic/visits-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { useOpenInvoices } from '@/shared/hooks/usePayments/index.ts';
import { useVisitCatalog, useVisitDetail } from '@/shared/hooks/useVisits/index.ts';

import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import { TIMELINE_KEYS } from '../../timeline.constants.ts';
import {
  ChecksStep,
  CollectStep,
  InvoiceStep,
  RxStep,
  TreatmentStep,
} from './flow-steps.tsx';
import { useVisitFlowActions } from './use-visit-flow.ts';
import {
  VISIT_FLOW_KEYS,
  VISIT_FLOW_NS,
  VISIT_FLOW_STEPS,
  VISIT_FLOW_TEST_IDS,
  type VisitFlowStep,
} from './visit-flow.constants.ts';
import {
  DARK_BUTTON,
  flowInvoice,
  OUTLINE_BUTTON,
  rememberedSettings,
  stepStates,
  type VisitFlowStepState,
} from './visit-flow.ts';

const K = VISIT_FLOW_KEYS;
const ids = VISIT_FLOW_TEST_IDS;

/** A step's number circle (26px): green ✓ done, dark current, grey later. */
const MARK: Readonly<Record<VisitFlowStepState, string>> = {
  done: 'bg-success text-background',
  current: 'bg-primary text-primary-foreground',
  later: 'bg-border text-muted-foreground-strong',
};

/** One step's card (H:760–761): the circle, the title over the status line, and its controls. */
function StepCard({
  step,
  index,
  state,
  status,
  children,
}: {
  step: VisitFlowStep;
  index: number;
  state: VisitFlowStepState;
  status: string;
  children: ReactNode;
}) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  return (
    <section
      aria-labelledby={`${ids.step(step)}-title`}
      data-testid={ids.step(step)}
      data-state={state}
      className={cn(
        'bg-background flex flex-col gap-2.5 rounded-xl border p-3.5',
        state === 'current' && 'border-primary',
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          data-slot="pill"
          className={cn(
            'flex size-6.5 flex-none items-center justify-center rounded-full text-xs font-semibold',
            MARK[state],
          )}
        >
          {state === 'done' ? '✓' : index + 1}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <h3
            id={`${ids.step(step)}-title`}
            className="text-sm leading-[1.3] font-semibold"
          >
            {t(K.steps[step])}
          </h3>
          <span className="text-muted-foreground truncate text-xs leading-[1.3]">
            {status}
          </span>
        </span>
      </div>
      {children}
    </section>
  );
}

/** Treatment's status: today's session once recorded, else the last settings, else the ask. */
function treatmentStatus(t: TFunction, detail: VisitDetail | undefined): string {
  if (detail?.treatment) {
    const { name, sessionNo } = detail.treatment;
    return t(K.treatment.done, { name, session: sessionNo });
  }
  const memo = rememberedSettings(detail?.lastTreatment ?? null);
  return memo ? t(K.treatment.last, { memo }) : t(K.treatment.empty);
}

/** Invoice's status: the invoice once made, else what is ready to bill, else why nothing is. */
function invoiceStatus(
  t: TFunction,
  detail: VisitDetail | undefined,
  money: (paise: number) => string,
): string {
  if (!detail) return t(K.invoice.empty);
  if (detail.invoice) {
    return t(K.invoice.done, {
      number: displayId.invoiceNumber(detail.invoice.seq),
      total: money(invoiceTotals(detail.invoice).bill),
    });
  }
  const bill = flowInvoice(detail);
  if (bill.total > 0) {
    return t(K.invoice.ready, { count: bill.lines.length, total: money(bill.total) });
  }
  return bill.covered ? t(K.invoice.covered) : t(K.invoice.empty);
}

/** Each step's status line (H:4881–4885). */
function useStatuses(
  visit: VisitRecord,
  detail: VisitDetail | undefined,
  money: (paise: number) => string,
  due: number,
): Readonly<Record<VisitFlowStep, string>> {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const left = Object.values(visit.checks).filter((on) => !on).length;
  let collect = t(K.collect.nothing);
  if (visit.sharedAt) collect = t(K.collect.sent);
  else if (due > 0) collect = t(K.collect.due, { amount: money(due) });
  return {
    checks: left === 0 ? t(K.checks.done) : t(K.checks.left, { count: left }),
    rx: detail?.prescription
      ? detail.prescription.items.map((item) => item.medicineName).join(', ')
      : t(K.rx.empty),
    treatment: treatmentStatus(t, detail),
    invoice: invoiceStatus(t, detail, money),
    collect,
  };
}

/**
 * The patient file's visit flow (KICKOFF §6.6 Visit flow, D18; H:758–768,
 * H:4871–4898; `patient-file.md:92–101, 392–404`) on `timeline?visit=open`:
 * one column up to 880px — "Visit in progress", Pause and "✓ Complete visit",
 * then five step cards, all open, the first unfinished one current: Check-in &
 * safety, Prescription, Treatment (waits for the checks), Invoice, Collect &
 * share. Today's "Open session" and "Checkout" open it (`from=today`, L-64);
 * the records written here move Today's card on.
 */
export function VisitFlow({ visit }: { visit: VisitRecord }) {
  const { t } = useTranslation([VISIT_FLOW_NS, CLINIC_NS]);
  const { patientId, file, masked } = usePatientFileContext();
  const formatPaise = usePaiseFormat();
  const detail = useVisitDetail(visit.id).data;
  const kits = useVisitCatalog().data?.kits ?? [];
  const oldest = useOpenInvoices(patientId).data?.[0] ?? null;
  const actions = useVisitFlowActions(visit, detail);
  const money = (paise: number) =>
    masked ? t(TIMELINE_KEYS.billing.masked) : formatPaise(paise);
  const states = stepStates(visit, detail);
  const statuses = useStatuses(visit, detail, money, file?.due ?? 0);
  const bill = detail && !detail.invoice ? flowInvoice(detail) : null;
  const invoiceList =
    bill && bill.lines.length > 0
      ? {
          lines: bill.lines.map((line) => ({
            name: line.name,
            amount: money(line.amount),
          })),
          total: money(bill.total),
        }
      : null;
  const bodies: Readonly<Record<VisitFlowStep, ReactNode>> = {
    checks: <ChecksStep visit={visit} onToggle={actions.toggleCheck} />,
    rx: <RxStep kits={kits} actions={actions} />,
    treatment: (
      <TreatmentStep
        detail={detail}
        memo={rememberedSettings(detail?.lastTreatment ?? null)}
        actions={actions}
      />
    ),
    invoice: <InvoiceStep invoice={invoiceList} actions={actions} />,
    collect: (
      <CollectStep
        due={oldest && oldest.due > 0 ? money(oldest.due) : null}
        modeLabel={(mode) => t(CLINIC_KEYS.paymentModes[mode], { ns: CLINIC_NS })}
        actions={actions}
      />
    ),
  };

  return (
    <div
      data-testid={ids.root}
      className="animate-reveal flex max-w-[880px] flex-col gap-2.5 px-(--table-pad-x) pt-4 pb-6"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          data-slot="pill"
          className="bg-tone-sage text-tone-sage-foreground inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap"
        >
          <span aria-hidden="true" className="bg-success size-1.75 rounded-full" />
          {t(K.pill)}
        </span>
        <span className="text-body text-muted-foreground-strong">{t(K.lead)}</span>
        <span className="flex-1 max-md:hidden" />
        <div className="flex gap-2 max-md:basis-full">
          <button
            type="button"
            onClick={actions.pause}
            data-testid={ids.pause}
            className={OUTLINE_BUTTON}
          >
            {t(K.pause)}
          </button>
          <button
            type="button"
            onClick={actions.complete}
            data-testid={ids.complete}
            className={DARK_BUTTON}
          >
            {t(K.complete)}
          </button>
        </div>
      </div>
      {VISIT_FLOW_STEPS.map((step, index) => (
        <StepCard
          key={step}
          step={step}
          index={index}
          state={states[step]}
          status={statuses[step]}
        >
          {bodies[step]}
        </StepCard>
      ))}
    </div>
  );
}
