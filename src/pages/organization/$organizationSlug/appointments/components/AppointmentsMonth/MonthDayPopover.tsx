import { type ReactElement, type RefObject, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { focusSurfaceOnOpen } from '@/lib/focus-surface.ts';
import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { closeControlClassName } from '@/lib/icon-surface.ts';
import { cn } from '@/lib/utils.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover.tsx';
import { useAppointmentSlotLabel } from '@/shared/hooks/useAppointments/index.ts';
import { X } from '@/shared/icons/index.ts';

import {
  APPOINTMENTS_KEYS,
  APPOINTMENTS_NS,
  APPOINTMENTS_TEST_IDS,
} from '../../appointments.constants.ts';
import { CalendarBlock } from '../CalendarBlock/index.ts';

/** What a popover anchor measures — the Month cell `cellRef` points at. */
type Measurable = { getBoundingClientRect: () => DOMRect };

/** Props for {@link MonthDayPopover}. */
export interface MonthDayPopoverProps {
  date: string;
  /** The day's bookings in slot order — every one, the fitted ones too. */
  rows: readonly AppointmentRow[];
  /** The Month cell: the popover opens over its top-left corner. */
  cellRef: RefObject<HTMLElement | null>;
  onOpenDay: (date: string) => void;
  /** "+<n> more". */
  children: ReactElement;
}

/**
 * A Month day's every booking (H:2088, H:5967; `appointments.md:197–209`):
 * 300px over the cell's top-left corner, kept inside the window, at most
 * `min(520px, room below − 12px)` tall — "<day> · <n> appointments", "Open
 * day" and ×, then each booking as a block. Esc, ×, "Open day" or a press
 * outside close it.
 */
export function MonthDayPopover({
  date,
  rows,
  cellRef,
  onOpenDay,
  children,
}: MonthDayPopoverProps) {
  const { t } = useTranslation([APPOINTMENTS_NS, LOCALE_NS]);
  const slotLabel = useAppointmentSlotLabel();
  const [open, setOpen] = useState(false);
  // Measured as it opens: the popover's top sits on the cell's.
  const [cellHeight, setCellHeight] = useState(0);
  const title = t(APPOINTMENTS_KEYS.calendar.dayCount, {
    day: slotLabel(date, '00:00').day,
    count: rows.length,
  });
  const openChange = (next: boolean) => {
    if (next) setCellHeight(cellRef.current?.getBoundingClientRect().height ?? 0);
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverAnchor virtualRef={cellRef as RefObject<Measurable>} />
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {/* Radix's popover content is a `role="dialog"` of its own. */}
      <PopoverContent
        aria-label={title}
        side="bottom"
        align="start"
        sideOffset={-cellHeight}
        collisionPadding={8}
        data-testid={APPOINTMENTS_TEST_IDS.monthPopover}
        tabIndex={-1}
        onOpenAutoFocus={focusSurfaceOnOpen}
        className="data-[state=open]:animate-dropdown-in flex max-h-[min(32.5rem,var(--radix-popover-content-available-height))] w-75 max-w-[calc(100vw-1rem)] flex-col rounded-xl p-0 data-[state=closed]:animate-none"
      >
        <div className="border-border flex flex-none items-center gap-2 border-b ps-3.5 pe-2.5 pt-2.5 pb-2">
          <span className="text-field min-w-0 flex-1 truncate font-semibold">
            {title}
          </span>
          <Button
            type="button"
            variant="outline"
            size="xs"
            data-testid={APPOINTMENTS_TEST_IDS.monthOpenDay}
            onClick={() => {
              setOpen(false);
              onOpenDay(date);
            }}
            className="border-border bg-card hover:bg-muted rounded-md text-xs shadow-none"
          >
            {t(APPOINTMENTS_KEYS.calendar.openDay)}
          </Button>
          <button
            type="button"
            data-slot="button"
            aria-label={t(LOCALE_KEYS.closeAria, { ns: LOCALE_NS })}
            title={t(LOCALE_KEYS.closeAria, { ns: LOCALE_NS })}
            onClick={() => setOpen(false)}
            className={cn(
              closeControlClassName,
              'flex size-7 flex-none items-center justify-center',
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto p-2.5">
          {rows.map((row) => (
            <CalendarBlock key={row.id} appointment={row} variant="list" />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
