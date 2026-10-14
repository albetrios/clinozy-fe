import './auth-showcase.css';

import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { Lock } from '@/shared/icons/index.ts';

import {
  AUTH_SHOWCASE_KEYS,
  AUTH_SHOWCASE_NS,
  AUTH_SHOWCASE_TEST_IDS,
  JOURNEY_STOPS,
  SHOWCASE_MOMENTS,
  SHOWCASE_VALUES,
} from './auth-showcase.constants.ts';

const K = AUTH_SHOWCASE_KEYS;

/** The live dot: the sage dot with a breathing halo (still under reduced motion). */
function LiveDot() {
  return (
    <span
      aria-hidden="true"
      className="bg-tone-sage-dot size-1.5 flex-none animate-[pulse-dot_2400ms_ease-in-out_infinite] rounded-full motion-reduce:animate-none"
    />
  );
}

/**
 * The sign-in screen's hero: who Clinozy is for, the promise, and what it
 * replaces — product truth from the PRD only (D11). Its heading is an `h2`:
 * the form's heading stays the page's `h1`. The three lines rise in turn on
 * the page load.
 */
export function AuthShowcaseHero({ className }: { className?: string }) {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      data-testid={AUTH_SHOWCASE_TEST_IDS.hero}
      className={cn(
        'auth-rise flex flex-col items-start gap-4 text-start sm:items-center sm:text-center xl:items-start xl:gap-5 xl:text-start',
        className,
      )}
    >
      <span
        data-slot="pill"
        className="bg-background text-foreground-soft text-caption inline-flex h-7 items-center gap-2 rounded-full border px-3 font-medium"
      >
        <LiveDot />
        {t(K.eyebrow)}
      </span>
      <h2
        id={headingId}
        className="font-heading text-foreground 3xl:text-7xl text-[2.375rem] leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-5xl xl:text-[2.75rem] 2xl:text-[3.5rem]"
      >
        {t(K.headline)}
      </h2>
      <p className="text-muted-foreground-strong 3xl:text-lg max-w-xl text-[0.9375rem] leading-relaxed text-pretty sm:text-base">
        {t(K.lead)}
      </p>
    </section>
  );
}

/**
 * The ring under the stops — an SVG, so it stays a circle whatever the Shape
 * axis does to surfaces: the track the thread runs on, a dotted inner bezel,
 * and the disc the centre label sits on.
 */
function DialFace() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className="absolute inset-0 size-full overflow-visible"
    >
      <circle
        cx="50"
        cy="50"
        r="35"
        fill="none"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
        className="stroke-border-strong"
      />
      <circle
        cx="50"
        cy="50"
        r="28.5"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="0.1 2.1"
        strokeLinecap="round"
        className="stroke-border-strong"
      />
      <circle
        cx="50"
        cy="50"
        r="23"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        className="fill-card stroke-border"
      />
    </svg>
  );
}

