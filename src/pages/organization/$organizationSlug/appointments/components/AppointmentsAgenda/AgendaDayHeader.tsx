import { Trans, useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { AppointmentDaySummary } from '@/shared/api/clinic/appointments-contracts.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import {
  agendaGroupLabel,
  type DayGroupSub,
  type DayGroupTone,
  dayGroupTone,
} from '../../appointments.display.ts';

/**
 * The header's band: the day's tone at 55% over the card, so rows never show
 * through (H:5906). Only the six day tones: Tailwind emits every class spelled
 * here into the first-paint stylesheet, used or not.
 */
const BAND: Readonly<Record<DayGroupTone, string>> = {
  sage: 'bg-tone-sage/55',
  sky: 'bg-tone-sky/55',
  lav: 'bg-tone-lav/55',
  blush: 'bg-tone-blush/55',
  butter: 'bg-tone-butter/55',
  mint: 'bg-tone-mint/55',
};

/** Props for {@link AgendaDayHeader}. */
export interface AgendaDayHeaderProps {
  /** The day, clinic-local `YYYY-MM-DD`. */
  date: string;
  today: string;
  /** The group's place among the loaded days — its tone cycles by it. */
  groupIndex: number;
  /** The day’s counts across every page (Appendix F); no counts while unknown. */
  summary: AppointmentDaySummary | undefined;
}

/**
 * One Agenda day's sticky header (H:2036; `appointments.md:40`): a 34px date
 * tile — sage today, else sky · lav · blush · butter · mint by the day's place
 * — "Today" / "Tomorrow" / the weekday over its sub line, and at the inline end
 * "<n> confirmed" · "<n> awaiting reply" (or "· all set"), the band the day's
 * tone at 55%.
 */
export function AgendaDayHeader({
  date,
  today,
  groupIndex,
  summary,
}: AgendaDayHeaderProps) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const { formatDate } = useLocaleFormat();
  const tone = dayGroupTone(date, today, groupIndex);
  const { label, sub } = agendaGroupLabel(date, today);
  const day = localDateOf(date);
  const weekday = formatDate(day, { weekday: 'long' }, { civilDay: true });
  const keys = APPOINTMENTS_KEYS.agenda;
  let title = weekday;
  if (label === 'today') title = t(keys.day.today);
  else if (label === 'tomorrow') title = t(keys.day.tomorrow);
  const subLine = subText(sub, weekday, t);
  const waiting = summary?.scheduled ?? 0;
  const confirmed = summary?.confirmed ?? 0;
  const counted = waiting + confirmed > 0;

  return (
    <div
      data-slot="surface"
      data-testid={APPOINTMENTS_TEST_IDS.dayGroup}
      className="bg-card -mt-px"
    >
      <div
        className={cn(
          'flex items-center gap-2.5 border-b px-(--table-pad-x) py-1.75',
          BAND[tone],
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex size-8.5 flex-none flex-col items-center justify-center rounded-lg leading-none tabular-nums',
            TONE_CLASSES[tone].surface,
          )}
        >
          <span className="text-sm font-semibold">
            {formatDate(day, { day: 'numeric' }, { civilDay: true })}
          </span>
          <span className="mt-px text-[length:calc(var(--text-xs)*3/4)] font-semibold tracking-[0.04em] uppercase">
            {formatDate(day, { month: 'short' }, { civilDay: true })}
          </span>
        </span>
        <span className="flex flex-col">
          <span className="text-body leading-[1.25] font-semibold">{title}</span>
          <span className="text-caption text-muted-foreground leading-[1.25]">
            {subLine}
          </span>
        </span>
        {counted ? (
          <span
            title={t(keys.counts.hint, {
              confirmed: t(keys.counts.confirmedHint, { count: confirmed }),
              waiting: t(keys.counts.waitingHint, { count: waiting }),
            })}
            className="ms-auto flex items-baseline gap-2 text-xs leading-none tabular-nums"
          >
            <span className="text-tone-sky-foreground inline-flex items-baseline gap-1 font-medium">
              <Trans
                t={t}
                i18nKey={keys.counts.confirmed}
                count={confirmed}
                components={{
                  n: <span className="text-title font-semibold tracking-[-0.02em]" />,
                }}
              />
            </span>
            {waiting > 0 ? (
              <>
                {/* 1 × 12px in `--z200` = `border` (H:2036). */}
                <span
                  aria-hidden="true"
                  data-slot="count-divider"
                  className="bg-border h-3 w-px self-center"
                />
                <span className="text-tone-butter-foreground inline-flex items-baseline gap-1 font-medium">
                  <Trans
                    t={t}
                    i18nKey={keys.counts.awaiting}
                    count={waiting}
                    components={{
                      n: <span className="text-title font-semibold tracking-[-0.02em]" />,
                    }}
                  />
                </span>
              </>
            ) : (
              <span className="text-tone-sky-foreground font-medium">
                {t(keys.counts.allSet)}
              </span>
            )}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The sub line's words (H:5906). */
function subText(
  sub: DayGroupSub,
  weekday: string,
  t: (key: string, values?: Record<string, unknown>) => string,
): string {
  const keys = APPOINTMENTS_KEYS.agenda.day;
  switch (sub.kind) {
    case 'weekday':
      return weekday;
    case 'inDays':
      return t(keys.inDays, { count: sub.days });
    case 'nextWeek':
      return t(keys.nextWeek);
    case 'inWeeks':
      return t(keys.inWeeks, { count: sub.weeks });
    case 'yesterday':
      return t(keys.yesterday);
    case 'daysAgo':
      return t(keys.daysAgo, { count: sub.days });
  }
}
