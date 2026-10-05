import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { cn } from '@/lib/utils.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { DayCloseView } from '@/shared/api/clinic/day-close-contracts.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { ledgerEntryLock, useLedgerTime } from '@/shared/components/LedgerCells/index.ts';
import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import {
  PaymentDeleteConfirm,
  type PaymentDeleteTarget,
} from '@/shared/components/PaymentDeleteConfirm/index.ts';
import {
  DRAWER_WIDTH_CLASS,
  RECORD_DRAWER_OVERLAY_CLASS,
  RECORD_DRAWER_PANEL_CLASS,
  useDrawerTitleFocus,
} from '@/shared/components/RecordDrawer/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { Sheet, SheetContent, SheetTitle } from '@/shared/components/ui/sheet.tsx';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useLedgerRowActions } from '@/shared/hooks/useLedgerRowActions/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useMyStaffProfile } from '@/shared/hooks/useTeam/index.ts';
import { X } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import {
  useAcceptOpeningCash,
  useCloseDay,
  useDayClose,
  useEntryCheck,
  useReopenDay,
} from '../../hooks/useDayClose/index.ts';
import {
  DAY_CLOSE_TEST_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from '../../payments.constants.ts';
import type { DayCloseSearch } from '../../payments.search.ts';
import { useDayLabel } from '../../shared/hooks/useDayLabel/index.ts';
import { ReceivePaymentDrawer } from '../ReceivePaymentDrawer/index.ts';
import { SendPaymentDrawer } from '../SendPaymentDrawer/index.ts';
import { dayCloseBranchId, typedPaise } from './day-close-view.ts';
import { DayCloseBar } from './DayCloseBar.tsx';
import { DayCloseGate } from './DayCloseGate.tsx';
import { DayCloseReport } from './DayCloseReport.tsx';
import { DayCloseReview } from './DayCloseReview.tsx';
import { DayCloseWorking } from './DayCloseWorking.tsx';

const K = PAYMENTS_KEYS.dayClose;

/** Props of {@link DayCloseDrawer}. */
export interface DayCloseDrawerProps {
  open: boolean;
  /** `?date=` (default today) and `?branch=` (`S:91`). */
  search: DayCloseSearch;
  /** Another day picked — the URL keeps it, so the ledger behind lists that day. */
  onDayChange: (date: string) => void;
  onClose: () => void;
}

/** The branch reviewed (Q-G6): the URL's, the header's one, the member's own, else the main. */
function useDayCloseBranch(requested: string | undefined): string | null {
  const { openBranches, isPending } = useBranches();
  const { preferences } = usePreferences();
  const me = useMyStaffProfile();
  if (isPending) return null;
  return dayCloseBranchId({
    branches: openBranches,
    branchFilter: preferences.branchFilter,
    ownBranchIds: me.data?.branchIds ?? [],
    requested,
  });
}

/** "Riya S." — the signed-in member, as the gate stamps the day. */
function useMyShortName(): string {
  const me = useMyStaffProfile();
  const userName = useAuthStore((state) => state.user?.name ?? '');
  return shortPersonName(me.data ? personFullName(me.data) : userName);
}

/** The drawer's count as typed, per branch-day — a reopened day starts on its last count. */
function useCount(key: string, view: DayCloseView | undefined) {
  const [counts, setCounts] = useState<Readonly<Record<string, string>>>({});
  const saved = view?.countedCash == null ? '' : String(view.countedCash / 100);
  return {
    count: counts[key] ?? saved,
    setCount: (text: string) => setCounts((current) => ({ ...current, [key]: text })),
  };
}

/** The day's writes, each with its toast: accept the opening, close, reopen, tick an entry. */
function useDayWrites(branchId: string | null, date: string) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const timeOf = useLedgerTime();
  const key = { branchId: branchId ?? '', date };
  const accept = useAcceptOpeningCash();
  const close = useCloseDay();
  const reopen = useReopenDay();
  const check = useEntryCheck(key);
  return {
    accepting: accept.isPending,
    closing: close.isPending,
    reopening: reopen.isPending,
    accept: (recount: number | null) =>
      accept.mutate(
        { ...key, recount },
        {
          onSuccess: (record) =>
            notify.success(
              t(K.gate.accepted, {
                amount: formatPaise(record.openingCash),
                time: record.openingAcceptedAt ? timeOf(record.openingAcceptedAt) : '',
              }),
            ),
        },
      ),
    close: (countedCash: number) =>
      close.mutate(
        { ...key, countedCash },
        { onSuccess: () => notify.success(t(K.closed)) },
      ),
    reopen: () => reopen.mutate(key, { onSuccess: () => notify.success(t(K.reopened)) }),
    check: (row: LedgerRow, checked: boolean) =>
      check.mutate({ ...key, paymentId: row.id, checked }),
  };
}

/** The day's state card: the gate, the working strip, or the report. */
function DayStateCard({
  view,
  count,
  onCountChange,
  canAct,
  writes,
}: {
  view: DayCloseView;
  count: string;
  onCountChange: (text: string) => void;
  canAct: boolean;
  writes: ReturnType<typeof useDayWrites>;
}) {
  const titleOf = useDayLabel({ yesterday: true });
  const myName = useMyShortName();
  if (view.state === 'gate') {
    return (
      <DayCloseGate
        opening={view.opening}
        dayTitle={titleOf(view.date)}
        myName={myName}
        canAct={canAct}
        accepting={writes.accepting}
        onAccept={writes.accept}
      />
    );
  }
  if (view.state === 'open') {
    return (
      <DayCloseWorking
        view={view}
        count={count}
        onCountChange={onCountChange}
        canAct={canAct}
      />
    );
  }
  return (
    <DayCloseReport
      view={view}
      dayTitle={titleOf(view.date)}
      canReopen={canAct && view.canReopen}
      reopening={writes.reopening}
      onReopen={writes.reopen}
    />
  );
}

