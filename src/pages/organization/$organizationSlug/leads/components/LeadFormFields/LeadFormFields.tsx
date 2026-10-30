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
import { Button } from '@/shared/components/ui/button.tsx';
import { Calendar, Check } from '@/shared/icons/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TEST_IDS } from '../../leads.constants.ts';
import {
  LEAD_CLOSING_STATUSES,
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
 * step a light tint of its colour, the current one ringed in its dot colour (D21), the bar's track.
 */
const TRACK_TONES: Readonly<
  Record<
    (typeof LEAD_TRACK_STATUSES)[number],
    { done: string; ring: string; bar: string }
  >
> = {
  new: { done: 'bg-tone-sky/40', ring: 'inset-ring-tone-sky-dot', bar: 'bg-tone-sky' },
  contacted: {
    done: 'bg-tone-lav/40',
    ring: 'inset-ring-tone-lav-dot',
    bar: 'bg-tone-lav',
  },
  follow_up: {
    done: 'bg-tone-butter/40',
    ring: 'inset-ring-tone-butter-dot',
    bar: 'bg-tone-butter',
  },
  appointment_scheduled: {
    done: 'bg-tone-peach/40',
    ring: 'inset-ring-tone-peach-dot',
    bar: 'bg-tone-peach',
  },
  clinic_visited: {
    done: 'bg-tone-sage/40',
    ring: 'inset-ring-tone-sage-dot',
    bar: 'bg-tone-sage',
  },
};

/**
 * Where a step of the track stands, and what a press does: `done` · `current` · `next` move the
 * lead there; `book` opens the booking (Appointment scheduled for a member who books);
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

/** One tile of the track: its mark, its label and name, its bar — and what a press does. */
function LeadTrackStep({
  step,
  index,
  at,
  status,
  booked,
  onBook,
  onChange,
}: {
  step: (typeof LEAD_TRACK_STATUSES)[number];
  index: number;
  /** The lead's place on the track (-1 off it). */
  at: number;
  status: LeadStatus;
  booked: boolean;
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
  const off = status === 'clinic_visited' || STATE_OFF.has(state);
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
        'relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 border-b px-3 py-2.5 text-start transition-colors last:border-b-0',
        '@md:grid-cols-[auto_minmax(0,1fr)] @md:items-start @md:gap-y-2 @md:border-e @md:border-b-0 @md:px-2.5 @md:pt-3 @md:pb-2.5 @md:last:border-e-0',
        // "Appointment scheduled" is the long name: its tile takes a little more of the row.
        step === 'appointment_scheduled' ? '@md:flex-[1.3]' : '@md:flex-1',
        // Done: a light tint of its colour; current: its colour, ringed — the strongest (D21).
        done && cn(TRACK_TONES[step].done, TONE_CLASSES[tone].ink),
        current && cn(TONE_CLASSES[tone].surface, 'inset-ring-2', TRACK_TONES[step].ring),
        !(done || current) && 'bg-card text-muted-foreground',
      )}
    >
      <StepMark done={done} current={current} number={index + 1} tone={tone} />
      <span className="text-tiny col-start-3 row-start-1 flex items-center gap-1 self-center font-medium tracking-[0.02em] whitespace-nowrap @md:col-start-2">
        {state === 'book' ? <Calendar aria-hidden="true" className="size-3" /> : null}
        {t(stepLabelKey(state, done))}
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
  /** The Appointment scheduled step opens the booking — absent for a member who does not book. */
  onBook?: () => void;
  /** The next booking still to happen: null for none, undefined while it loads. */
  visit?: LeadBookedVisit | null;
}

