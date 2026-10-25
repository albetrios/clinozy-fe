import './auth-showcase.css';

import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PRODUCT_NAME } from '@/lib/product-identity.ts';
import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { rememberedBranchHours } from '@/shared/app/branch-hours.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar.tsx';
import { Check, Lock, Pause, Play } from '@/shared/icons/index.ts';

import {
  AUTH_SHOWCASE_KEYS as K,
  AUTH_SHOWCASE_NS,
  AUTH_SHOWCASE_TEST_IDS,
  TOUR_CHAPTERS,
  TOUR_LANE_COUNTS,
  TOUR_PATIENT,
  TOUR_STAFF,
  TOUR_STATUS_TONES,
  TOUR_STORY,
  TOUR_VISITS_AFTER,
  TOUR_VISITS_BEFORE,
  TOUR_VISITS_TODAY,
  type TourStatus,
  type TourVisit,
} from './auth-showcase.constants.ts';
import {
  addMinutes,
  buildTourDay,
  isInTourHours,
  type TourDay,
  type TourSheetDay,
} from './tour-day.ts';
import { useTourFormat } from './tour-format.ts';
import { TourLens } from './TourLens.tsx';
import { useTour } from './useTour.ts';

/** How often the now line re-reads the clock. */
const CLOCK_TICK_MS = 15_000;

/** Riya's booking, worded for the day the sheet shows. */
const APPOINTMENTS_TITLES: Readonly<Record<TourSheetDay, string>> = {
  today: K.chapters.appointments.title,
  tomorrow: K.chapters.appointmentsTomorrow,
  later: K.chapters.appointmentsLater,
};

/** The open slot's words, for the day the sheet shows. */
const FREE_SLOT_KEYS: Readonly<Record<TourSheetDay, string>> = {
  today: K.sheet.freeToday,
  tomorrow: K.sheet.freeTomorrow,
  later: K.sheet.freeLater,
};

