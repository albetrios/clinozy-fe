import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { AppointmentCalendarView } from '@/shared/api/app/appointment-views.ts';
import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import {
  blockGeometry,
  doubleBookedIds,
  HOUR_HEIGHT,
  laneLayout,
  nowLineTop,
  pastVeil,
  RAIL_HOURS,
  slotFromPointer,
  SOLO_LANE,
} from '../../appointments.calendar.ts';
import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import type { CalendarClock } from '../../hooks/useCalendarClock/index.ts';
import { CalendarBlock } from '../CalendarBlock/index.ts';

/** Props for {@link CalendarCard}. */
export interface CalendarCardProps {
  view: AppointmentCalendarView;
  children: ReactNode;
  className?: string;
}

/**
 * A calendar's card (H:2030): 12px corners and a 1px border holding a Day,
 * Week or Month board — edge to edge on a phone, where it keeps its corners
 * (the Agenda's table drops them there).
 */
export function CalendarCard({ view, children, className }: CalendarCardProps) {
  return (
    <div
      data-slot="card"
      data-view={view}
      data-testid={APPOINTMENTS_TEST_IDS.calendar}
      className={cn(
        'bg-card text-card-foreground flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The hour rail (H:2060): "9 am" … "9 pm" at the inline end, 10.5px muted,
 * each label centred on its hour line — the first sits just under the top.
 * Decorative: every block names its own time.
 */
export function HourRail() {
  const { formatDate } = useLocaleFormat();
  return (
    <div aria-hidden="true" className="relative">
      {RAIL_HOURS.map((hour, index) => (
        <span
          key={hour}
          style={{ '--rail-top': `${index * HOUR_HEIGHT}px` } as CSSProperties}
          className={cn(
            'text-tiny text-muted-foreground absolute end-2 top-(--rail-top) whitespace-nowrap',
            index === 0 ? 'translate-y-px' : '-translate-y-1.5',
          )}
        >
          {formatDate(
            new Date(2000, 0, 1, hour),
            { hour: 'numeric' },
            { wallClock: true },
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * The half-hour and hour lines of a column (H:2061): a 1px line at 43px in
 * the canvas grey and one at 87px in the muted grey, every 88px — tokens, so
 * they follow the theme (the prototype's SVG is fixed light colours, §7.3).
 */
const HOUR_LINES =
  'bg-[image:linear-gradient(to_bottom,transparent_43px,var(--color-canvas)_43px,var(--color-canvas)_44px,transparent_44px,transparent_87px,var(--color-muted)_87px)] bg-[length:100%_88px]';

/** Props for {@link DayColumn}. */
export interface DayColumnProps {
  date: string;
  /** The column's bookings. */
  rows: readonly AppointmentRow[];
  clock: CalendarClock;
  /** Name a same-doctor clash in the block tooltips (the Day). */
  sayClash?: boolean;
  /**
   * A press on an empty spot books it (the Day, with Create): the slot under
   * the pointer, rounded to 15 minutes. Without it the column only shows.
   */
  onSlot?: (time: string) => void;
  /** The rows are the last range's: drawn as the in-place skeleton. */
  refreshing?: boolean;
}

/**
 * One day's column on the hour rail (H:2061–2064, H:5926–5933): the hour
 * lines, the past veil (`muted` at 75%) down to the now line on today and
 * over a past day, the 2px now line, and the bookings as blocks — overlapping
 * ones side by side in lanes. On the Day an empty spot books its slot (the
 * column's own surface, "Click an empty slot to book").
 */
export function DayColumn({
  date,
  rows,
  clock,
  sayClash = false,
  onSlot,
  refreshing = false,
}: DayColumnProps) {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const lanes = laneLayout(rows);
  const clashing = sayClash ? doubleBookedIds(rows) : new Set<string>();
  const veil = pastVeil(date, clock.today, clock.minutes);
  const nowTop = nowLineTop(clock.minutes);
  const pressSlot = (event: MouseEvent<HTMLButtonElement>) => {
    const top = event.currentTarget.getBoundingClientRect().top;
    onSlot?.(slotFromPointer(event.clientY - top));
  };

  return (
    <div
      data-testid={APPOINTMENTS_TEST_IDS.dayColumn}
      data-date={date}
      className={cn('border-border relative border-s', HOUR_LINES)}
    >
      {onSlot ? (
        // The pointer's way to book a slot; the keyboard's is "New appointment".
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          title={t(APPOINTMENTS_KEYS.calendar.bookSlot)}
          data-testid={APPOINTMENTS_TEST_IDS.daySlots}
          onClick={pressSlot}
          className="absolute inset-0 cursor-copy"
        />
      ) : null}
      {veil === 0 ? null : (
        <div
          aria-hidden="true"
          style={{ '--veil': veil === 'all' ? '100%' : `${veil}px` } as CSSProperties}
          className="bg-muted/75 pointer-events-none absolute inset-x-0 top-0 h-(--veil)"
        />
      )}
      <div className="contents" data-refreshing={refreshing || undefined}>
        {rows.map((row) => (
          <CalendarBlock
            key={row.id}
            appointment={row}
            variant="grid"
            geometry={blockGeometry(row, lanes.get(row.id) ?? SOLO_LANE)}
            clash={clashing.has(row.id)}
          />
        ))}
      </div>
      {date === clock.today && nowTop > 0 ? (
        <div
          aria-hidden="true"
          data-testid={APPOINTMENTS_TEST_IDS.nowLine}
          style={{ '--now': `${nowTop}px` } as CSSProperties}
          className="bg-now-indicator pointer-events-none absolute inset-x-0 top-(--now) z-2 h-0.5"
        />
      ) : null}
    </div>
  );
}
