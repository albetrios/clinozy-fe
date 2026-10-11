import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { DayCloseView } from '@/shared/api/app/day-close-contracts.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { PersonAvatar, shortPersonName } from '@/shared/components/Cells/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { CheckCircle } from '@/shared/icons/index.ts';

import {
  DAY_CLOSE_TEST_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from '../../payments.constants.ts';
import {
  dayLog,
  type DayLogRow,
  differenceText,
  differenceTone,
} from './day-close-view.ts';
import { DayCloseNetByMode } from './DayCloseNetByMode.tsx';
import { DayCloseStrip, StripCell, StripFigure, StripSub } from './DayCloseStrip.tsx';

const K = PAYMENTS_KEYS.dayClose.report;
const STRIP = PAYMENTS_KEYS.dayClose.strip;
const T = `${DAY_CLOSE_TEST_ID}-report`;

/** Props of {@link DayCloseReport}. */
export interface DayCloseReportProps {
  view: DayCloseView;
  /** "Today", "Yesterday", "25 Sep". */
  dayTitle: string;
  /** Reopen shows: the member may reopen a closed day (`payment:delete`). */
  canReopen: boolean;
  /** Reopen pressed — the drawer asks why. */
  onReopen: () => void;
}

/** The difference cell's sub line: matched, extra or short — or, auto-closed, not counted. */
function differenceSub(view: DayCloseView, t: TFunction): string {
  if (view.autoClosed) return t(K.notCounted);
  if (view.difference === null) return '';
  if (view.difference === 0) return t(K.matched);
  return t(view.difference > 0 ? K.extra : K.short);
}

/** "Closed by Riya S. · 01:42", or the worker's "Closed at 00:00 · auto-closed …". */
function useClosedSub(view: DayCloseView): string {
  const { t } = useTranslation(PAYMENTS_NS);
  const { time: timeOf } = useAppClock();
  const time = view.closedAt ? timeOf(view.closedAt) : '—';
  if (view.autoClosed) return t(K.autoClosed, { time });
  const name = view.closedBy ? shortPersonName(view.closedBy.name) : t(K.someone);
  return t(K.closedBy, { name, time });
}

/** One line of "What happened", worded by its kind and the day's figures. */
function useLogText(view: DayCloseView) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  /** The standing close's count: "Drawer counted at ₹1,700 · ₹40 short". */
  const countText = () => {
    const amount = formatRupees(view.countedCash ?? 0);
    const difference = view.difference ?? 0;
    if (difference === 0) return t(K.logMatched, { amount });
    return t(difference > 0 ? K.logExtra : K.logShort, {
      amount,
      diff: formatRupees(Math.abs(difference)),
    });
  };
  return (row: DayLogRow): string => {
    const name = row.person ? shortPersonName(row.person.name) : t(K.someone);
    const opening = formatRupees(view.opening.cash);
    switch (row.kind) {
      case 'accepted':
        return t(K.logAccepted, { name, amount: opening });
      case 'opened':
        return t(K.logOpened, { name });
      case 'recounted':
        return t(K.logRecounted, { name, amount: opening });
      case 'counted':
        return `${t(K.logClosed, { name })} · ${countText()}`;
      case 'closed':
        return t(K.logClosed, { name });
      case 'auto':
        return t(K.logAuto);
      case 'reopened':
        return t(K.logReopened, { name, reason: row.reason ?? '' });
    }
  };
}

/** A line's avatar: who did it, or the space where one would be (the worker's own steps). */
function LogAvatar({ row }: { row: DayLogRow }) {
  if (!row.person) return <span aria-hidden="true" className="size-5.5 flex-none" />;
  return (
    <PersonAvatar initials={row.person.initials} tone={row.person.tone} size="chip" />
  );
}

/**
 * "What happened" (H:5121): dot · time · who · what, oldest first — every event clinozy-be kept
 * for the day (B27), the standing close with its count and the difference's reason under it.
 */