/** An entry's drawer over Day close (H:996, z below the page drawers): Receive or Send, in edit. */
function EntryDrawer({
  entry,
  onClose,
}: {
  entry: LedgerRow | null;
  onClose: () => void;
}) {
  const access = useClinicAccess();
  if (!entry) return null;
  const readOnly = access.isResolved && !access.can('payments', 'edit');
  return entry.direction === 'received' ? (
    <ReceivePaymentDrawer
      open
      mode="edit"
      entry={entry}
      readOnly={readOnly}
      onClose={onClose}
    />
  ) : (
    <SendPaymentDrawer
      open
      mode="edit"
      entry={entry}
      readOnly={readOnly}
      onClose={onClose}
    />
  );
}

/**
 * Day close (KICKOFF §6.9; `payments.md:57–80, 182–194, 268–280, 326–331`;
 * H:996–1012, H:5083–5125) — the right drawer at 1040px (full screen below
 * `md`) on the canvas, under a sticky header with its inline ×. The bar picks
 * the day; the day runs gate → working → report: accept the opening cash, count
 * the drawer and "Close day" (the entries lock), then the report with Reopen
 * inside the grace period. "Review every entry" ticks the day's entries; a row
 * opens the entry's drawer over it, as on the ledger. Close day, Reopen and the
 * ticks need the `dayclose` ability (Q-G4, Q-G1); the drawer opens with
 * Payments View. Esc closes it.
 */
export function DayCloseDrawer({
  open,
  search,
  onDayChange,
  onClose,
}: DayCloseDrawerProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tLocale } = useTranslation(LOCALE_NS);
  const [today] = useState(() => clinicToday());
  const date = search.date && search.date <= today ? search.date : today;
  const branchId = useDayCloseBranch(search.branch);
  const query = useDayClose(branchId, date);
  const view = query.data;
  const access = useClinicAccess();
  const canAct = access.isResolved && access.canAbility('dayclose');
  const writes = useDayWrites(branchId, date);
  const { count, setCount } = useCount(`${branchId}|${date}`, view);
  const [editing, setEditing] = useState<LedgerRow | null>(null);
  const [deleting, setDeleting] = useState<PaymentDeleteTarget | null>(null);
  const actionsOf = useLedgerRowActions({ onEdit: setEditing, onDelete: setDeleting });
  const { titleRef, onOpenAutoFocus, onCloseAutoFocus } = useDrawerTitleFocus();

  const openEntry = (row: LedgerRow) => {
    const lock = ledgerEntryLock(row, t);
    if (lock) notify.info(lock);
    else setEditing(row);
  };
  const closeDay = () => {
    const counted = typedPaise(count);
    if (counted === null) notify.warning(t(K.countFirst));
    else writes.close(counted);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="end"
        showCloseButton={false}
        overlayClassName={RECORD_DRAWER_OVERLAY_CLASS}
        aria-describedby={undefined}
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        data-testid={DAY_CLOSE_TEST_ID}
        className={cn(
          RECORD_DRAWER_PANEL_CLASS,
          DRAWER_WIDTH_CLASS[1040],
          'bg-canvas overflow-y-auto',
        )}
      >
        <TooltipProvider delayDuration={160}>
          <header className="bg-background sticky top-0 z-10 flex h-(--drawer-header-height) flex-none items-center gap-3 border-b px-(--drawer-pad-x)">
            <SheetTitle
              ref={titleRef}
              tabIndex={-1}
              className="flex-1 text-lg font-semibold outline-none"
            >
              {t(K.title)}
            </SheetTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label={tLocale(LOCALE_KEYS.closeAria)}
              title={tLocale(LOCALE_KEYS.closeAria)}
              data-testid={`${DAY_CLOSE_TEST_ID}-close`}
              className="text-muted-foreground-strong hover:bg-muted flex size-8 flex-none items-center justify-center rounded-lg transition-colors"
            >
              <X aria-hidden="true" className="size-4.5" />
            </button>
          </header>
          <div className="flex flex-col gap-3 px-(--drawer-pad-x) pt-3 pb-5">
            <DayCloseBar
              date={date}
              today={today}
              view={view}
              canClose={canAct && view?.state === 'open'}
              closing={writes.closing}
              onDayChange={onDayChange}
              onCloseDay={closeDay}
            />
            {query.isError && !view ? (
              <RetryError
                onRetry={() => void query.refetch()}
                isRetrying={query.isFetching}
              />
            ) : null}
            {query.isError || view ? null : (
              <PanelSkeleton name={t(K.title)} testId={`${DAY_CLOSE_TEST_ID}-loading`} />
            )}
            {view ? (
              <>
                <DayStateCard
                  key={`${view.branchId}|${view.date}|${view.state}`}
                  view={view}
                  count={count}
                  onCountChange={setCount}
                  canAct={canAct}
                  writes={writes}
                />
                <DayCloseReview
                  entries={view.entries}
                  checkedIds={view.checkedIds}
                  canCheck={canAct}
                  onCheck={writes.check}
                  onOpen={openEntry}
                  actionsOf={actionsOf}
                />
              </>
            ) : null}
          </div>
          <EntryDrawer entry={editing} onClose={() => setEditing(null)} />
          <PaymentDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}
