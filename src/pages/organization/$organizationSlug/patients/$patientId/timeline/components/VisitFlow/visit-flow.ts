import { invoiceTotals } from '@/shared/api/clinic/clinic-money.ts';
import type { Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import type { TreatmentInput } from '@/shared/api/clinic/treatments-api.ts';
import type {
  VisitDetail,
  VisitPack,
  VisitRecord,
} from '@/shared/api/clinic/visits-contracts.ts';

import { VISIT_FLOW_STEPS, type VisitFlowStep } from './visit-flow.constants.ts';

/** A 32px step button with a hairline (H:759–766): the props a `Button` spreads. */
export const OUTLINE_BUTTON = {
  variant: 'outline',
  size: 'sm',
  className: 'text-foreground hover:bg-muted text-detail shadow-none',
} as const;

/** A 32px dark step button ("✓ Complete visit", "Create invoice from visit"): the props a `Button` spreads. */
export const DARK_BUTTON = { size: 'sm', className: 'text-detail' } as const;

/** Where a step stands: done (✓), current (the first not done after the done ones), or later. */
export type VisitFlowStepState = 'done' | 'current' | 'later';

/**
 * Each step's state (H:4880–4886): a step is done by its record — the checks
 * all ticked, an Rx and a session written at the visit, its invoice, the
 * share — and the current one is the first not done whose steps before it are
 * all done. Every card stays open; only Treatment waits for the checks.
 */
export function stepStates(
  visit: Pick<VisitRecord, 'checks' | 'sharedAt'>,
  detail: Pick<VisitDetail, 'prescription' | 'treatment' | 'invoice'> | undefined,
): Readonly<Record<VisitFlowStep, VisitFlowStepState>> {
  const done: Readonly<Record<VisitFlowStep, boolean>> = {
    checks: Object.values(visit.checks).every(Boolean),
    rx: Boolean(detail?.prescription),
    treatment: Boolean(detail?.treatment),
    invoice: Boolean(detail?.invoice),
    collect: visit.sharedAt !== null,
  };
  const states = {} as Record<VisitFlowStep, VisitFlowStepState>;
  let before = true;
  for (const step of VISIT_FLOW_STEPS) {
    if (done[step]) states[step] = 'done';
    else states[step] = before ? 'current' : 'later';
    before = before && done[step];
  }
  return states;
}

/**
 * "Remembered for this patient: Soprano Ice · 10 J · 3 Hz · 810 nm · Type IV"
 * (H:4875): the last session's machine, power, wavelength and skin type.
 */
export function rememberedSettings(treatment: Treatment | null): string {
  if (!treatment) return '';
  const { machine, power, wavelength, skinType } = treatment.params;
  return [machine, power, wavelength ? `${wavelength} nm` : null, skinType]
    .filter(Boolean)
    .join(' · ');
}

/** The visit's bill as the Invoice step shows it: the lines' finals and the total, in paise. */
export function flowInvoice(detail: Pick<VisitDetail, 'billLines'>): {
  lines: { name: string; amount: number }[];
  total: number;
  /** Every line comes out of a package — "Covered by package · nothing to bill". */
  covered: boolean;
} {
  const lines = detail.billLines.map((line) => ({
    name: line.name,
    amount: invoiceTotals({ items: [line], overallDiscount: 0 }).bill,
  }));
  return {
    lines,
    total: invoiceTotals({ items: detail.billLines, overallDiscount: 0 }).bill,
    covered:
      detail.billLines.length > 0 && detail.billLines.every((line) => line.fromPack),
  };
}

/**
 * "⚡ Repeat" (H:4875): the last session again at this visit, one session on,
 * with its settings, areas and team — on its package only while that package
 * still has a session left.
 */
export function repeatedSession(
  last: Treatment,
  pack: VisitPack | null,
  at: Pick<TreatmentInput, 'patientId' | 'appointmentId' | 'performedAt'>,
): TreatmentInput {
  const onPack =
    pack !== null && pack.id === last.packageId && pack.sessionsUsed < pack.sessionsTotal;
  return {
    ...at,
    offeringId: last.offeringId,
    name: last.name,
    template: last.template,
    doctorId: last.doctorId,
    therapistId: last.therapistId,
    bodyParts: last.bodyParts,
    sessionNo: last.sessionNo + 1,
    params: { ...last.params },
    remark: null,
    aftercareCall: last.aftercareCall,
    packageId: onPack ? pack.id : null,
  };
}
