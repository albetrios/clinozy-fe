import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type {
  LeadInterest,
  LeadSource,
  LeadStatus,
  Tone,
} from '@/shared/api/app/app-schema.ts';
import { LEAD_CLOSED_STATUSES } from '@/shared/api/app/leads-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import {
  LEAD_INTEREST_TONES,
  LEAD_SOURCE_TONES,
  LEAD_STATUS_TONES,
  TONE_CLASSES,
} from '@/shared/app/app-tones.ts';
import { DrawerChips } from '@/shared/components/DrawerField/index.ts';
import { Calendar, Check } from '@/shared/icons/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import {
  LEAD_INTEREST_CHIPS,
  LEAD_SOURCE_ICONS,
  LEAD_SOURCE_ORDER,
  LEAD_TRACK_STATUSES,
} from '../LeadFields/lead-display.ts';

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
  const { t: tApp } = useTranslation(APP_NS);
  return (
    <LeadField label={t(LEADS_KEYS.drawer.source)}>
      <DrawerChips
        label={t(LEADS_KEYS.drawer.source)}
        options={LEAD_SOURCE_ORDER.map((source) => ({
          value: source,
          label: tApp(APP_KEYS.leads.sources[source]),
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
  const { t: tApp } = useTranslation(APP_NS);
  return (
    <LeadField label={t(LEADS_KEYS.drawer.interests)}>
      <DrawerChips
        multiple
        label={t(LEADS_KEYS.drawer.interests)}
        options={LEAD_INTEREST_CHIPS.map((interest) => ({
          value: interest,
          label: tApp(APP_KEYS.leads.interests[interest]),
          tone: LEAD_INTEREST_TONES[interest],
        }))}
        value={[...value]}
        onChange={onChange}
      />
    </LeadField>
  );
}

/**
 * The track's tiles in each step's tone, as literals (`bg-tone-${tone}` is never generated): a done
 * step a light tint of its colour (D21), and the bar's track. No borders (D25): the current step is
 * its full colour.
 */
const TRACK_TONES: Readonly<
  Record<(typeof LEAD_TRACK_STATUSES)[number], { done: string; bar: string }>
> = {
  new: { done: 'bg-tone-sky/40', bar: 'bg-tone-sky' },
  contacted: { done: 'bg-tone-lav/40', bar: 'bg-tone-lav' },
  follow_up: { done: 'bg-tone-butter/40', bar: 'bg-tone-butter' },
  appointment_scheduled: { done: 'bg-tone-peach/40', bar: 'bg-tone-peach' },
  clinic_visited: { done: 'bg-tone-sage/40', bar: 'bg-tone-sage' },
};

/**
 * Where a step of the track stands, and what a press does: `done` · `current` · `next` move the
 * lead there; `book` opens the booking (Booked for a member who books);
 * `byBooking` and `byCheckIn` are the server's steps (the booking's, the check-in's); `locked` is
 * a booked lead's earlier step — the booking holds it (clinozy-be L11).
 */
type StepState =
  'done' | 'current' | 'next' | 'book' | 'byBooking' | 'byCheckIn' | 'locked';

/** Each state's tooltip. */
const STEP_TIP_KEYS: Readonly<Record<StepState, string>> = {
  done: LEADS_KEYS.drawer.stepTips.done,
  current: LEADS_KEYS.drawer.stepTips.current,
  next: LEADS_KEYS.drawer.stepTips.next,
  book: LEADS_KEYS.drawer.stepTips.book,
  byBooking: LEADS_KEYS.drawer.stepTips.byBooking,
  byCheckIn: LEADS_KEYS.drawer.stepTips.byCheckIn,
  locked: LEADS_KEYS.drawer.stepTips.locked,
};

/** The step's own state, before what its position on the track says. */
function serverStepState({
  step,
  status,
  booked,
  canBook,
}: {
  step: (typeof LEAD_TRACK_STATUSES)[number];
  status: LeadStatus;
  booked: boolean;
  canBook: boolean;
}): StepState | null {
  if (step === status) return null;
  if (step === 'clinic_visited') return 'byCheckIn';
  if (step === 'appointment_scheduled') {
    // A closed lead is not booked from here: a booking moves an open lead only (L11).
    const open = !(LEAD_CLOSED_STATUSES as readonly LeadStatus[]).includes(status);
    return canBook && open ? 'book' : 'byBooking';
  }
  return booked ? 'locked' : null;
}

/** A step's state: the server's own, else done, current or next by where the lead is. */
function stepStateOf(options: {
  step: (typeof LEAD_TRACK_STATUSES)[number];
  index: number;
  at: number;
  status: LeadStatus;
  booked: boolean;
  canBook: boolean;
}): StepState {
  const own = serverStepState(options);
  if (own === 'locked' || own === 'book') return own;
  if (options.at > options.index) return 'done';
  if (options.at === options.index) return 'current';
  return own ?? 'next';
}

/** The states whose tile does not press: the server's steps and a booked lead's earlier ones. */
const STATE_OFF: ReadonlySet<StepState> = new Set(['byBooking', 'byCheckIn', 'locked']);

/** The small label over a step's name. */
function stepLabelKey(state: StepState, done: boolean): string {
  if (done) return LEADS_KEYS.drawer.steps.done;
  if (state === 'current') return LEADS_KEYS.drawer.steps.current;
  if (state === 'book') return LEADS_KEYS.drawer.steps.book;
  return LEADS_KEYS.drawer.steps.next;
}

/** A tile's look by where it stands (D21, D25): a done tint, the current colour, the next muted. */
function trackStepLook({
  step,
  done,
  current,
}: {
  step: (typeof LEAD_TRACK_STATUSES)[number];
  done: boolean;
  current: boolean;
}): string {
  const tone = TONE_OF[step];
  if (done) return cn(TRACK_TONES[step].done, TONE_CLASSES[tone].ink);
  if (current) return TONE_CLASSES[tone].surface;
  return 'bg-muted/50 text-muted-foreground';
}

/** The small label over a tile's name: none on a closed lead, the current step's own, else its state. */
function trackStepLabel({
  closed,
  current,
  currentLabel,
  label,
}: {
  closed: boolean;
  current: boolean;
  currentLabel: string | undefined;
  label: string;
}): string | null {
  if (closed) return null;
  if (current && currentLabel) return currentLabel;
  return label;
}

/** One tile of the track: its mark, its label and name, its bar — and what a press does. */
function LeadTrackStep({
  step,
  index,
  at,
  status,
  booked,
  closed,
  currentLabel,
  readOnly,
  onBook,
  onChange,
}: {
  step: (typeof LEAD_TRACK_STATUSES)[number];
  index: number;
  /** The lead's place on the track (-1 off it). */
  at: number;
  status: LeadStatus;
  booked: boolean;
  /** Not interested, Invalid or Lost: the steps carry no state — the Next step card names it. */
  closed: boolean;
  /** The current step's small label in place of "Current" — its follow-up time, "No answer". */
  currentLabel?: string;
  readOnly: boolean;
  onBook?: () => void;
  onChange: (status: LeadStatus) => void;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const tone = TONE_OF[step];
  const done = at > index;
  const current = at === index;
  const name = tApp(APP_KEYS.leads.statuses[step]);
  const state = stepStateOf({
    step,
    index,
    at,
    status,
    booked,
    canBook: onBook !== undefined,
  });
  const off = readOnly || status === 'clinic_visited' || STATE_OFF.has(state);
  return (
    <button
      type="button"
      title={t(STEP_TIP_KEYS[state], { status: name })}
      aria-pressed={current}
      disabled={off}
      data-testid={`${LEADS_TEST_IDS.drawerStep}-${step}`}
      onClick={state === 'book' ? onBook : () => onChange(step)}
      className={cn(
        // Narrow (a phone): one row per step — mark, name, state. From 28rem: the row of tiles.
        // No borders between or around them (D25): tint and spacing set them apart.
        'relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 overflow-hidden rounded-lg px-3 py-2.5 text-start transition-colors',
        '@md:grid-cols-[auto_minmax(0,1fr)] @md:items-start @md:gap-y-2 @md:px-2.5 @md:pt-3 @md:pb-3.5',
        '@md:flex-1',
        trackStepLook({ step, done, current }),
      )}
    >
      <StepMark done={done} current={current} number={index + 1} tone={tone} />
      <span className="text-tiny col-start-3 row-start-1 flex items-center gap-1 self-center font-medium tracking-[0.02em] whitespace-nowrap @md:col-start-2">
        {state === 'book' && !closed ? (
          <Calendar aria-hidden="true" className="size-3" />
        ) : null}
        {trackStepLabel({
          closed,
          current,
          currentLabel,
          label: t(stepLabelKey(state, done)),
        })}
      </span>
      <span
        className={cn(
          'text-body col-start-2 row-start-1 leading-tight [overflow-wrap:anywhere] hyphens-auto @md:col-span-2 @md:col-start-1 @md:row-start-2',
          current ? 'font-semibold' : 'font-medium',
        )}
      >
        {name}
      </span>
      <span
        aria-hidden="true"
        className={cn('absolute inset-x-0 bottom-0 h-0.75', TRACK_TONES[step].bar)}
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
}

/** The person's next booking still to happen, as Progress shows it (clinozy-be L11). */
export interface LeadBookedVisit {
  /** "Tomorrow · 11:00 am". */
  when: string;
  /** "Consultation · Dr Mehta". */
  what: string;
  /** Another slot for it — absent without Appointments Edit. */
  onReschedule?: () => void;
  /** Cancel it — the lead goes back to Follow-up; absent without Appointments Edit. */
  onCancel?: () => void;
}

/** What Progress books and shows of the person's bookings (clinozy-be L11). */
export interface LeadProgressBooking {
  /** The Booked step opens the booking — absent for a member who does not book. */
  onBook?: () => void;
  /** The next booking still to happen: null for none, undefined while it loads. */
  visit?: LeadBookedVisit | null;
}

/**
 * Progress (`leads.md:284`, H:1809–1811; D25): the 5-tile track New · Contacted · Follow-up ·
 * Booked · Clinic visited — done tiles a light tint with a check, the current one in
 * its full colour, the next ones muted with their number; no borders — then the Next step card the
 * drawer passes. No response sits on the Follow-up step ("No answer"); Not interested, Invalid and
 * Lost leave the steps without a state. Any status may follow any (Q-L4) but the server's two:
 * Booked follows the person's bookings (clinozy-be L11) — its tile books ("Book")
 * for a member who books, and while a booking is still to happen the earlier tiles wait for its
 * cancel — and Clinic visited is the check-in's, then final (L8).
 */
export function LeadProgressField({
  status,
  onChange,
  booking = {},
  currentLabel,
  nextStep,
  readOnly = false,
}: {
  status: LeadStatus;
  onChange: (status: LeadStatus) => void;
  /** Without Edit the track only shows. */
  readOnly?: boolean;
  booking?: LeadProgressBooking;
  /** The current step's label in place of "Current" — the follow-up time, "No answer". */
  currentLabel?: string;
  /** The Next step card under the track (D25). */
  nextStep?: ReactNode;
}) {
  const { t } = useTranslation(LEADS_NS);
  // No response is still being followed up: it sits on the Follow-up step.
  const place = status === 'no_response' ? 'follow_up' : status;
  const at = (LEAD_TRACK_STATUSES as readonly LeadStatus[]).indexOf(place);
  // Booked: a booking is still to happen (or still loading) — the server holds the status.
  const booked = status === 'appointment_scheduled' && booking.visit !== null;
  const closed = at === -1;
  return (
    <section
      aria-label={t(LEADS_KEYS.drawer.progressAria)}
      className="flex flex-none flex-col gap-2.5"
    >
      <div className="@container">
        <div className="flex flex-col gap-1 @md:flex-row @md:items-stretch">
          {LEAD_TRACK_STATUSES.map((step, index) => (
            <LeadTrackStep
              key={step}
              step={step}
              index={index}
              at={at}
              status={status}
              booked={booked}
              closed={closed}
              currentLabel={currentLabel}
              readOnly={readOnly}
              onBook={booking.onBook}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
      {nextStep}
    </section>
  );
}

const TONE_OF = LEAD_STATUS_TONES;

/** The tile's 18px mark — filled, never outlined (D25): a check disc, the dot, or the number. */
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
  if (done || current) {
    return (
      <span
        aria-hidden="true"
        data-slot="pill"
        className={cn(
          'text-background flex size-4.5 flex-none items-center justify-center rounded-full',
          TONE_CLASSES[tone].dot,
        )}
      >
        {done ? (
          <Check className="size-3" strokeWidth={3} />
        ) : (
          <span data-slot="pill" className="bg-background size-1.5 rounded-full" />
        )}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-slot="pill"
      className="bg-muted text-muted-foreground text-tiny flex size-4.5 flex-none items-center justify-center rounded-full font-semibold tabular-nums"
    >
      {number}
    </span>
  );
}
