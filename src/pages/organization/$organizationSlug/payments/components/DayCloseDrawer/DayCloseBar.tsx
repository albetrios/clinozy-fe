import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type {
  DayCloseHistoryItem,
  DayCloseView,
} from '@/shared/api/clinic/day-close-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  PersonAvatar,
  shortPersonName,
  TonePill,
} from '@/shared/components/Cells/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';

import {
  DAY_CLOSE_TEST_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from '../../payments.constants.ts';
import { useDayLabel } from '../../shared/hooks/useDayLabel/index.ts';
import { type DayStatus, dayStatus, differenceText } from './day-close-view.ts';

const K = PAYMENTS_KEYS.dayClose;
const T = DAY_CLOSE_TEST_ID;

/** How far back the day dropdown reaches (`payments.md:188`). */
const DAY_PICKER_PAST = 120;

/** Props of {@link DayCloseBar}. */
export interface DayCloseBarProps {
  /** The reviewed day, `YYYY-MM-DD`. */
  date: string;
  /** The clinic's today — no later day can be picked. */
  today: string;
  /** The day's view; the bar shows only the day dropdown while it loads. */
  view: DayCloseView | undefined;
  /** "Close day" shows: the working state and `payment:update`. */
  canClose: boolean;
  closing: boolean;
  onDayChange: (date: string) => void;
  onCloseDay: () => void;
}

/** The status pill's words. */
function statusText(status: DayStatus, t: TFunction): string {
  switch (status.kind) {
    case 'closedBy':
      return t(K.status.closedBy, { name: shortPersonName(status.name) });
    case 'forceClosed':
      return t(K.status.forceClosed);
    case 'closed':
      return t(K.status.closed);
    case 'open':
      return t(K.status.open);
    case 'openAuto':
      return t(K.status.openAuto, { count: status.hours });
  }
}

/** A "Previous closes" chip (H:5113): avatar · "25 Sep" · "Cash ₹7,310" · the difference or "Auto-closed". */
function HistoryChip({
  item,
  onPick,
}: {
  item: DayCloseHistoryItem;
  onPick: (date: string) => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const dayLabel = useDayLabel({ relative: false });
  const day = dayLabel(item.date);
  const matched = !item.autoClosed && item.difference === 0;
  return (
    <button
      type="button"
      title={t(K.previousTitle, { day })}
      onClick={() => onPick(item.date)}
      data-testid={`${T}-previous-${item.date}`}
      className="bg-background text-detail hover:bg-muted flex h-9 items-center gap-2 rounded-lg border ps-1.5 pe-2.5 whitespace-nowrap transition-colors"
    >
      {item.closedBy ? (
        <PersonAvatar
          initials={item.closedBy.initials}
          tone={item.closedBy.tone}
          size="chip"
        />
      ) : null}
      <span className="font-semibold">{day}</span>
      <span className="text-foreground-soft tabular-nums">
        {t(K.previousCash, {
          amount: item.countedCash === null ? '—' : formatRupees(item.countedCash),
        })}
      </span>
      <TonePill tone={matched ? 'sage' : 'blush'} size="xs" className="tabular-nums">
        {item.autoClosed
          ? t(K.previousAuto)
          : differenceText(item.difference, formatRupees)}
      </TonePill>
    </button>
  );
}

/** "Previous closes ⌄" opened: up to six chips, or a line before the branch's first close. */
function PreviousCloses({
  history,
  onPick,
}: {
  history: readonly DayCloseHistoryItem[];
  onPick: (date: string) => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  return (
    <div
      className="animate-reveal flex flex-wrap gap-2"
      data-testid={`${T}-previous-list`}
    >
      {history.length === 0 ? (
        <span
          data-testid={`${T}-previous-none`}
          className="text-muted-foreground text-xs"
        >
          {t(K.previousNone)}
        </span>
      ) : null}
      {history.map((item) => (
        <HistoryChip key={item.date} item={item} onPick={onPick} />
      ))}
    </div>
  );
}

/**
 * Day close's bar (`payments.md:276`; H:5112–5113): the day dropdown (today
 * back 120 days), the status pill, "3 entries on 3 Oct", yesterday's open-day
 * chip while today is shown ("2 Oct not closed · 15 h left · Review"),
 * "Previous closes ⌄" with up to six chips that jump to their day, and "Close
 * day" on a working day.
 */
export function DayCloseBar({
  date,
  today,
  view,
  canClose,
  closing,
  onDayChange,
  onCloseDay,
}: DayCloseBarProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const dayLabel = useDayLabel({ relative: false });
  const [historyOpen, setHistoryOpen] = useState(false);
  const status = view ? dayStatus(view) : null;
  const openDays = view && date === today ? view.openDays : [];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="w-56 max-w-full flex-none">
          <DatePicker
            value={date}
            onChange={(next) => {
              if (next) onDayChange(next);
            }}
            label={t(K.day)}
            past={DAY_PICKER_PAST}
            future={0}
            max={today}
            today={today}
            size="md"
            testId={`${T}-day`}
          />
        </div>
        {status ? (
          <TonePill
            tone={status.tone}
            data-testid={`${T}-status`}
            className="h-6.5 font-semibold"
          >
            {statusText(status, t)}
          </TonePill>
        ) : null}
        {view ? (
          <span
            data-testid={`${T}-entries`}
            className="text-muted-foreground min-w-0 truncate text-xs"
          >
            {t(K.entries, { count: view.entries.length, day: dayLabel(date) })}
          </span>
        ) : null}
        {openDays.map((open) => (
          <button
            key={open.date}
            type="button"
            title={t(K.openDayTitle)}
            onClick={() => onDayChange(open.date)}
            data-testid={`${T}-open-day-${open.date}`}
            data-slot="pill"
            className={cn(
              'inline-flex h-6.5 items-center rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap',
              TONE_CLASSES.butter.surface,
              TONE_CLASSES.butter.border,
            )}
          >
            {t(K.openDay, { day: dayLabel(open.date), count: open.hoursLeft })}
          </button>
        ))}
        <span className="flex-1" />
        <Button
          type="button"
          variant="outline"
          aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((current) => !current)}
          className="text-body h-9 gap-1.5 ps-3 pe-2.5"
          data-testid={`${T}-previous`}
        >
          {t(K.previous)}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'text-muted-foreground transition-transform duration-150',
              historyOpen && 'rotate-180',
            )}
          />
        </Button>
        {canClose ? (
          <Button
            type="button"
            disabled={closing}
            onClick={onCloseDay}
            className="text-body h-9 px-4"
            data-testid={`${T}-close-day`}
          >
            {t(K.closeDay)}
          </Button>
        ) : null}
      </div>
      {historyOpen && view ? (
        <PreviousCloses
          history={view.history}
          onPick={(day) => {
            setHistoryOpen(false);
            onDayChange(day);
          }}
        />
      ) : null}
    </div>
  );
}