/** The seven stops on the ring, clockwise from the top; each lifts as the thread arrives. */
function DialStops() {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <ol
      aria-label={t(K.journey.label)}
      data-testid={AUTH_SHOWCASE_TEST_IDS.journey}
      className="m-0 list-none p-0"
    >
      {JOURNEY_STOPS.map((stop) => {
        const tone = TONE_CLASSES[stop.tone];
        return (
          <li key={stop.id} data-stop={stop.id} className="auth-dial-stop">
            <span aria-hidden="true" className={cn('auth-dial-halo', tone.dot)} />
            <span
              data-slot="pill"
              data-tone={stop.tone}
              className={cn(
                'auth-dial-node relative flex size-10 items-center justify-center rounded-full border sm:size-11',
                tone.surface,
                tone.border,
              )}
            >
              <stop.icon aria-hidden="true" className="size-4 sm:size-4.5" />
            </span>
            <span className="auth-dial-label text-micro text-foreground-soft sm:text-caption font-medium">
              {t(K.journey.stops[stop.id])}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The disc in the middle: "Live", the stop the thread is on (each label rises
 * in as it arrives — decoration, the list above names every stop), and what
 * the dial is: one patient, one thread.
 */
function DialCentre() {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <div className="absolute inset-[29%] flex flex-col items-center justify-center gap-1 text-center sm:gap-1.5">
      <span className="text-micro text-muted-foreground-strong inline-flex items-center gap-1.5 font-medium">
        <LiveDot />
        {t(K.journey.live)}
      </span>
      <span aria-hidden="true" className="auth-dial-now w-full">
        {JOURNEY_STOPS.map((stop) => (
          <span
            key={stop.id}
            data-stop={stop.id}
            className={cn(
              'text-lg leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-2xl',
              TONE_CLASSES[stop.tone].ink,
            )}
          >
            {t(K.journey.stops[stop.id])}
          </span>
        ))}
      </span>
      <span className="text-micro sm:text-caption text-muted-foreground-strong max-w-[9rem] leading-snug text-balance">
        {t(K.journey.title)}
      </span>
    </div>
  );
}

/**
 * Three anonymous moments from a clinic day, each lifting as the thread
 * reaches its stop. From `sm` they float by the dial; below it they stack
 * under it.
 */
function Moments() {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <ul
      aria-label={t(K.moments.label)}
      data-testid={AUTH_SHOWCASE_TEST_IDS.moments}
      className="auth-moments m-0 mt-10 grid list-none gap-2 p-0 sm:mt-0 sm:block"
    >
      {SHOWCASE_MOMENTS.map((moment) => {
        const tone = TONE_CLASSES[moment.tone];
        return (
          <li key={moment.id} data-moment={moment.id} className="flex">
            <div
              data-slot="card"
              className="auth-moment bg-card text-card-foreground 3xl:max-w-[16rem] relative flex w-full items-center gap-3 rounded-xl border py-2.5 ps-2.5 pe-4 sm:w-max sm:max-w-[13.5rem]"
            >
              <span
                aria-hidden="true"
                data-slot="icon-chip"
                className={cn(
                  'flex size-8 flex-none items-center justify-center',
                  tone.surface,
                )}
              >
                <moment.icon className="size-4" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-detail text-foreground leading-snug font-medium">
                  {t(K.moments[moment.id].title)}
                </span>
                <span className="text-micro text-muted-foreground-strong">
                  {t(K.moments[moment.id].meta)}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The journey dial — the showcase's centrepiece: one patient's day as a turn
 * of a dial. Seven tone-coded stops on a ring, the logo's green thread
 * stepping from one to the next, the stop it is on named in the middle, and
 * three moments from the day lifting as it passes their stop. Every motion
 * runs one 15.4s turn, so nothing drifts out of step; under reduced motion
 * the dial stands still with every stop named. Its geometry and motion live
 * in `auth-showcase.css`, which loads with this lazy chunk.
 */
export function AuthShowcaseDial({ className }: { className?: string }) {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <section
      aria-label={t(K.regionLabel)}
      data-testid={AUTH_SHOWCASE_TEST_IDS.board}
      className={cn(
        'relative w-full sm:mx-auto sm:max-w-[30rem] xl:max-w-none',
        className,
      )}
    >
      <div className="auth-dial relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-none">
        <div aria-hidden="true" className="auth-dial-aura" />
        <DialFace />
        {/* The thread: the logo's green dot and its tail, stepping round the
            track from stop to stop. Gone under reduced motion. */}
        <div aria-hidden="true" className="auth-dial-thread" />
        <DialCentre />
        <DialStops />
      </div>
      <Moments />
    </section>
  );
}

/** Why clinics choose Clinozy — three value lines, each in a room's tone. */
export function AuthShowcaseValues({ className }: { className?: string }) {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <ul
      aria-label={t(K.values.label)}
      data-testid={AUTH_SHOWCASE_TEST_IDS.values}
      className={cn('auth-values m-0 flex list-none flex-col p-0', className)}
    >
      {SHOWCASE_VALUES.map((value) => (
        <li
          key={value.id}
          className="border-border flex items-start gap-3.5 border-t py-4 first:border-t-0 xl:first:border-t"
        >
          <span
            aria-hidden="true"
            data-slot="icon-chip"
            className={cn(
              'flex size-8 flex-none items-center justify-center',
              TONE_CLASSES[value.tone].surface,
            )}
          >
            <value.icon className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-detail text-foreground font-semibold">
              {t(K.values[value.id].title)}
            </p>
            <p className="text-caption text-muted-foreground-strong max-w-md text-pretty">
              {t(K.values[value.id].body)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The sign-in stage's atmosphere — decoration only: a fine dot grid that fades
 * out from the dial, and two of the rooms' tones washed in from the corners.
 * Tokens only, so dark mode and every preset follow.
 */
export function AuthShowcaseBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'auth-backdrop pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        className,
      )}
    >
      <div className="auth-backdrop-grid" />
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
        'text-caption text-muted-foreground-strong flex items-center justify-center gap-1.5 text-center text-pretty',
        className,
      )}
    >
      <Lock aria-hidden="true" className="size-3.5 flex-none" />
      {t(K.privacy)}
    </p>
  );
}
