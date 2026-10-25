import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import type { BranchHours } from '@/shared/app/branch-hours.ts';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar.tsx';
import { Bell, Calendar, Check } from '@/shared/icons/index.ts';

import {
  AUTH_SHOWCASE_KEYS as K,
  AUTH_SHOWCASE_NS,
  AUTH_SHOWCASE_TEST_IDS,
  TOUR_BILL,
  TOUR_CHAPTERS,
  TOUR_HOME_BRANCH,
  TOUR_PACKAGE_SESSIONS,
  TOUR_PATIENT,
  TOUR_STAFF,
  type TourChapterId,
} from './auth-showcase.constants.ts';
import {
  TOUR_BRANCH_LIST,
  tourBranchHours,
  useTourBranchWords,
} from './tour-branches.ts';
import {
  addMinutes,
  isInTourHours,
  tourBranchState,
  type TourDay,
  type TourSheetDay,
} from './tour-day.ts';
import { type TourFormat, useTourFormat } from './tour-format.ts';
import { TourBranchDot, TourBranchDots } from './TourBranches.tsx';

/** What every scene gets: whether it plays, the day, the clock, this device's hours and the formatters. */
interface SceneContext {
  live: boolean;
  day: TourDay;
  now: Date;
  /** This device's branch hours — Riya's branch's ({@link TOUR_HOME_BRANCH}). */
  hours: BranchHours;
  format: TourFormat;
}

/** A scene's props: one context, each scene reading the parts it draws. */
interface SceneProps {
  scene: SceneContext;
}

/**
 * A value that starts at `from` and becomes `to` after `delayMs`, when the
 * scene plays; a still scene shows `to` at once.
 */
function useLater<T>(live: boolean, from: T, to: T, delayMs: number): T {
  const [value, setValue] = useState(live ? from : to);
  useEffect(() => {
    if (!live) return;
    const timer = setTimeout(() => setValue(to), delayMs);
    return () => clearTimeout(timer);
  }, [live, to, delayMs]);
  return value;
}

/** Counts up once a second from 0 while the scene plays; a still scene shows `still`. */
function useSeconds(live: boolean, still: number): number {
  const [seconds, setSeconds] = useState(live ? 0 : still);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [live]);
  return seconds;
}

