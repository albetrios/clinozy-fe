import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { VisitDetail } from '@/shared/api/clinic/visits-contracts.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import type { VisitTab } from '@/shared/clinic/visit-access.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  VISIT_HISTORY_FILTERS,
  VISIT_KEYS,
  VISIT_NS,
  VISIT_TEST_IDS,
  type VisitHistoryFilter,
} from '../../visits.constants.ts';
import { treatmentView } from '../VisitTreatment/treatment-view.ts';
import { HISTORY_FILTER_OF, useVisitHistory } from './use-visit-history.ts';

/** No draft — the aside reads the session as the visit has it. */
const NO_DRAFT = { settings: {}, areas: null };

const K = VISIT_KEYS.history;
const ids = VISIT_TEST_IDS.history;

/** Each filter's pill tone (H:4616): Clinical blush, Money butter, Messages lav, Audit stone. */
const FILTER_TONES: Readonly<Record<Exclude<VisitHistoryFilter, 'all'>, Tone>> = {
  clinical: 'blush',
  money: 'butter',
  messages: 'lav',
  audit: 'stone',
};

/** Props of {@link VisitHistory}. */
export interface VisitHistoryProps {
  detail: VisitDetail;
  /** The tabs the member may use — "Next for this visit" offers only those. */
  tabs: readonly VisitTab[];
  onTab: (tab: VisitTab) => void;
}

/** A "Next for this visit" button (padding 10px 12px, radius 8px, 13.5px) in its tone. */
function NextButton({
  tone,
  tab,
  label,
  onTab,
}: {
  tone: Tone;
  tab: VisitTab;
  label: string;
  onTab: (tab: VisitTab) => void;
}) {
  const classes = TONE_CLASSES[tone];
  return (
    <button
      type="button"
      onClick={() => onTab(tab)}
      data-testid={ids.next(tab)}
      className={cn(
        'text-field rounded-lg border px-3 py-2.5 text-start',
        classes.surface,
        classes.border,
      )}
    >
      {label}
    </button>
  );
}

/**
 * The "Next for this visit" lines: the session (the package's next, else the
 * last one's) and the checkout's carried due — each only on a tab the member
 * may use and, for the session, only when the visit has one.
 */
function useNextLabels(detail: VisitDetail) {
  const { t } = useTranslation(VISIT_NS);
  const formatPaise = usePaiseFormat();
  const { name, session, total } = treatmentView(detail, NO_DRAFT);
  const due = detail.previousDue.amount;
  let sessionLabel: string | null = null;
  if (detail.treatment || detail.sessionDue) {
    sessionLabel = total
      ? t(K.nextSession, { treatment: name, session, total })
      : t(K.nextSessionOpen, { treatment: name, session });
  }
  return {
    session: sessionLabel,
    checkout:
      due > 0 ? t(K.nextCheckout, { amount: formatPaise(due) }) : t(K.nextCheckoutPlain),
  };
}

/**
 * Visit sheet › History (KICKOFF §6.13; `today.md:251–254`; H:2496–2521): the
 * filter pills, the patient's activity rows (date · kind pill · line) and the
 * privacy line; the aside "Next for this visit" jumps to the tabs. Two columns
 * (the list, a 300px aside on `canvas`) from `md`; one below, the aside under
 * the list.
 */
export function VisitHistory({ detail, tabs, onTab }: VisitHistoryProps) {
  const { t } = useTranslation(VISIT_NS);
  const [filter, setFilter] = useState<VisitHistoryFilter>('all');
  const { rows, loading } = useVisitHistory(detail);
  const next = useNextLabels(detail);
  const shown = rows.filter(
    (row) => filter === 'all' || HISTORY_FILTER_OF[row.kind] === filter,
  );

  return (
    <div
      data-testid={ids.root}
      className="grid h-full min-h-0 grid-cols-1 max-md:h-auto md:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div className="flex min-h-0 flex-col gap-2.5 px-5.5 py-4 max-md:px-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground-strong me-1 text-xs">{t(K.show)}</span>
          {VISIT_HISTORY_FILTERS.map((value) => {
            const on = filter === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(value)}
                data-testid={ids.filter(value)}
                data-slot="pill"
                className={cn(
                  'rounded-full border px-2.75 py-0.75 text-xs',
                  on ? 'bg-tone-butter border-tone-butter-border' : 'bg-transparent',
                )}
              >
                {t(K.filters[value])}
              </button>
            );
          })}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto max-md:overflow-visible">
          {loading ? (
            <SkeletonRows rows={5} label={t(VISIT_KEYS.loadingName)} rowClassName="h-9" />
          ) : (
            <ul className="flex flex-col">
              {shown.map((row) => {
                const tone = TONE_CLASSES[FILTER_TONES[HISTORY_FILTER_OF[row.kind]]];
                return (
                  <li
                    key={row.id}
                    data-testid={ids.row}
                    data-kind={row.kind}
                    className="text-body grid grid-cols-[110px_90px_minmax(0,1fr)] items-baseline gap-3 border-b py-2.25 max-md:grid-cols-[88px_76px_minmax(0,1fr)] max-md:gap-2"
                  >
                    <span className="text-muted-foreground-strong text-xs tabular-nums">
                      {row.when}
                    </span>
                    <span
                      data-slot="pill"
                      className={cn(
                        'text-micro justify-self-start rounded-full px-2 py-px',
                        tone.surface,
                      )}
                    >
                      {t(K.kinds[row.kind])}
                    </span>
                    <span className="min-w-0 break-words">{row.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-muted-foreground-strong py-2.5 text-xs">{t(K.note)}</p>
        </div>
      </div>
      <aside className="bg-canvas flex flex-col gap-2.5 border-t p-4 max-md:p-3 md:border-s md:border-t-0">
        <h3 className="text-micro text-muted-foreground-strong font-normal tracking-[0.08em] uppercase">
          {t(K.next)}
        </h3>
        {tabs.includes('consult') ? (
          <NextButton tone="blush" tab="consult" label={t(K.nextConsult)} onTab={onTab} />
        ) : null}
        {tabs.includes('treatment') && next.session ? (
          <NextButton tone="sage" tab="treatment" label={next.session} onTab={onTab} />
        ) : null}
        {tabs.includes('checkout') ? (
          <NextButton tone="butter" tab="checkout" label={next.checkout} onTab={onTab} />
        ) : null}
        <p className="text-detail text-foreground-soft mt-1.5 leading-[1.5]">
          {t(K.aside)}
        </p>
      </aside>
    </div>
  );
}
