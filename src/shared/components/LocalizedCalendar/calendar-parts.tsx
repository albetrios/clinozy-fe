import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type Ref,
  useContext,
  useEffect,
  useRef,
} from 'react';
import type { DayButtonProps, Modifiers } from 'react-day-picker';

import { cn } from '@/lib/utils.ts';
import { ChevronDown, ChevronLeft, ChevronRight } from '@/shared/icons/index.ts';

import {
  type CalendarLook,
  CalendarPartsContext,
  type CalendarTone,
} from './calendar-parts-context.ts';

/** A day button's size and type, per look. */
const DAY_BUTTON: Readonly<Record<CalendarLook, string>> = {
  picker:
    'text-sm flex size-(--cell-size) w-full items-center justify-center rounded-md tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground data-[day-state=off]:opacity-50',
  compact:
    'text-caption flex h-6.5 w-full items-center justify-center rounded-md tabular-nums transition-colors hover:bg-muted data-[day-state=off]:text-disabled',
  regular:
    'text-body flex h-8 w-full flex-col items-center justify-center gap-0.5 rounded-lg tabular-nums transition-colors hover:bg-muted data-[day-state=off]:text-disabled',
};

/** Today and the pick, per tone — the pick wins over today (one state per day). */
const DAY_TONE: Readonly<Record<CalendarTone, string>> = {
  primary:
    'data-[day-state=today]:bg-muted data-[day-state=today]:font-semibold data-[day-state=selected]:bg-primary data-[day-state=selected]:text-primary-foreground data-[day-state=selected]:font-semibold',
  sky: 'data-[day-state=today]:bg-tone-sky data-[day-state=today]:text-tone-sky-foreground data-[day-state=today]:font-semibold data-[day-state=selected]:bg-[color-mix(in_oklab,var(--color-tone-sky-foreground)_24%,var(--color-tone-sky))] data-[day-state=selected]:text-tone-sky-foreground data-[day-state=selected]:font-semibold',
};

/** The dots' slots, by name — at most three. */
const DOT_SLOTS = ['first', 'second', 'third'] as const;

/**
 * A day's one state for its look: the pick, else today; a day that cannot be
 * picked reads as off (a picked one keeps its pick — a locked form's date).
 */
function dayState(modifiers: Modifiers): 'selected' | 'today' | 'off' | undefined {
  if (modifiers.selected) return 'selected';
  if (modifiers.disabled) return 'off';
  return modifiers.today ? 'today' : undefined;
}

/**
 * One day of the grid: react-day-picker's roving button (the focused day
 * takes focus) with `data-day` — its `YYYY-MM-DD` — the caller's test id, the
 * look's size and the tone's today / pick, and the day's dots under its
 * number. The room looks also show the day's name as its tooltip.
 */
export function CalendarDayButton({
  day,
  modifiers,
  className,
  children,
  ...props
}: DayButtonProps) {
  const parts = useContext(CalendarPartsContext);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);
  const dots = modifiers.dots ? parts.dots?.(day.isoDate) : undefined;

  return (
    <button
      ref={ref}
      {...props}
      data-slot="calendar-day"
      data-day={day.isoDate}
      data-day-state={dayState(modifiers)}
      data-testid={parts.testIds?.day}
      title={parts.look === 'picker' ? undefined : props['aria-label']}
      className={cn(DAY_BUTTON[parts.look], DAY_TONE[parts.tone], className)}
    >
      {children}
      {parts.dots ? (
        <span aria-hidden="true" className="flex h-1 gap-0.5">
          {dots
            ? DOT_SLOTS.slice(0, dots.count).map((slot) => (
                <span
                  key={slot}
                  className={cn(
                    'size-1 rounded-full',
                    modifiers.selected ? 'bg-canvas' : dots.className,
                  )}
                />
              ))
            : null}
        </span>
      ) : null}
    </button>
  );
}

/** "‹": the previous month — with the caller's test id and, in a room look, its name as the tooltip. */
export function CalendarPreviousButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const parts = useContext(CalendarPartsContext);
  return (
    <button
      {...props}
      data-slot="button"
      data-testid={parts.testIds?.previous}
      title={parts.look === 'picker' ? undefined : props['aria-label']}
    />
  );
}

/** "›": the next month — with the caller's test id and, in a room look, its name as the tooltip. */
export function CalendarNextButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const parts = useContext(CalendarPartsContext);
  return (
    <button
      {...props}
      data-slot="button"
      data-testid={parts.testIds?.next}
      title={parts.look === 'picker' ? undefined : props['aria-label']}
    />
  );
}

/**
 * The grid's root — declared here, not inline as the vendored calendar does,
 * so a parent's re-render (a pick writing its state) keeps the same day
 * buttons mounted and the keyboard focus where it was.
 */
export function CalendarRoot({
  rootRef,
  ...props
}: { rootRef?: Ref<HTMLDivElement> } & HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="calendar" ref={rootRef} {...props} />;
}

/**
 * The arrows' and the dropdowns' glyph, from the app's icon set. The day
 * picker also hands it `size`, `disabled` and `style`; the glyph keeps its own.
 */
export function CalendarChevron({
  className,
  orientation,
}: {
  className?: string;
  orientation?: 'up' | 'down' | 'left' | 'right';
}) {
  const classes = cn('size-4', className);
  if (orientation === 'left')
    return <ChevronLeft aria-hidden="true" className={classes} />;
  if (orientation === 'right') {
    return <ChevronRight aria-hidden="true" className={classes} />;
  }
  return <ChevronDown aria-hidden="true" className={classes} />;
}
