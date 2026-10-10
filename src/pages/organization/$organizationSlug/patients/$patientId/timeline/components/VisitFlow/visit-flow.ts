import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import {
  TREATMENT_LIMITS,
  type TreatmentCreateInput,
  type TreatmentRecord,
} from '@/shared/api/clinic/treatments-contracts.ts';

import { VISIT_FLOW_STEPS, type VisitFlowStep } from './visit-flow.constants.ts';

/** A 32px step button with a hairline (H:759–766): the props a `Button` spreads. */
export const OUTLINE_BUTTON = {
  variant: 'outline',
  size: 'sm',
  className: 'text-foreground hover:bg-muted text-detail shadow-none',
} as const;

/** A 32px dark step button ("✓ Complete visit"): the props a `Button` spreads. */
export const DARK_BUTTON = { size: 'sm', className: 'text-detail' } as const;

/** Where a step stands: done (✓), current (the first not done after the done ones), or later. */
export type VisitFlowStepState = 'done' | 'current' | 'later';

/**
 * Each shown step's state (H:4880–4886): a step is done by its record at the visit — the three
 * checks' notes, an Rx, a session — and the current one is the first not done whose steps before
 * it are all done. Every card stays open; only Treatment waits for the checks.
 */
export function stepStates(
  done: Readonly<Partial<Record<VisitFlowStep, boolean>>>,
): Partial<Record<VisitFlowStep, VisitFlowStepState>> {
  const states: Partial<Record<VisitFlowStep, VisitFlowStepState>> = {};
  let before = true;
  for (const step of VISIT_FLOW_STEPS) {
    const isDone = done[step];
    if (isDone === undefined) continue;
    if (isDone) states[step] = 'done';
    else states[step] = before ? 'current' : 'later';
    before = before && isDone;
  }
  return states;
}

/**
 * "Remembered for this patient: Soprano Ice · 10 J · 3 Hz · 810 nm · Type IV" (H:4875): the last
 * session's machine, power, wavelength and skin type, as its parameters hold them.
 */
export function rememberedSettings(treatment: TreatmentRecord | null): string {
  if (!treatment) return '';
  const { machine, power, wavelength, skinType } = treatment.parameters;
  return [machine, power, wavelength ? `${wavelength} nm` : null, skinType]
    .filter(Boolean)
    .join(' · ');
}

/** A package the next session can spend: active, with a session left (the server's counts). */
export function spendablePackage(
  packages: readonly PatientPackageRow[],
  packageId: string | null,
): PatientPackageRow | null {
  if (!packageId) return null;
  return (
    packages.find(
      (row) => row.id === packageId && row.status === 'active' && row.sessionsLeft > 0,
    ) ?? null
  );
}

/** The session after `last`, as the client numbers one off a package (at most the API's 999). */
export function nextSessionNumber(last: Pick<TreatmentRecord, 'sessionNumber'>): number {
  return Math.min(last.sessionNumber + 1, TREATMENT_LIMITS.session.max);
}

/**
 * "⚡ Repeat" (H:4875): the last session again at this visit, with its settings, areas and team —
 * on its package while that package can still spend a session (the server then numbers it and
 * takes its offering), else as its next session. Aftercare follows the last session's.
 */
export function repeatedSession(
  last: TreatmentRecord,
  onPackage: PatientPackageRow | null,
  appointmentId: string,
): TreatmentCreateInput {
  return {
    name: last.name,
    template: last.template,
    offeringId: last.offeringId,
    doctorId: last.doctorId,
    therapistId: last.therapistId,
    bodyParts: last.bodyParts,
    sessionNumber: nextSessionNumber(last),
    parameters: { ...last.parameters },
    remark: null,
    aftercareCall: last.aftercareCall,
    appointmentId,
    packageId: onPackage?.id ?? null,
  };
}
