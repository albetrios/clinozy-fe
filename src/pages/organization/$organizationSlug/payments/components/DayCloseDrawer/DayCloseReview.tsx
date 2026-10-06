import type { TFunction } from 'i18next';
import { type KeyboardEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import {
  TABLE_KEYS,
  TABLE_NS,
} from '@/shared/components/DataTable/data-table.constants.ts';
import {
  type DataTableRowAction,
  DataTableRowActions,
} from '@/shared/components/DataTableRowActions/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import {
  LedgerAmountCell,
  LedgerModeCell,
  LedgerPartyCell,
  LedgerWhatCell,
  LedgerWhenCell,
} from '@/shared/components/LedgerCells/index.ts';
import { Progress } from '@/shared/components/ui/progress.tsx';
import { Check, ChevronDown, Lock } from '@/shared/icons/index.ts';

import {
  DAY_CLOSE_TEST_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from '../../payments.constants.ts';

const K = PAYMENTS_KEYS.dayClose.review;
const T = `${DAY_CLOSE_TEST_ID}-review`;

/**
 * The review's rows (Q-G11; `payments.md:61`): Checkbox · Ref · What · When ·
 * From / to · Mode · Amount · State · actions. With State and the actions
 * filled (the prototype leaves them empty) the nine columns need 910px, so
 * below that — a phone, 820's 724px card — each row re-grids to checkbox ·
 * Ref over From / to · Amount over the actions and the header hides
 * (H:158–167; `@container`, D33). From 910px a row is a line of fixed-width
 * cells, the header's the same — 28 · 80 · 64 · 112 · the rest · 88 · 96 · 96
 * · 88px, the last for a tablet's 36px action buttons (the prototype's `28px
 * 96px 64px 120px minmax(160px,1fr) 90px 110px 110px auto` had no actions to
 * fit) — so the grid placements of the narrow rows need no undoing.
 */
const ROW_LAYOUT =
  'grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 @min-[910px]:flex';
/** A cell that only the wide rows show. */
const WIDE_ONLY = 'hidden flex-none @min-[910px]:flex';
/** Each column's width from 910px — header and rows alike. */
const COLUMN = {
  check: 'w-7 flex-none',
  ref: 'w-20 flex-none',
  what: 'w-16',
  when: 'w-28 min-w-0',
  party: 'min-w-0 flex-1',
  mode: 'w-22',
  amount: 'w-24 flex-none',
  state: 'w-24',
  actions: 'w-22 flex-none',
} as const;

/** Props of {@link DayCloseReview}. */
export interface DayCloseReviewProps {
  entries: readonly LedgerRow[];
  checkedIds: readonly string[];
  /** Ticks need the `dayclose` ability. */
  canCheck: boolean;
  onCheck: (row: LedgerRow, checked: boolean) => void;
  /** A row's click — the ledger's: its drawer on an open day, else the lock's toast. */
  onOpen: (row: LedgerRow) => void;
  /** The row's actions (Edit, Delete) — none on a locked entry. */
  actionsOf: (row: LedgerRow) => DataTableRowAction[];
}

/** The State pill: "Can edit", "Day closed" with its lock, or "From CR-2" — the credit's entry. */
function EntryState({ row, t }: { row: LedgerRow; t: TFunction }) {
  if (row.pendingCreditSeq !== null) {
    return (
      <TonePill tone="neutral" size="sm">
        {t(K.states.fromCredit, {
          credit: displayId.pendingCredit(row.pendingCreditSeq),
        })}
      </TonePill>
    );
  }
  if (row.locked) {
    return (
      <TonePill
        tone="neutral"
        size="sm"
        icon={<Lock className="size-3" />}
        title={t(K.states.dayClosedTitle)}
      >
        {t(K.states.dayClosed)}
      </TonePill>
    );
  }
  return (
    <TonePill tone="sky" size="sm" title={t(K.states.canEditTitle)}>
      {t(K.states.canEdit)}
    </TonePill>
  );
}

/** One entry of the review. */
function ReviewRow({
  row,
  checked,
  canCheck,
  onCheck,
  onOpen,
  actions,
}: {
  row: LedgerRow;
  checked: boolean;
  canCheck: boolean;
  onCheck: (checked: boolean) => void;
  onOpen: () => void;
  actions: DataTableRowAction[];
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const openOnEnter = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || event.target !== event.currentTarget) return;
    event.preventDefault();
    onOpen();
  };
  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={openOnEnter}
      data-checked={checked || undefined}
      data-testid={`${T}-row`}
      className={cn(
        ROW_LAYOUT,
        'border-b-muted text-detail cursor-pointer items-center border-b px-4 py-2 transition-colors duration-120 last:border-b-0',
        checked ? 'bg-tone-sage-tint' : 'hover:bg-canvas',
      )}
    >
      <span
        role="cell"
        className={cn('col-start-1 row-span-2 row-start-1 flex', COLUMN.check)}
      >
        {/* The design's 20px box (H:5108): `success` fills it once ticked. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={t(K.check)}
          title={t(K.check)}
          disabled={!canCheck}
          onClick={(event) => {
            event.stopPropagation();
            onCheck(!checked);
          }}
          data-testid={`${T}-check-${row.id}`}
          className={cn(
            'flex size-5 items-center justify-center rounded-md border-[1.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            checked
              ? 'bg-success text-success-foreground border-transparent'
              : 'bg-background border-border-strong',
          )}
        >
          {checked ? <Check aria-hidden="true" className="size-3.5" /> : null}
        </button>
      </span>
      <span
        role="cell"
        className={cn(
          'text-muted-foreground-strong col-start-2 row-start-1 font-medium tabular-nums',
          COLUMN.ref,
        )}
      >
        {displayId.payment(row.seq)}
      </span>
      <span role="cell" className={cn(WIDE_ONLY, COLUMN.what)}>
        <LedgerWhatCell row={row} size="sm" className="max-w-none" />
      </span>
      <span role="cell" className={cn(WIDE_ONLY, COLUMN.when)}>
        <LedgerWhenCell row={row} />
      </span>
      <span role="cell" className={cn('col-start-2 row-start-2 flex', COLUMN.party)}>
        <LedgerPartyCell row={row} />
      </span>
      <span role="cell" className={cn(WIDE_ONLY, COLUMN.mode)}>
        <LedgerModeCell row={row} size="sm" />
      </span>
      <span
        role="cell"
        className={cn(
          'col-start-3 row-start-1 flex justify-end justify-self-end',
          COLUMN.amount,
        )}
      >
        <LedgerAmountCell row={row} />
      </span>
      <span role="cell" className={cn(WIDE_ONLY, COLUMN.state)}>
        <EntryState row={row} t={t} />
      </span>
      <span
        role="cell"
        className={cn(
          'col-start-3 row-start-2 flex justify-end justify-self-end',
          COLUMN.actions,
        )}
      >
        {actions.length > 0 ? (
          <DataTableRowActions actions={actions} testIdPrefix={`${T}-${row.seq}`} />
        ) : null}
      </span>
    </div>
  );
}

/**
 * "Review every entry" (`payments.md:57–67`; H:5139): a collapsible card —
 * "0 of 3 checked" over a 4px progress bar — listing every entry of the day,
 * newest first. Ticking an entry tints its row; a row opens like the
 * ledger's. The State and actions cells are filled (Q-G11 — the prototype
 * leaves them empty).
 */
export function DayCloseReview({
  entries,
  checkedIds,
  canCheck,
  onCheck,
  onOpen,
  actionsOf,
}: DayCloseReviewProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tTable } = useTranslation(TABLE_NS);
  const [open, setOpen] = useState(false);
  const checked = new Set(checkedIds);
  const done = entries.filter((row) => checked.has(row.id)).length;
  const percent = entries.length > 0 ? Math.round((done / entries.length) * 100) : 0;
  const columns = PAYMENTS_KEYS.columns;

  return (
    <section
      data-testid={T}
      className="bg-background @container overflow-hidden rounded-xl border"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        data-testid={`${T}-toggle`}
        className="hover:bg-canvas flex w-full items-center gap-3 px-4 py-3 text-start transition-colors"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-field font-semibold">{t(K.title)}</span>
            <span
              data-testid={`${T}-progress`}
              className="text-muted-foreground truncate text-xs"
            >
              {entries.length > 0
                ? t(K.progress, { checked: done, count: entries.length })
                : t(K.none)}
            </span>
          </span>
          <Progress
            value={percent}
            aria-label={t(K.title)}
            className="bg-muted [&>div]:bg-success h-1"
          />
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'text-muted-foreground size-4 flex-none transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && entries.length === 0 ? (
        <EmptyState
          variant="inline"
          title={t(K.empty)}
          testId={`${T}-empty`}
          className="animate-reveal border-t px-4 py-6 text-center text-sm"
        />
      ) : null}
      {open && entries.length > 0 ? (
        <div role="table" aria-label={t(K.title)} className="animate-reveal">
          <div role="rowgroup" className="hidden flex-col @min-[910px]:flex">
            <div
              role="row"
              tabIndex={-1}
              className={cn(
                ROW_LAYOUT,
                'bg-canvas text-micro text-muted-foreground h-9 items-center border-t px-4 font-semibold tracking-[0.04em] uppercase',
              )}
            >
              <span role="columnheader" tabIndex={-1} className={COLUMN.check}>
                <span className="sr-only">{t(K.check)}</span>
              </span>
              <span role="columnheader" tabIndex={-1} className={COLUMN.ref}>
                {t(columns.ref)}
              </span>
              <span
                role="columnheader"
                tabIndex={-1}
                className={cn('flex-none', COLUMN.what)}
              >
                {t(columns.what)}
              </span>
              <span
                role="columnheader"
                tabIndex={-1}
                className={cn('flex-none', COLUMN.when)}
              >
                {t(columns.when)}
              </span>
              <span role="columnheader" tabIndex={-1} className={COLUMN.party}>
                {t(columns.party)}
              </span>
              <span
                role="columnheader"
                tabIndex={-1}
                className={cn('flex-none', COLUMN.mode)}
              >
                {t(columns.mode)}
              </span>
              <span
                role="columnheader"
                tabIndex={-1}
                className={cn('text-end', COLUMN.amount)}
              >
                {t(columns.amount)}
              </span>
              <span
                role="columnheader"
                tabIndex={-1}
                className={cn('flex-none', COLUMN.state)}
              >
                {t(columns.state)}
              </span>
              <span role="columnheader" tabIndex={-1} className={COLUMN.actions}>
                <span className="sr-only">{tTable(TABLE_KEYS.actions)}</span>
              </span>
            </div>
          </div>
          <div role="rowgroup" className="border-t">
            {entries.map((row) => (
              <ReviewRow
                key={row.id}
                row={row}
                checked={checked.has(row.id)}
                canCheck={canCheck}
                onCheck={(next) => onCheck(row, next)}
                onOpen={() => onOpen(row)}
                actions={actionsOf(row)}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