/** "Booked · Tomorrow · 11:00 am", what and with whom, Reschedule and Cancel. */
function LeadBookedVisitRow({ visit }: { visit: LeadBookedVisit }) {
  const { t } = useTranslation(LEADS_NS);
  return (
    <section
      aria-label={t(LEADS_KEYS.drawer.booking.aria)}
      data-testid={LEADS_TEST_IDS.drawerBooking}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5"
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-8 flex-none items-center justify-center rounded-lg',
          TONE_CLASSES.peach.surface,
        )}
      >
        <Calendar className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-medium [overflow-wrap:anywhere]">
          {t(LEADS_KEYS.drawer.booking.label, { when: visit.when })}
        </span>
        <span className="text-caption text-muted-foreground [overflow-wrap:anywhere]">
          {visit.what}
        </span>
      </div>
      <div className="flex flex-none items-center gap-1.5">
        {visit.onReschedule ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid={`${LEADS_TEST_IDS.drawerBooking}-reschedule`}
            onClick={visit.onReschedule}
          >
            {t(LEADS_KEYS.drawer.booking.reschedule)}
          </Button>
        ) : null}
        {visit.onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid={`${LEADS_TEST_IDS.drawerBooking}-cancel`}
            onClick={visit.onCancel}
          >
            {t(LEADS_KEYS.drawer.booking.cancel)}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Progress (`leads.md:284`, H:1809–1811): the 5-tile track New · Contacted ·
 * Follow-up · Appointment scheduled · Clinic visited — done tiles in the tone's
 * ink with a check, the current one tinted with a ringed dot, the next ones at
 * 30% with a dashed number — then the booking still to happen, then "Close as"
 * No response · Not interested · Invalid · Lost. Any status may follow any
 * (Q-L4) but the server's two: Appointment scheduled follows the person's
 * bookings (clinozy-be L11) — its tile books ("Book") for a member who books,
 * and while a booking is still to happen the earlier tiles and No response wait
 * for its cancel — and Clinic visited is the check-in's, then final (L8).
 */
export function LeadProgressField({
  status,
  onChange,
  booking = {},
}: {
  status: LeadStatus;
  onChange: (status: LeadStatus) => void;
  booking?: LeadProgressBooking;
}) {
  const { t } = useTranslation(LEADS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const at = (LEAD_TRACK_STATUSES as readonly LeadStatus[]).indexOf(status);
  const visited = status === 'clinic_visited';
  // Booked: a booking is still to happen (or still loading) — the server holds the status.
  const booked = status === 'appointment_scheduled' && booking.visit !== null;
  const label = (value: LeadStatus) => tApp(APP_KEYS.leads.statuses[value]);
  return (
    <section
      aria-label={t(LEADS_KEYS.drawer.progressAria)}
      data-slot="surface"
      className="bg-card flex-none overflow-hidden rounded-xl border"
    >
      <div className="@container border-b">
        <div className="flex flex-col @md:flex-row @md:items-stretch">
          {LEAD_TRACK_STATUSES.map((step, index) => (
            <LeadTrackStep
              key={step}
              step={step}
              index={index}
              at={at}
              status={status}
              booked={booked}
              onBook={booking.onBook}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
      {booking.visit ? <LeadBookedVisitRow visit={booking.visit} /> : null}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2.5">
        <span className="text-caption text-muted-foreground">
          {t(LEADS_KEYS.drawer.closeAs)}
        </span>
        <DrawerChips
          label={t(LEADS_KEYS.drawer.closeAs)}
          disabled={visited}
          options={LEAD_CLOSING_STATUSES.map((value) => {
            // No response is a working status: a booked lead waits for its cancel (L11).
            const held = booked && value === 'no_response';
            return {
              value,
              label: label(value),
              tone: LEAD_STATUS_TONES[value],
              ...(held
                ? { disabled: true, hint: t(LEADS_KEYS.drawer.booking.lockedHint) }
                : {}),
            };
          })}
          value={
            (LEAD_CLOSING_STATUSES as readonly LeadStatus[]).includes(status)
              ? (status as (typeof LEAD_CLOSING_STATUSES)[number])
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
  peach: 'border-tone-peach-dot',
  sage: 'border-tone-sage-dot',
};

/** The tile's 18px mark: a solid check disc in the step's dot colour, the ringed dot, or the dashed number. */
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
          'text-background flex size-4.5 flex-none items-center justify-center rounded-full',
          TONE_CLASSES[tone].dot,
        )}
      >
        <Check className="size-3" strokeWidth={3} />
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
