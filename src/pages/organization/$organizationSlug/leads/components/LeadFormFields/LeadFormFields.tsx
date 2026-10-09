import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type {
  LeadInterest,
  LeadSource,
  LeadStatus,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  LEAD_INTEREST_TONES,
  LEAD_SOURCE_TONES,
  LEAD_STATUS_TONES,
  TONE_CLASSES,
} from '@/shared/clinic/clinic-tones.ts';
import { DrawerChips } from '@/shared/components/DrawerField/index.ts';
import { Check } from '@/shared/icons/index.ts';

import { LEADS_KEYS, LEADS_NS } from '../../leads.constants.ts';
import {
  LEAD_INTEREST_CHIPS,
  LEAD_SOURCE_ICONS,
  LEAD_SOURCE_ORDER,
} from '../LeadFields/lead-display.ts';

/** The four steps of the track, in order (H:1810); the rest close the lead. */
const MAIN_STATUSES = [
  'new',
  'contacted',
  'follow_up',
  'clinic_visited',
] as const satisfies readonly LeadStatus[];

/** "Close as" (H:1811). */
const CLOSING_STATUSES = [
  'no_response',
  'not_interested',
  'invalid',
  'lost',
] as const satisfies readonly LeadStatus[];

/** A drawer card (H:1768, H:1809, H:1813): a 24px number circle — green once filled — and the title. */
export function LeadCard({
  label,
  number,
  done,
  children,
}: {
  label: string;
  /** The circle's number; none for Info. */
  number?: number;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      data-slot="surface"
      className="bg-card flex flex-none flex-col overflow-hidden rounded-xl border"
    >
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        {number === undefined ? null : (
          <span
            aria-hidden="true"
            data-slot="pill"
            className={cn(
              'text-tiny flex size-6 flex-none items-center justify-center rounded-full font-semibold tabular-nums',
              done
                ? 'bg-success text-success-foreground'
                : 'bg-foreground text-background',
            )}
          >
            {number}
          </span>
        )}
        {/* 13.5px/600 (H:1768) — `text-field`; there is no `text-body-lg` step. */}
        <h3 className="text-field font-semibold">{label}</h3>
      </div>
      <div className="flex flex-col gap-2.5 px-4 pb-4">{children}</div>
    </section>
  );
}

/** A field inside a card: the 12px label over its control. */
export function LeadField({
  label,
  action,
  children,
}: {
  label: string;
  /** Pills at the label's inline end ("Claim", "Release"). */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-muted-foreground-strong flex flex-wrap items-center gap-1.5 text-xs font-medium">
        {label}
        {action ? (
          <span className="ms-auto flex items-center gap-1.5">{action}</span>
        ) : null}
      </span>
      {children}
    </div>
  );
}

