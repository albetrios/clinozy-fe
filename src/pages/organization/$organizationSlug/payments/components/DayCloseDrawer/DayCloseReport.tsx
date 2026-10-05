import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { DayCloseView } from '@/shared/api/clinic/day-close-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { PersonAvatar, shortPersonName } from '@/shared/components/Cells/index.ts';
import { useLedgerTime } from '@/shared/components/LedgerCells/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { CheckCircle } from '@/shared/icons/index.ts';

import {
  DAY_CLOSE_TEST_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from '../../payments.constants.ts';
import {
  cashDifference,
  dayLog,
  type DayLogRow,
  differenceText,
  differenceTone,
} from './day-close-view.ts';
import { DayCloseStrip, StripCell, StripFigure, StripSub } from './DayCloseStrip.tsx';

const K = PAYMENTS_KEYS.dayClose.report;
const T = `${DAY_CLOSE_TEST_ID}-report`;

/** Props of {@link DayCloseReport}. */
export interface DayCloseReportProps {
  view: DayCloseView;
  /** "Today", "Yesterday", "25 Sep". */
  dayTitle: string;
  /** Reopen shows: the day is inside the grace period and the member has `dayclose`. */
  canReopen: boolean;
  reopening: boolean;
  onReopen: () => void;
}

/** The difference cell's sub line: matched, extra or short. */
function differenceSub(difference: number | null, t: TFunction): string {
  if (difference === null) return '';
  if (difference === 0) return t(K.matched);
  return t(difference > 0 ? K.extra : K.short);
}

/** One line of "What happened", worded. */
function useLogText(view: DayCloseView, difference: number | null) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const nameOf = (row: DayLogRow) => (row.person ? shortPersonName(row.person.name) : '');
  return (row: DayLogRow): string => {
    switch (row.id) {
      case 'accepted':
        return t(view.opening.source === 'recounted' ? K.logRecounted : K.logAccepted, {
          name: nameOf(row),
          amount: formatPaise(view.opening.cash),
        });
      case 'reviewed':
        return t(K.logReviewed, {
          checked: view.checkedIds.length,
          count: view.entries.length,
        });
      case 'counted': {
        const amount = formatPaise(view.countedCash ?? 0);
        if (!difference) return t(K.logMatched, { amount });
        return t(difference > 0 ? K.logExtra : K.logShort, {
          amount,
          diff: formatPaise(Math.abs(difference)),
        });
      }
      case 'closed':
        return view.autoClosed ? t(K.logAuto) : t(K.logClosed, { name: nameOf(row) });
    }
  };
}

/** "What happened" (H:5121): dot · time · who · what, in order. */
function DayLog({ view, difference }: { view: DayCloseView; difference: number | null }) {
  const { t } = useTranslation(PAYMENTS_NS);
  const timeOf = useLedgerTime();
  const textOf = useLogText(view, difference);
  return (
    <div className="flex flex-col gap-1.5" data-testid={`${T}-log`}>
      <span className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase">
        {t(K.log)}
      </span>
      <ol className="flex flex-col gap-1.5">
        {dayLog(view).map((row) => (
          <li
            key={row.id}
            data-testid={`${T}-log-${row.id}`}
            className="text-detail flex items-center gap-2.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-1.5 flex-none rounded-full',
                TONE_CLASSES[row.tone].dot,
              )}
            />
            <span className="text-muted-foreground w-16 flex-none tabular-nums">
              {row.at ? timeOf(row.at) : '—'}
            </span>
            {row.person ? (
              <PersonAvatar
                initials={row.person.initials}
                tone={row.person.tone}
                size="chip"
              />
            ) : (
              <span aria-hidden="true" className="size-5.5 flex-none" />
            )}
            <span className="min-w-0">{textOf(row)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The closed day's report (`payments.md:331`; H:5117–5121): "Today is closed"
 * with who closed it and when (or "auto-closed after the grace period"),
 * Reopen inside the grace period (Q-G1), the five-cell strip — opening,
 * collected, paid out, counted, difference — and what happened.
 */
export function DayCloseReport({
  view,
  dayTitle,
  canReopen,
  reopening,
  onReopen,
}: DayCloseReportProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const timeOf = useLedgerTime();
  const difference = cashDifference(view.countedCash, view.expectedCash);
  const tone = differenceTone(difference);
  const sub =
    view.closedBy && view.closedAt
      ? t(K.closedBy, {
          name: shortPersonName(view.closedBy.name),
          time: timeOf(view.closedAt),
        })
      : t(K.autoClosed, { time: view.closedAt ? timeOf(view.closedAt) : '—' });

  return (
    <section
      data-testid={T}
      className="bg-background animate-reveal flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <span
          aria-hidden="true"
          className={cn(
            'flex size-7 flex-none items-center justify-center rounded-lg',
            TONE_CLASSES.sage.surface,
          )}
        >
          <CheckCircle className="size-4" />
        </span>
        <h3 className="text-title font-semibold">{t(K.title, { day: dayTitle })}</h3>
        <span className="text-detail text-muted-foreground">{sub}</span>
        <span className="flex-1" />
        {canReopen ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reopening}
            onClick={onReopen}
            className="text-detail h-8 px-3"
            data-testid={`${T}-reopen`}
          >
            {t(K.reopen)}
          </Button>
        ) : null}
      </div>
      <DayCloseStrip testId={`${T}-strip`}>
        <StripCell
          label={t(PAYMENTS_KEYS.dayClose.strip.opening)}
          testId={`${T}-opening`}
        >
          <StripFigure>{formatPaise(view.opening.cash)}</StripFigure>
          <StripSub>
            {view.acceptedBy
              ? t(K.acceptedBy, { name: shortPersonName(view.acceptedBy.name) })
              : t(K.takenAsExpected)}
          </StripSub>
        </StripCell>
        <StripCell label={t(K.collected)} testId={`${T}-collected`}>
          <StripFigure className="text-tone-sage-foreground">
            {formatPaise(view.collected.amount)}
          </StripFigure>
          <StripSub>{t(K.received, { count: view.collected.count })}</StripSub>
        </StripCell>
        <StripCell label={t(K.paidOut)} testId={`${T}-paid`}>
          <StripFigure className="text-tone-blush-foreground">
            {formatPaise(view.paidOut.amount)}
          </StripFigure>
          <StripSub>{t(K.paid, { count: view.paidOut.count })}</StripSub>
        </StripCell>
        <StripCell label={t(K.cashCounted)} testId={`${T}-counted`}>
          <StripFigure>{formatPaise(view.countedCash ?? 0)}</StripFigure>
          <StripSub>{t(K.expected, { amount: formatPaise(view.expectedCash) })}</StripSub>
        </StripCell>
        <StripCell
          label={t(K.difference)}
          testId={`${T}-difference`}
          className="max-md:col-span-full"
        >
          <StripFigure
            className={
              tone === 'gap' ? 'text-tone-blush-foreground' : 'text-tone-sage-foreground'
            }
          >
            {differenceText(difference, formatPaise)}
          </StripFigure>
          <StripSub>{differenceSub(difference, t)}</StripSub>
        </StripCell>
      </DayCloseStrip>
      <DayLog view={view} difference={difference} />
    </section>
  );
}
