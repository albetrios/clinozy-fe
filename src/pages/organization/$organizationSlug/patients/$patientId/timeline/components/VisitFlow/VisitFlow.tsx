import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import type { VisitRecord } from '@/shared/api/clinic/visits-contracts.ts';
import { Button } from '@/shared/components/ui/button.tsx';

import { ChecksStep, RxStep, StepRetry, TreatmentStep } from './flow-steps.tsx';
import {
  useVisitFlow,
  type VisitFlowRead,
  type VisitFlowRecords,
} from './use-visit-flow.ts';
import {
  VISIT_FLOW_KEYS,
  VISIT_FLOW_NS,
  VISIT_FLOW_STEPS,
  VISIT_FLOW_TEST_IDS,
  type VisitFlowStep,
} from './visit-flow.constants.ts';
import {
  DARK_BUTTON,
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

/** A step's status while its read is loading or failed; null once it has answered. */
function readStatus(t: TFunction, read: VisitFlowRead<unknown>): string | null {
  if (read.isError) return t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS });
  if (read.isLoading) return t(LOCALE_KEYS.loading, { ns: LOCALE_NS });
  return null;
}

/** Each shown step's status line (H:4881–4885) and whether it is done. */
function useSteps(records: VisitFlowRecords) {
  const { t } = useTranslation([VISIT_FLOW_NS, ERRORS_NS, LOCALE_NS]);
  const status: Partial<Record<VisitFlowStep, string>> = {};
  const done: Partial<Record<VisitFlowStep, boolean>> = {};
  const { checks, prescription, treatment } = records;
  if (checks) {
    const left = checks.data
      ? Object.values(checks.data).filter((note) => note === null).length
      : null;
    done.checks = left === 0;
    status.checks =
      readStatus(t, checks) ??
      (left === 0 ? t(K.checks.done) : t(K.checks.left, { count: left ?? 0 }));
  }
  if (prescription) {
    done.rx = Boolean(prescription.data);
    status.rx =
      readStatus(t, prescription) ??
      (prescription.data
        ? prescription.data.items.map((item) => item.medicineName).join(', ')
        : t(K.rx.empty));
  }
  if (treatment) {
    const session = treatment.data;
    const memo = rememberedSettings(records.lastTreatment);
    done.treatment = Boolean(session);
    let line = memo ? t(K.treatment.last, { memo }) : t(K.treatment.empty);
    if (session) {
      line = t(K.treatment.done, { name: session.name, session: session.sessionNumber });
    }
    status.treatment = readStatus(t, treatment) ?? line;
  }
  return { status, states: stepStates(done) };
}

/**
 * The patient file's visit flow (KICKOFF §6.6 Visit flow; H:758–768, H:4871–4898;
 * `patient-file.md:92–101, 392–404`) on `timeline?visit=open`, on the patient's booking checked
 * in today: one column up to 880px — "Visit in progress" (or paused), Pause / Resume and "✓
 * Complete visit", then the step cards, all open, the first unfinished one current: Check-in &
 * safety, Prescription, Treatment (waits for the checks). Each shows for a member who may read
 * its records, its controls for one who may write them. Invoice and "Collect & share" come back
 * with Payments (D152); the share goes (§6 #26).
 */
export function VisitFlow({ visit }: { visit: VisitRecord }) {
  const { t } = useTranslation(VISIT_FLOW_NS);
  const { records, actions } = useVisitFlow(visit);
  const { status, states } = useSteps(records);
  const paused = visit.pausedAt !== null;
  const bodies: Readonly<Record<VisitFlowStep, ReactNode>> = {
    checks: records.checks?.data ? (
      <ChecksStep checks={records.checks.data} actions={actions} />
    ) : null,
    rx: <RxStep kits={records.kits} actions={actions} />,
    treatment: (
      <TreatmentStep
        records={records}
        memo={rememberedSettings(records.lastTreatment)}
        actions={actions}
      />
    ),
  };
  const reads = {
    checks: records.checks,
    rx: records.prescription,
    treatment: records.treatment,
  } satisfies Record<VisitFlowStep, VisitFlowRead<unknown> | undefined>;
  const shown = VISIT_FLOW_STEPS.filter((step) => reads[step] !== undefined);

  return (
    <div
      data-testid={ids.root}
      className="animate-reveal flex max-w-[880px] flex-col gap-2.5 px-(--table-pad-x) pt-4 pb-6"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          data-slot="pill"
          className={cn(
            'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
            paused
              ? 'bg-tone-butter text-tone-butter-foreground'
              : 'bg-tone-sage text-tone-sage-foreground',
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              'size-1.75 rounded-full',
              paused ? 'bg-tone-butter-dot' : 'bg-success',
            )}
          />
          {t(paused ? K.paused : K.pill)}
        </span>
        <span className="text-body text-muted-foreground-strong">{t(K.lead)}</span>
        <span className="flex-1 max-md:hidden" />
        <div className="flex gap-2 max-md:basis-full">
          {actions.pause ? (
            <Button
              type="button"
              {...OUTLINE_BUTTON}
              onClick={actions.pause}
              data-testid={ids.pause}
            >
              {t(K.pause)}
            </Button>
          ) : null}
          {actions.resume ? (
            <Button
              type="button"
              {...OUTLINE_BUTTON}
              onClick={actions.resume}
              data-testid={ids.resume}
            >
              {t(K.resume)}
            </Button>
          ) : null}
          {actions.complete ? (
            <Button
              type="button"
              {...DARK_BUTTON}
              onClick={actions.complete}
              data-testid={ids.complete}
            >
              {t(K.complete)}
            </Button>
          ) : null}
        </div>
      </div>
      {shown.map((step, index) => {
        const read = reads[step];
        return (
          <StepCard
            key={step}
            step={step}
            index={index}
            state={states[step] ?? 'later'}
            status={status[step] ?? ''}
          >
            {read?.isError ? (
              <StepRetry step={step} onRetry={read.retry} />
            ) : (
              bodies[step]
            )}
          </StepCard>
        );
      })}
    </div>
  );
}