/** Source (`leads.md:63`): one chip, each with its icon in its tone. */
export function LeadSourceField({
  value,
  onChange,
}: {
  value: LeadSource | null;
  onChange: (source: LeadSource) => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  return (
    <LeadField label={t(LEADS_KEYS.drawer.source)}>
      <DrawerChips
        label={t(LEADS_KEYS.drawer.source)}
        options={LEAD_SOURCE_ORDER.map((source) => ({
          value: source,
          label: tClinic(CLINIC_KEYS.leads.sources[source]),
          tone: LEAD_SOURCE_TONES[source],
          icon: LEAD_SOURCE_ICONS[source],
        }))}
        value={value}
        onChange={(source) => {
          if (source) onChange(source);
        }}
      />
    </LeadField>
  );
}

/**
 * Interested in (`leads.md:64`): Clinical · Peel · LHR · Hydrafacial · PRP · Others, picked
 * chips with a check. The design's "Add interest" went with the backend — it keeps no typed
 * interest (route map §4); "Others" stands for them.
 */
export function LeadInterestsField({
  value,
  onChange,
}: {
  value: readonly LeadInterest[];
  onChange: (value: LeadInterest[]) => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  return (
    <LeadField label={t(LEADS_KEYS.drawer.interests)}>
      <DrawerChips
        multiple
        label={t(LEADS_KEYS.drawer.interests)}
        options={LEAD_INTEREST_CHIPS.map((interest) => ({
          value: interest,
          label: tClinic(CLINIC_KEYS.leads.interests[interest]),
          tone: LEAD_INTEREST_TONES[interest],
        }))}
        value={[...value]}
        onChange={onChange}
      />
    </LeadField>
  );
}

/** The track's tiles in each step's tone, as literals (`bg-tone-${tone}` is never generated). */
const TRACK_TONES: Readonly<
  Record<(typeof MAIN_STATUSES)[number], { next: string; bar: string }>
> = {
  new: { next: 'bg-tone-sky/30', bar: 'bg-tone-sky' },
  contacted: { next: 'bg-tone-lav/30', bar: 'bg-tone-lav' },
  follow_up: { next: 'bg-tone-butter/30', bar: 'bg-tone-butter' },
  clinic_visited: { next: 'bg-tone-sage/30', bar: 'bg-tone-sage' },
};

/** Where a step of the track stands. */
type StepState = 'done' | 'current' | 'byCheckIn' | 'next';

/** A step's state: done, current, the check-in's own (Clinic visited, not yet), or next. */
function stepStateOf({
  done,
  current,
  byCheckIn,
}: {
  done: boolean;
  current: boolean;
  byCheckIn: boolean;
}): StepState {
  if (done) return 'done';
  if (current) return 'current';
  return byCheckIn ? 'byCheckIn' : 'next';
}

/** Each state's tooltip. */
const STEP_TIP_KEYS: Readonly<Record<StepState, string>> = {
  done: LEADS_KEYS.drawer.stepTips.done,
  current: LEADS_KEYS.drawer.stepTips.current,
  byCheckIn: LEADS_KEYS.drawer.stepTips.byCheckIn,
  next: LEADS_KEYS.drawer.stepTips.next,
};

/** Each state's label over the step's name. */
const STEP_LABEL_KEYS: Readonly<Record<Exclude<StepState, 'byCheckIn'>, string>> = {
  done: LEADS_KEYS.drawer.steps.done,
  current: LEADS_KEYS.drawer.steps.current,
  next: LEADS_KEYS.drawer.steps.next,
};

/**
 * Progress (`leads.md:284`, H:1809–1811): the 4-tile track New · Contacted ·
 * Follow-up · Clinic visited — done tiles in the tone's ink with a check,
 * the current one tinted with a ringed dot, the next ones at 30% with a dashed
 * number — then "Close as" No response · Not interested · Invalid · Lost. Any
 * status may follow any (Q-L4) but Clinic visited: a check-in sets it, and then
 * it is final (L8) — its tile never picks, and a visited lead's track only shows.
 */
export function LeadProgressField({
  status,
  onChange,
}: {
  status: LeadStatus;
  onChange: (status: LeadStatus) => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const at = (MAIN_STATUSES as readonly LeadStatus[]).indexOf(status);
  const visited = status === 'clinic_visited';
  const label = (value: LeadStatus) => tClinic(CLINIC_KEYS.leads.statuses[value]);
  return (
    <section
      aria-label={t(LEADS_KEYS.drawer.progressAria)}
      data-slot="surface"
      className="bg-card flex-none overflow-hidden rounded-xl border"
    >
      <div className="flex items-stretch border-b">
        {MAIN_STATUSES.map((step, index) => {
          const tone = TONE_OF[step];
          const done = at > index;
          const current = at === index;
          const name = label(step);
          const byCheckIn = step === 'clinic_visited' && !current;
          const state = stepStateOf({ done, current, byCheckIn });
          const tip = t(STEP_TIP_KEYS[state], { status: name });
          const stepLabel = t(STEP_LABEL_KEYS[state === 'byCheckIn' ? 'next' : state]);
          return (
            <button
              key={step}
              type="button"
              title={tip}
              aria-pressed={current}
              disabled={visited || byCheckIn}
              onClick={() => onChange(step)}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-start gap-2 border-e px-3 pt-3 pb-2.5 text-start transition-colors last:border-e-0',
                done && TONE_CLASSES[tone].fill,
                current && TONE_CLASSES[tone].surface,
                !(done || current) && cn(TRACK_TONES[step].next, TONE_CLASSES[tone].ink),
              )}
            >
              <span className="flex max-w-full min-w-0 items-center gap-1.5">
                <StepMark done={done} current={current} number={index + 1} tone={tone} />
                <span className="text-tiny font-medium tracking-[0.02em] whitespace-nowrap">
                  {stepLabel}
                </span>
              </span>
              <span
                className={cn(
                  'text-body leading-tight [overflow-wrap:anywhere]',
                  current ? 'font-semibold' : 'font-medium',
                )}
              >
                {name}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-x-0 bottom-0 h-0.75',
                  TRACK_TONES[step].bar,
                )}
              >
                <span
                  className={cn(
                    'block h-full',
                    TONE_CLASSES[tone].dot,
                    done && 'w-full',
                    current && 'w-1/2',
                    !(done || current) && 'w-0',
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
        <span className="text-caption text-muted-foreground">
          {t(LEADS_KEYS.drawer.closeAs)}
        </span>
        <DrawerChips
          label={t(LEADS_KEYS.drawer.closeAs)}
          disabled={visited}
          options={CLOSING_STATUSES.map((value) => ({
            value,
            label: label(value),
            tone: LEAD_STATUS_TONES[value],
          }))}
          value={
            (CLOSING_STATUSES as readonly LeadStatus[]).includes(status)
              ? (status as (typeof CLOSING_STATUSES)[number])
              : null
          }
          onChange={(value) => {
            if (value) onChange(value);
          }}
        />
      </div>
    </section>
  );
}

const TONE_OF = LEAD_STATUS_TONES;

/** The track's dot-coloured edges (the ringed dot, the dashed number), as literals. */
const TONE_BORDERS: Readonly<Partial<Record<Tone, string>>> = {
  sky: 'border-tone-sky-dot',
  lav: 'border-tone-lav-dot',
  butter: 'border-tone-butter-dot',
  sage: 'border-tone-sage-dot',
};

/** The tile's 18px mark: a check disc, the ringed dot, or the dashed number. */
function StepMark({
  done,
  current,
  number,
  tone,
}: {
  done: boolean;
  current: boolean;
  number: number;
  tone: Tone;
}) {
  if (done) {
    return (
      <span
        aria-hidden="true"
        data-slot="pill"
        className={cn(
          'bg-background flex size-4.5 flex-none items-center justify-center rounded-full',
          TONE_CLASSES[tone].ink,
        )}
      >
        <Check className="size-3" />
      </span>
    );
  }
  if (current) {
    return (
      <span
        aria-hidden="true"
        data-slot="pill"
        className={cn(
          'bg-background flex size-4.5 flex-none items-center justify-center rounded-full border-2',
          TONE_CLASSES[tone].halo,
          TONE_BORDERS[tone],
        )}
      >
        <span className={cn('size-2 rounded-full', TONE_CLASSES[tone].dot)} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-slot="pill"
      className={cn(
        'bg-background text-tiny flex size-4.5 flex-none items-center justify-center rounded-full border-[1.5px] border-dashed font-semibold tabular-nums',
        TONE_BORDERS[tone],
      )}
    >
      {number}
    </span>
  );
}