/** A small avatar: initials on a tone. */
function LensAvatar({
  initials,
  tone,
}: {
  initials: string;
  tone: keyof typeof TONE_CLASSES;
}) {
  return (
    <Avatar size="sm" className="size-6">
      <AvatarFallback
        className={cn('text-[0.65625rem] font-semibold', TONE_CLASSES[tone].surface)}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

/** Leads: Riya's Instagram message types itself in, and she becomes a lead. */
function LeadsScene({ scene }: SceneProps) {
  const { live, now, format } = scene;
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const arrived = useLater(live, false, true, 1100);
  const filed = useLater(live, false, true, 1600);
  return (
    <>
      <LensHead chapter="leads" title="Instagram" aside={format.time(now)} />
      <div className="tour-bubble-row">
        <LensAvatar initials={TOUR_PATIENT.initials} tone="lav" />
        <div className="tour-bubble">
          {arrived ? (
            <span className="tour-swap">{t(K.lens.leads.message)}</span>
          ) : (
            <span className="tour-typing">
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
      </div>
      <div className={cn('tour-lens-sub', filed ? 'tour-swap' : 'invisible')}>
        <TonePill tone="lav" dot="tone" size="sm">
          {t(K.lens.leads.newLead)}
        </TonePill>
        {t(K.lens.leads.added)}
      </div>
    </>
  );
}

/** The doctor's slots the lens offers, minutes after the sheet's base row; Riya's is the earliest free. */
const LENS_SLOTS = [
  { at: 0, taken: true },
  { at: 15, taken: false },
  { at: 30, taken: true },
  { at: 90, taken: false },
] as const;
/** Riya's slot, a quarter hour after the base row. */
const RIYA_SLOT = 15;

/** Whose day the slots are, for the day the sheet shows. */
const DOCTOR_DAY_KEYS: Readonly<Record<TourSheetDay, string>> = {
  today: K.lens.appointments.doctorToday,
  tomorrow: K.lens.appointments.doctorTomorrow,
  later: K.lens.appointments.doctorLater,
};

/** Appointments: the selection glides from the last free slot to the earliest. */
function AppointmentsScene({ scene }: SceneProps) {
  const { live, day, format } = scene;
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  // Riya's slot is always offered; the others only inside the branch's hours.
  const slots = LENS_SLOTS.filter(
    (slot) => slot.at === RIYA_SLOT || isInTourHours(day, addMinutes(day.base, slot.at)),
  );
  const earliest = slots.findIndex((slot) => slot.at === RIYA_SLOT);
  const picked = useLater(live, slots.length - 1, earliest, 450);
  const grid = useRef<HTMLDivElement>(null);
  const select = useRef<HTMLSpanElement>(null);
  // The highlight sits under the picked slot; it glides (a CSS transition) when the pick moves.
  useLayoutEffect(() => {
    const slot = grid.current?.children[picked + 1] as HTMLElement | undefined;
    if (!(grid.current && slot && select.current)) return;
    // `--slot-start` is an inline-start offset: under RTL it counts from the right edge.
    const fromLeft = slot.offsetLeft;
    const start =
      getComputedStyle(grid.current).direction === 'rtl'
        ? grid.current.clientWidth - fromLeft - slot.offsetWidth
        : fromLeft;
    select.current.style.setProperty('--slot-start', `${start}px`);
    select.current.style.setProperty('--slot-width', `${slot.offsetWidth}px`);
  }, [picked]);
  const doctor = TOUR_STAFF.iyer.name;
  return (
    <>
      <LensHead
        chapter="appointments"
        title={t(DOCTOR_DAY_KEYS[day.sheetDay], {
          doctor,
          weekday: format.weekday(day.slot),
        })}
        aside={t(K.lens.appointments.length, { minutes: format.number(20) })}
      />
      <div ref={grid} className="tour-slots">
        <span ref={select} className="tour-slot-select" />
        {slots.map((slot, index) => (
          <span
            key={slot.at}
            className={cn(
              'tour-slot',
              slot.taken && 'is-taken',
              index === picked && 'is-picked',
            )}
          >
            {format.time(addMinutes(day.base, slot.at))}
          </span>
        ))}
      </div>
      <LensSub icon={<Check aria-hidden="true" className="size-3.5" />}>
        {t(K.lens.appointments.earliest)}
      </LensSub>
    </>
  );
}

/** Front desk: the doctor's bell rings and the wait starts counting. */
function FrontDeskScene({ scene }: SceneProps) {
  const { live, format } = scene;
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const seconds = useSeconds(live, 7);
  return (
    <>
      <div className="tour-checkin">
        <span className={cn('tour-bell', live && 'is-ringing')}>
          <Bell aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <b>{t(K.lens.frontDesk.notified, { doctor: TOUR_STAFF.iyer.name })}</b>
          <small>{t(K.lens.frontDesk.waiting)}</small>
        </div>
        <span className="tour-timer">{`${format.number(0)}:${format.twoDigits(seconds)}`}</span>
      </div>
      <LensSub icon={<Check aria-hidden="true" className="size-3.5" />}>
        {t(K.lens.frontDesk.live)}
      </LensSub>
    </>
  );
}

/** Patient file: the prescription writes itself, a character at a time. */
function PatientFileScene({ scene }: SceneProps) {
  const { live, format } = scene;
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const line = t(K.lens.patientFile.line);
  const [typed, setTyped] = useState(live ? 0 : line.length);
  useEffect(() => {
    if (!live) return;
    let count = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      timer = setInterval(() => {
        count += 1;
        setTyped(count);
        if (count >= line.length) clearInterval(timer);
      }, 34);
    }, 250);
    return () => {
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [live, line]);
  return (
    <>
      <LensHead
        chapter="patientFile"
        title={TOUR_PATIENT.name}
        aside={t(K.lens.patientFile.file)}
      />
      <div className="tour-file-tabs">
        <span>{t(K.lens.patientFile.notes)}</span>
        <span>{t(K.lens.patientFile.photos, { photos: format.number(2) })}</span>
        <span className="is-on">{t(K.lens.patientFile.prescription)}</span>
      </div>
      <div className="tour-rx">
        <span className="tour-rx-mark" aria-hidden="true">
          Rx
        </span>
        <span className="tour-rx-line">
          {line.slice(0, typed)}
          <span className="tour-caret" />
        </span>
      </div>
    </>
  );
}

/** Treatment: the package's first session dot fills. */
function TreatmentScene({ scene }: SceneProps) {
  const { live, day, format } = scene;
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <>
      <LensHead
        chapter="treatment"
        title={t(K.lens.treatment.package, {
          sessions: format.number(TOUR_PACKAGE_SESSIONS),
        })}
        aside={TOUR_STAFF.neha.name}
      />
      <div className="tour-sessions">
        {Array.from({ length: TOUR_PACKAGE_SESSIONS }, (_, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: four fixed, identical places
            key={index}
            data-slot="pill"
            className={cn(
              'tour-session',
              index === 0 && 'is-used',
              index === 0 && live && 'is-filling',
            )}
          />
        ))}
        <span className="tour-sessions-count">
          {t(K.lens.treatment.used, {
            used: format.number(1),
            sessions: format.number(TOUR_PACKAGE_SESSIONS),
          })}
        </span>
      </div>
      <LensSub icon={<Calendar aria-hidden="true" className="size-3.5" />}>
        {t(K.lens.treatment.next, { date: format.shortDate(day.nextSession) })}
      </LensSub>
    </>
  );
}

/** Payments: the bill, paid by UPI, its total counting up. */
function PaymentsScene({ scene }: SceneProps) {
  const { live, format } = scene;
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const [shown, setShown] = useState(live ? 0 : format.bill);
  useEffect(() => {
    if (!live) return;
    let frame = 0;
    let started = 0;
    const tick = (now: number) => {
      started ||= now;
      const progress = Math.min(1, (now - started) / 800);
      setShown(Math.round(format.bill * (1 - (1 - progress) ** 4)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    const delay = setTimeout(() => {
      frame = requestAnimationFrame(tick);
    }, 200);
    return () => {
      clearTimeout(delay);
      cancelAnimationFrame(frame);
    };
  }, [live, format.bill]);
  return (
    <>
      <LensHead
        chapter="payments"
        title={t(K.lens.payments.bill, { patient: TOUR_PATIENT.name })}
        aside={
          <span data-slot="pill" className="tour-method">
            UPI
          </span>
        }
      />
      <div className="tour-receipt">
        <div className="tour-receipt-row">
          <span>{t(K.lens.payments.consultation)}</span>
          <span>{format.money(TOUR_BILL.consultation)}</span>
        </div>
        <div className="tour-receipt-row">
          <span>{t(K.lens.payments.session)}</span>
          <span>{format.money(TOUR_BILL.session)}</span>
        </div>
        <div className="tour-receipt-total">
          <TonePill tone="peach" icon={<Check aria-hidden="true" className="size-3" />}>
            {t(K.sheet.status.paid)}
          </TonePill>
          <b>{format.money(shown)}</b>
        </div>
      </div>
      <LensSub icon={<Check aria-hidden="true" className="size-3.5" />}>
        {t(K.lens.payments.nothingDue)}
      </LensSub>
    </>
  );
}

/** Tasks: the follow-up call drops onto the front desk's list. */
function TasksScene({ scene }: SceneProps) {
  const { live, day, format } = scene;
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <>
      <LensHead
        chapter="tasks"
        title={t(K.lens.tasks.title)}
        aside={t(K.lens.tasks.due, { tasks: format.number(3) })}
      />
      <div className={cn('tour-task', live && 'is-dropping')}>
        <span className="tour-task-box" />
        <div className="min-w-0">
          <b>{t(K.lens.tasks.call)}</b>
          <small>{t(K.lens.tasks.when, { weekday: format.weekday(day.followUp) })}</small>
        </div>
        <LensAvatar initials={TOUR_STAFF.desk.initials} tone={TOUR_STAFF.desk.tone} />
      </div>
      <LensSub icon={<Bell aria-hidden="true" className="size-3.5" />}>
        {t(K.lens.tasks.reminder)}
      </LensSub>
    </>
  );
}

/**
 * Branches: the header's branch picker — every branch in its hours, how many are open now — its
 * check gliding from Riya's branch to "All branches" as the deck folds (CSS, `--deck-fold-at`).
 */
function BranchesScene({ scene }: SceneProps) {
  const { now, hours, format } = scene;
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const words = useTourBranchWords(format);
  const open = TOUR_BRANCH_LIST.filter(
    (branch) => tourBranchState(tourBranchHours(branch, hours), now).kind === 'open',
  ).length;
  return (
    <>
      <LensHead
        chapter="branches"
        title={t(K.lens.branches.title)}
        aside={t(K.lens.branches.openNow, {
          count: format.number(open),
          total: format.number(TOUR_BRANCH_LIST.length),
        })}
      />
      <ul className="tour-branch-list">
        <li className="tour-branch-option">
          <span className="tour-branch-pick tour-deck-after" />
          <TourBranchDots />
          <b>{t(K.sheet.allBranches)}</b>
          <small />
          <Check
            aria-hidden="true"
            className="tour-branch-check tour-deck-after size-3.5"
          />
        </li>
        {TOUR_BRANCH_LIST.map((branch) => {
          // Riya's branch is picked until the deck folds; the others never are.
          const home = branch.id === TOUR_HOME_BRANCH;
          return (
            <li key={branch.id} className="tour-branch-option">
              {home ? <span className="tour-branch-pick tour-deck-before" /> : null}
              <TourBranchDot branch={branch} />
              <b>{branch.name}</b>
              <small>{words.hours(tourBranchHours(branch, hours), now)}</small>
              <Check
                aria-hidden="true"
                className={cn(
                  'tour-branch-check size-3.5',
                  home ? 'tour-deck-before' : 'invisible',
                )}
              />
            </li>
          );
        })}
      </ul>
      <LensSub icon={<Check aria-hidden="true" className="size-3.5" />}>
        {t(K.lens.branches.oneFile)}
      </LensSub>
    </>
  );
}

/** A scene's head: the chapter's icon and a title, a quiet note at the end. */
function LensHead({
  chapter,
  title,
  aside,
}: {
  chapter: TourChapterId;
  title: string;
  aside: ReactNode;
}) {
  const icon = TOUR_CHAPTERS.find((entry) => entry.id === chapter)?.icon;
  const Icon = icon ?? Check;
  return (
    <div className="tour-lens-head">
      <b>
        <Icon aria-hidden="true" className="size-3.5 flex-none" />
        <span className="truncate">{title}</span>
      </b>
      <span className="flex-none">{aside}</span>
    </div>
  );
}

/** A scene's foot: what just happened, in one line. */
function LensSub({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="tour-lens-sub">
      <span className="tour-lens-sub-icon">{icon}</span>
      {children}
    </div>
  );
}

const SCENES: Record<TourChapterId, (props: SceneProps) => ReactNode> = {
  leads: LeadsScene,
  appointments: AppointmentsScene,
  frontDesk: FrontDeskScene,
  patientFile: PatientFileScene,
  treatment: TreatmentScene,
  payments: PaymentsScene,
  tasks: TasksScene,
  branches: BranchesScene,
};

/**
 * The lens under Riya's row: the chapter's feature, shown working — her
 * message arriving, a slot being picked, the wait counting, a prescription
 * writing itself, a session filling, the bill settling, a follow-up dropping
 * in, the branch picker turning to every branch. `live` plays the scene;
 * otherwise it is drawn at its end.
 */
export function TourLens({
  chapter,
  live,
  day,
  now,
  hours,
}: {
  chapter: TourChapterId;
  live: boolean;
  day: TourDay;
  now: Date;
  hours: BranchHours;
}) {
  const format = useTourFormat();
  const Scene = SCENES[chapter];
  return (
    <div
      className={cn('tour-lens', live && 'is-arriving')}
      data-testid={AUTH_SHOWCASE_TEST_IDS.lens}
      data-chapter={chapter}
    >
      <Scene scene={{ live, day, now, hours, format }} />
    </div>
  );
}
