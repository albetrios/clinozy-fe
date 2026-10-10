import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { DayOpening } from '@/shared/api/clinic/day-close-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { DrawerNumberInput } from '@/shared/components/DrawerField/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { Wallet } from '@/shared/icons/index.ts';

import {
  DAY_CLOSE_TEST_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from '../../payments.constants.ts';
import { useDayLabel } from '../../shared/hooks/useDayLabel/index.ts';
import { countDifference, typedRupees } from './day-close-view.ts';

const K = PAYMENTS_KEYS.dayClose.gate;
const T = `${DAY_CLOSE_TEST_ID}-gate`;

/** The longest recount a drawer can hold, as typed (`payments.md:189`). */
const RECOUNT_MAX_LENGTH = 8;

/** Props of {@link DayCloseGate}. */
export interface DayCloseGateProps {
  opening: DayOpening;
  /** "Today", "Yesterday", "2 Oct". */
  dayTitle: string;
  /** "Riya S." — who the day is stamped with. */
  myName: string;
  /** Accept the opening (`payment:update`): without it the gate only shows the opening. */
  canAct: boolean;
  accepting: boolean;
  /** Accept: the recount in rupees when one was typed and differs, else null (carried). */
  onAccept: (recount: number | null) => void;
}

/** The opening's source line: "Carried from Oct 1 close", or the branch's first day at ₹0. */
function useSourceText(opening: DayOpening): string {
  const { t } = useTranslation(PAYMENTS_NS);
  const dayLabel = useDayLabel({ relative: false });
  if (opening.source === 'recounted') return t(K.sources.recounted);
  return opening.from
    ? t(K.sources.carried, { day: dayLabel(opening.from) })
    : t(K.sources.first);
}

/**
 * The gate (`payments.md:331`; H:5114–5116): before the day starts, the opening cash clinozy-be
 * would carry — the last close's count before the day, ₹0 for a branch's first (no default
 * float, §6 #17) — with a Recount box; "Accept ₹2,000" (or "Accept recount") opens the day
 * (`POST /app/day-closes`) and stamps who did it.
 */
export function DayCloseGate({
  opening,
  dayTitle,
  myName,
  canAct,
  accepting,
  onAccept,
}: DayCloseGateProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const formatRupees = useRupeeFormat();
  const [recount, setRecount] = useState('');
  const typed = typedRupees(recount);
  // Compared in paise: a recount equal to the carried amount accepts it as carried.
  const recounted = typed !== null && countDifference(typed, opening.cash) !== 0;
  const source = useSourceText(opening);

  return (
    <section
      data-testid={T}
      className="bg-background animate-reveal flex flex-col items-center gap-3.5 rounded-xl border px-6 py-8 text-center"
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-11 items-center justify-center rounded-xl',
          TONE_CLASSES.peach.surface,
        )}
      >
        <Wallet className="size-5" />
      </span>
      <span className="text-micro text-muted-foreground font-semibold tracking-[0.05em] uppercase">
        {t(K.title, { day: dayTitle })}
      </span>
      <span
        data-testid={`${T}-amount`}
        className="text-display font-semibold tabular-nums"
      >
        {formatRupees(opening.cash)}
      </span>
      <span data-testid={`${T}-source`} className="text-detail text-muted-foreground">
        {source}
      </span>
      {canAct ? (
        <div className="mt-1.5 flex max-w-full flex-wrap items-center justify-center gap-2">
          <DrawerNumberInput
            value={recount}
            onValueChange={setRecount}
            prefix={tDrawer(RECORD_DRAWER_KEYS.currency)}
            placeholder={t(K.recount)}
            aria-label={t(K.recountLabel)}
            title={t(K.recountTitle)}
            maxLength={RECOUNT_MAX_LENGTH}
            className="h-10 w-44"
            inputClassName="text-end text-sm font-semibold"
            data-testid={`${T}-recount`}
          />
          <Button
            type="button"
            disabled={accepting}
            onClick={() => onAccept(recounted ? typed : null)}
            className="text-field h-10 px-4 font-semibold"
            data-testid={`${T}-accept`}
          >
            {recounted
              ? t(K.acceptRecount)
              : t(K.accept, { amount: formatRupees(opening.cash) })}
          </Button>
        </div>
      ) : null}
      <span className="text-muted-foreground text-xs">
        {canAct ? t(K.starting, { name: myName }) : tDrawer(RECORD_DRAWER_KEYS.readOnly)}
      </span>
    </section>
  );
}