function DayLog({ view }: { view: DayCloseView }) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { time: timeOf } = useAppClock();
  const textOf = useLogText(view);
  const rows = dayLog(view);
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5" data-testid={`${T}-log`}>
      <span className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase">
        {t(K.log)}
      </span>
      <ol className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <li
            key={row.id}
            data-testid={`${T}-log-${row.kind}`}
            className="text-detail flex items-start gap-2.5"
          >
            <span
              aria-hidden="true"
              className={cn(
                'mt-1.75 size-1.5 flex-none rounded-full',
                TONE_CLASSES[row.tone].dot,
              )}
            />
            <span className="text-muted-foreground w-16 flex-none pt-0.5 tabular-nums">
              {timeOf(row.at)}
            </span>
            <LogAvatar row={row} />
            <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
              <span>{textOf(row)}</span>
              {row.kind === 'counted' && view.differenceReason ? (
                <span
                  data-testid={`${T}-log-reason`}
                  className="text-muted-foreground text-caption"
                >
                  {t(K.logReason, { reason: view.differenceReason })}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The report's five cells: opening, cash in and out, counted, difference, net by mode. */
function ReportStrip({ view }: { view: DayCloseView }) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const tone = view.autoClosed ? 'none' : differenceTone(view.difference);
  const expected = view.expectedCash === null ? '—' : formatRupees(view.expectedCash);
  return (
    <DayCloseStrip testId={`${T}-strip`}>
      <StripCell label={t(STRIP.opening)} testId={`${T}-opening`}>
        <StripFigure>{formatRupees(view.opening.cash)}</StripFigure>
        <StripSub>
          {view.acceptedBy
            ? t(K.acceptedBy, { name: shortPersonName(view.acceptedBy.name) })
            : t(K.openedAuto)}
        </StripSub>
      </StripCell>
      <StripCell label={t(STRIP.cashInOut)} testId={`${T}-cash`}>
        <StripFigure className="flex flex-wrap gap-1.5">
          <span className="text-tone-sage-foreground">
            {t(STRIP.cashIn, { amount: formatRupees(view.cashIn) })}
          </span>
          <span className="text-tone-blush-foreground">
            {t(STRIP.cashOut, { amount: formatRupees(view.cashOut) })}
          </span>
        </StripFigure>
        <StripSub>
          {`${t(K.received, { count: view.collectedCount })} · ${t(K.paid, { count: view.paidOutCount })}`}
        </StripSub>
      </StripCell>
      <StripCell label={t(K.cashCounted)} testId={`${T}-counted`}>
        <StripFigure>{formatRupees(view.countedCash ?? 0)}</StripFigure>
        <StripSub>
          {view.autoClosed ? t(K.takenAsExpected) : t(K.expected, { amount: expected })}
        </StripSub>
      </StripCell>
      <StripCell label={t(K.difference)} testId={`${T}-difference`}>
        <StripFigure
          className={
            tone === 'gap' ? 'text-tone-blush-foreground' : 'text-tone-sage-foreground'
          }
        >
          {view.autoClosed ? '—' : differenceText(view.difference, formatRupees)}
        </StripFigure>
        <StripSub>{differenceSub(view, t)}</StripSub>
      </StripCell>
      <DayCloseNetByMode
        view={view}
        testId={`${T}-strip`}
        className="max-md:col-span-full"
      />
    </DayCloseStrip>
  );
}

/**
 * The closed day's report (`payments.md:331`; H:5117–5121): "Today is closed" with who closed it
 * and when (or "auto-closed after the grace period" — the worker's `close_kind: auto`), Reopen
 * for those who may (`payment:delete`), the five-cell strip — the opening, the server's cash in
 * and out with the day's entries each way, the counted and expected cash, the server's
 * difference ("Not counted" when the worker took it as expected), the net by mode — and what
 * happened.
 */
export function DayCloseReport({
  view,
  dayTitle,
  canReopen,
  onReopen,
}: DayCloseReportProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const sub = useClosedSub(view);
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
        <span data-testid={`${T}-sub`} className="text-detail text-muted-foreground">
          {sub}
        </span>
        <span className="flex-1" />
        {canReopen ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReopen}
            className="text-detail h-8 px-3"
            data-testid={`${T}-reopen`}
          >
            {t(K.reopen)}
          </Button>
        ) : null}
      </div>
      <ReportStrip view={view} />
      <DayLog view={view} />
    </section>
  );
}