/** The viewer's clock, re-read every {@link CLOCK_TICK_MS}: the now line keeps their time. */
function useViewerClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * The sign-in stage: one patient's day through the clinic, told in seven
 * chapters — Leads, Appointments, Front desk, Patient file, Treatment,
 * Payments, Tasks — each with its feature shown working beside her row on a
 * Today sheet set to the viewer's own clock and this device's branch hours
 * (closed, its next opening's).
 *
 * @remarks
 * Decorative but not silent: the sheet is one image with a name, the narration
 * is text, and the step buttons and the pause button are real controls. It
 * plays on its own only where `autoplay` says (the first sign-in screen), never
 * under reduced motion, and holds still while the viewer is busy elsewhere
 * ({@link useTour}).
 */
export function AuthShowcaseStage({
  autoplay,
  className,
}: {
  autoplay: boolean;
  className?: string;
}) {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const titleId = useId();
  const tour = useTour({ autoplay });
  const { chapter, announce, live, run, attachStage } = tour;
  const now = useViewerClock();
  // This device's branch (the one last worked in here), read once per visit.
  const [hours] = useState(rememberedBranchHours);
  const day = buildTourDay(now, hours);
  return (
    <aside
      ref={attachStage}
      aria-labelledby={titleId}
      data-testid={AUTH_SHOWCASE_TEST_IDS.stage}
      className={cn('tour-stage', className)}
    >
      <div className="tour-copy">
        <span className="tour-kicker">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5 flex-none">
            <circle
              cx="10"
              cy="10"
              r="7.6"
              fill="none"
              strokeWidth="4"
              className="stroke-current"
            />
            <circle cx="10" cy="10" r="3" className="fill-brand-mark-strong" />
          </svg>
          {t(K.kicker)}
        </span>
        <h2 id={titleId} className="tour-title">
          {t(K.title)}
        </h2>
        <TourBar tour={tour} />
        <TourNarration chapter={chapter} announce={announce} day={day} now={now} />
      </div>
      <TourSheet chapter={chapter} live={live} run={run} day={day} now={now} />
    </aside>
  );
}

/** The seven step buttons (story bars that fill as a chapter plays) and the pause button. */
function TourBar({ tour }: { tour: ReturnType<typeof useTour> }) {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const steps = TOUR_CHAPTERS.length;
  return (
    <div className="tour-bar" data-testid={AUTH_SHOWCASE_TEST_IDS.tour}>
      <fieldset className="tour-steps">
        <legend className="sr-only">{t(K.tour.steps, { steps })}</legend>
        {TOUR_CHAPTERS.map((chapter, index) => (
          <button
            key={chapter.id}
            ref={tour.attachStep(index)}
            type="button"
            className="tour-step"
            aria-label={t(K.tour.step, {
              step: index + 1,
              steps,
              room: t(K.chapters[chapter.id].room),
            })}
            aria-current={index === tour.chapter ? 'step' : undefined}
            data-testid={AUTH_SHOWCASE_TEST_IDS.step(index)}
            onClick={() => tour.goTo(index)}
          >
            <span data-slot="pill" className="tour-step-track" />
            <span data-slot="pill" className="tour-step-fill" />
          </button>
        ))}
      </fieldset>
      {tour.autoplay ? (
        <button
          type="button"
          data-slot="pill"
          className="tour-toggle"
          aria-label={t(tour.playing ? K.tour.pause : K.tour.play)}
          data-testid={AUTH_SHOWCASE_TEST_IDS.toggle}
          onClick={tour.togglePlaying}
        >
          {tour.playing ? (
            <Pause aria-hidden="true" className="size-3 fill-current" />
          ) : (
            <Play aria-hidden="true" className="size-3 fill-current" />
          )}
        </button>
      ) : null}
    </div>
  );
}

/**
 * The chapter's room, headline and one line. Narrated (`aria-live="polite"`)
 * only after the viewer picked the chapter; an automatic change is silent.
 */
function TourNarration({
  chapter,
  announce,
  day,
  now,
}: {
  chapter: number;
  announce: boolean;
  day: TourDay;
  now: Date;
}) {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const format = useTourFormat();
  const current = TOUR_CHAPTERS[chapter] ?? TOUR_CHAPTERS[0];
  if (!current) return null;
  const keys = K.chapters[current.id];
  const titles: Record<typeof current.id, string> = {
    leads: t(keys.title, { time: format.time(now) }),
    appointments: t(APPOINTMENTS_TITLES[day.sheetDay], {
      time: format.time(day.slot),
      weekday: format.weekday(day.slot),
    }),
    frontDesk: t(keys.title),
    patientFile: t(keys.title),
    treatment: t(keys.title),
    payments: t(keys.title, { amount: format.money(format.bill) }),
    tasks: t(keys.title, { weekday: format.weekday(day.followUp) }),
  };
  return (
    <div
      className="tour-narration"
      aria-live={announce ? 'polite' : 'off'}
      data-testid={AUTH_SHOWCASE_TEST_IDS.narration}
    >
      <div key={current.id} className="tour-narration-in">
        <span className={cn('tour-room', TONE_CLASSES[current.tone].ink)}>
          <span
            aria-hidden="true"
            className={cn('size-2 rounded-full', TONE_CLASSES[current.tone].dot)}
          />
          {t(keys.room)}
        </span>
        <p className="tour-headline">{titles[current.id]}</p>
        <p className="tour-body">{t(keys.body)}</p>
      </div>
    </div>
  );
}

/** A staff member's avatar and name, as a Today row draws them. */
function TourStaffCell({ staff }: { staff: keyof typeof TOUR_STAFF }) {
  const person = TOUR_STAFF[staff];
  return (
    <span className="tour-staff">
      <Avatar size="sm" className="size-6">
        <AvatarFallback
          className={cn(
            'text-[0.65625rem] font-semibold',
            TONE_CLASSES[person.tone].surface,
          )}
        >
          {person.initials}
        </AvatarFallback>
      </Avatar>
      <span dir="auto" className="truncate">
        {person.name}
      </span>
    </span>
  );
}

/** A visit's status pill — the dashed free-slot pill for `open`. */
function TourStatusPill({ status, label }: { status: TourStatus; label: string }) {
  if (status === 'open') {
    return (
      <span data-slot="pill" className="tour-free">
        {label}
      </span>
    );
  }
  const tone = TOUR_STATUS_TONES[status];
  return (
    <TonePill
      tone={tone}
      dot={status === 'paid' ? false : 'tone'}
      icon={
        status === 'paid' ? <Check aria-hidden="true" className="size-3" /> : undefined
      }
      className={cn('border', TONE_CLASSES[tone].border)}
    >
      {label}
    </TonePill>
  );
}

/**
 * The Today sheet: the day and its live state, the lanes with their counts,
 * Riya's row among five others and the now line — one named image to
 * assistive technology (its words are the narration's).
 */
function TourSheet({
  chapter,
  live,
  run,
  day,
  now,
}: {
  chapter: number;
  live: boolean;
  /** The arrival count: the lens remounts, and so replays, on each. */
  run: number;
  day: TourDay;
  now: Date;
}) {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const format = useTourFormat();
  const current = TOUR_CHAPTERS[chapter] ?? TOUR_CHAPTERS[0];
  if (!current) return null;
  const counts = day.open ? TOUR_LANE_COUNTS[current.id] : ([0, 0, 0, 0] as const);
  const lanes = [
    K.sheet.tabs.waiting,
    K.sheet.tabs.withDoctor,
    K.sheet.tabs.inTreatment,
    K.sheet.tabs.done,
  ];

  const statusLabel = (status: TourStatus) => {
    if (status === 'followUp') {
      return t(K.sheet.status.followUp, { weekday: format.weekdayShort(day.followUp) });
    }
    if (status === 'waitingFor') {
      return t(K.sheet.status.waitingFor, { minutes: format.number(6) });
    }
    return t(K.sheet.status[status]);
  };

  const drawn = (visit: TourVisit) => isInTourHours(day, addMinutes(day.base, visit.at));
  const visitRow = (visit: TourVisit) => {
    const status = day.open ? visit.status : 'booked';
    return (
      <li key={visit.patient} className="tour-visit">
        <span className="tour-time">{format.time(addMinutes(day.base, visit.at))}</span>
        <span className="tour-who">
          <span className="tour-name">
            <bdi>{visit.patient}</bdi>
          </span>
          <span className="tour-what">{t(K.sheet.visits[visit.visit])}</span>
        </span>
        <TourStaffCell staff={visit.staff} />
        <span className="tour-status">
          <TourStatusPill status={status} label={statusLabel(status)} />
        </span>
      </li>
    );
  };

  const story = TOUR_STORY[current.id];
  const freeSlot = t(FREE_SLOT_KEYS[day.sheetDay], { weekday: format.weekday(day.slot) });
  return (
    <div // NOSONAR(S6819): a drawn Today sheet of many decorative parts, named once — an <img> cannot hold them
      role="img"
      aria-label={t(K.sheet.label, { productName: PRODUCT_NAME })}
      className="tour-glimpse"
      data-testid={AUTH_SHOWCASE_TEST_IDS.sheet}
    >
      <div className="tour-glimpse-frame" aria-hidden="true">
        <div data-slot="surface" className="tour-day">
          <div className="tour-day-head">
            <div className="tour-day-title">
              {day.sheetDay === 'later' ? (
                <>
                  <b>{format.weekday(day.base)}</b>
                  <span>{format.dayMonth(day.base)}</span>
                </>
              ) : (
                <>
                  <b>{t(day.sheetDay === 'today' ? K.sheet.today : K.sheet.tomorrow)}</b>
                  <span>{format.longDate(day.base)}</span>
                </>
              )}
            </div>
            <span className={cn('tour-live', !day.open && 'is-closed')}>
              <span className="tour-live-dot" />
              {t(day.open ? K.sheet.live : K.sheet.closed)}
            </span>
          </div>
          <div className="tour-tabs">
            <span className="tour-tab is-on">
              {t(K.sheet.tabs.all)} <b>{format.number(TOUR_VISITS_TODAY)}</b>
            </span>
            {lanes.map((lane, index) => (
              <span key={lane} className="tour-tab">
                {t(lane)}{' '}
                <b key={`${current.id}-${counts[index]}`} className="tour-count">
                  {format.number(counts[index] ?? 0)}
                </b>
              </span>
            ))}
          </div>
          <ol className="tour-rows">
            {TOUR_VISITS_BEFORE.filter(drawn).map(visitRow)}
            {day.open ? (
              <li className="tour-now">
                <span>{format.time(now)}</span>
              </li>
            ) : null}
            <li
              className={cn('tour-visit tour-story', story.open && 'is-open')}
              data-tone={story.open ? undefined : current.tone}
              data-testid={AUTH_SHOWCASE_TEST_IDS.story}
              data-chapter={current.id}
            >
              <span className="tour-time">{format.time(day.slot)}</span>
              <span className="tour-who">
                <span key={`name-${story.open}`} className="tour-name tour-swap">
                  {story.open ? t(K.sheet.openSlot) : <bdi>{TOUR_PATIENT.name}</bdi>}
                </span>
                <span
                  key={`what-${story.open}-${story.visit}`}
                  className="tour-what tour-swap"
                >
                  {story.open ? freeSlot : t(K.sheet.visits[story.visit])}
                </span>
              </span>
              {story.open ? (
                <span />
              ) : (
                <span key={`staff-${story.staff}`} className="tour-swap">
                  <TourStaffCell staff={story.staff} />
                </span>
              )}
              <span key={`status-${story.status}`} className="tour-status tour-swap">
                <TourStatusPill status={story.status} label={statusLabel(story.status)} />
              </span>
              <TourLens
                key={`${current.id}-${run}`}
                chapter={current.id}
                live={live}
                day={day}
                now={now}
              />
            </li>
            {TOUR_VISITS_AFTER.filter(drawn).map(visitRow)}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** The privacy line under the form: each clinic sees only its own records. */
export function AuthShowcasePrivacy({ className }: { className?: string }) {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <p
      data-testid={AUTH_SHOWCASE_TEST_IDS.privacy}
      className={cn(
        'text-caption text-muted-foreground-strong flex items-start gap-2 text-start text-pretty',
        className,
      )}
    >
      <Lock aria-hidden="true" className="mt-0.5 size-3.5 flex-none" />
      {t(K.privacy)}
    </p>
  );
}
