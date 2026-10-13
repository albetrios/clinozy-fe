import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
// The unit, not the Cells barrel: the barrel would make this lazy chunk an
// importer of every cell and re-split them onto the first-paint chunk map.
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { Lock } from '@/shared/icons/index.ts';

import {
  AUTH_SHOWCASE_KEYS,
  AUTH_SHOWCASE_NS,
  AUTH_SHOWCASE_TEST_IDS,
  JOURNEY_STOPS,
  SHOWCASE_MOMENTS,
  SHOWCASE_VALUES,
  SHOWCASE_WASH,
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
 * The sign-in screen's hero (iteration change-shell-polish-and-sign-in, D9):
 * who Clinozy is for, the promise, and what it replaces — product truth from
 * the PRD only (D11). Centred above the card below `lg`; the start column's top
 * from `lg`. Its heading is an `h2`: the card's heading stays the page's `h1`.
 */
export function AuthShowcaseHero({ className }: { className?: string }) {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      data-testid={AUTH_SHOWCASE_TEST_IDS.hero}
      className={cn(
        'flex flex-col items-center gap-3 text-center lg:items-start lg:text-start',
        className,
      )}
    >
      <span
        data-slot="pill"
        className="bg-card text-foreground-soft text-caption inline-flex h-7 items-center gap-2 rounded-full border px-3 font-medium"
      >
        <LiveDot />
        {t(K.eyebrow)}
      </span>
      <h2
        id={headingId}
        className="font-heading text-foreground text-4xl leading-[1.08] font-semibold tracking-[-0.03em] text-balance xl:text-5xl"
      >
        {t(K.headline)}
      </h2>
      <p className="text-body text-muted-foreground-strong max-w-xl text-pretty">
        {t(K.lead)}
      </p>
    </section>
  );
}

/** One patient's journey: seven tone-coded stops a wave lights in turn. */
function Journey() {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <div
      data-slot="surface"
      data-testid={AUTH_SHOWCASE_TEST_IDS.journey}
      className="bg-card flex flex-col gap-3 rounded-2xl border p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-detail text-foreground font-semibold">{t(K.journey.title)}</p>
        <span className="text-micro text-muted-foreground-strong inline-flex items-center gap-1.5 font-medium">
          <LiveDot />
          {t(K.journey.live)}
        </span>
      </div>
      {/* No connectors: a wrapped row would start on one. The wave, stop by
          stop, is what reads as the sequence. */}
      <ol
        aria-label={t(K.journey.label)}
        className="m-0 flex list-none flex-wrap items-center gap-2 p-0"
      >
        {JOURNEY_STOPS.map((stop) => (
          <li key={stop.id} className="flex">
            <TonePill
              tone={stop.tone}
              icon={<stop.icon />}
              data-stop={stop.id}
              className={cn(
                'animate-[journey-wave_8400ms_ease-in-out_infinite_both] motion-reduce:animate-none',
                stop.delay,
              )}
            >
              {t(K.journey.stops[stop.id])}
            </TonePill>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Three anonymous moments from a clinic day, drifting out of step. */
function Moments() {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <ul
      aria-label={t(K.moments.label)}
      data-testid={AUTH_SHOWCASE_TEST_IDS.moments}
      className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3"
    >
      {SHOWCASE_MOMENTS.map((moment) => (
        <li
          key={moment.id}
          data-slot="surface"
          className={cn(
            'bg-card flex animate-[drift_6000ms_ease-in-out_infinite_alternate_both] flex-col items-start gap-2.5 rounded-xl border px-3 py-2.5 motion-reduce:animate-none',
            moment.delay,
          )}
        >
          <span
            aria-hidden="true"
            data-slot="icon-chip"
            className={cn(
              'flex size-8 flex-none items-center justify-center',
              TONE_CLASSES[moment.tone].surface,
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
        </li>
      ))}
    </ul>
  );
}

/** Why clinics choose Clinozy — three value lines, each in a room's tone. */
function Values() {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <ul
      aria-label={t(K.values.label)}
      data-testid={AUTH_SHOWCASE_TEST_IDS.values}
      className="m-0 grid list-none gap-4 p-0 pt-1 sm:grid-cols-3"
    >
      {SHOWCASE_VALUES.map((value) => (
        <li key={value.id} className="flex flex-col gap-2">
          <span
            aria-hidden="true"
            data-slot="icon-chip"
            className={cn(
              'flex size-8 items-center justify-center',
              TONE_CLASSES[value.tone].surface,
            )}
          >
            <value.icon className="size-4" />
          </span>
          <p className="text-detail text-foreground font-semibold">
            {t(K.values[value.id].title)}
          </p>
          <p className="text-caption text-muted-foreground-strong text-pretty">
            {t(K.values[value.id].body)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * The living showcase under the hero (D9): the journey, the moments and the
 * values. Below `lg` it is its own washed panel after the card; from `lg` it
 * sits on the start column's panel ({@link AuthShowcaseCanvas}) and drops its own.
 */
export function AuthShowcaseBoard({ className }: { className?: string }) {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  return (
    <section
      aria-label={t(K.regionLabel)}
      data-slot="surface"
      data-testid={AUTH_SHOWCASE_TEST_IDS.board}
      className={cn(
        SHOWCASE_WASH,
        'flex flex-col gap-3 rounded-2xl border p-3',
        'lg:rounded-none lg:border-0 lg:bg-transparent lg:bg-none lg:p-0',
        className,
      )}
    >
      <Journey />
      <Moments />
      <Values />
    </section>
  );
}

/**
 * The start column's washed panel from `lg` — decoration only, under the hero
 * and the board (same grid cells, painted first). Hidden below `lg`.
 */
export function AuthShowcaseCanvas({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-slot="surface"
      className={cn(SHOWCASE_WASH, 'hidden rounded-3xl border lg:block', className)}
    />
  );
}

/** The privacy line under the card: each clinic sees only its own records. */
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
