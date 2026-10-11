import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { appToday } from '@/shared/api/app/app-time.ts';
import { dayCloseQueryKeys } from '@/shared/api/app/day-close-api.ts';
import type {
  CloseDayInput,
  DayCloseView,
} from '@/shared/api/app/day-close-contracts.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { shortPersonName } from '@/shared/components/Cells/index.ts';
import { ledgerEntryLock } from '@/shared/components/LedgerCells/index.ts';
import { PanelSkeleton } from '@/shared/components/PanelSkeleton/index.ts';
import {
  PaymentDeleteConfirm,
  type PaymentDeleteTarget,
} from '@/shared/components/PaymentDeleteConfirm/index.ts';
import { PaymentReverseConfirm } from '@/shared/components/PaymentReverseConfirm/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { mapValidationErrors } from '@/shared/errors/map-validation-errors.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useLedgerRowActions } from '@/shared/hooks/useLedgerRowActions/index.ts';
import { useMyMembershipId } from '@/shared/hooks/useMyMembership/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { useTeamDirectory } from '@/shared/hooks/useTeamDirectory/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import {
  useAcceptOpeningCash,
  useCloseDay,
  useDayClose,
} from '../../hooks/useDayClose/index.ts';
import {
  DAY_CLOSE_TEST_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from '../../payments.constants.ts';
import type { DayCloseSearch } from '../../payments.dialog-search.ts';
import { useDayLabel } from '../../shared/hooks/useDayLabel/index.ts';
import { ReceivePaymentDrawer } from '../ReceivePaymentDrawer/index.ts';
import { SendPaymentDrawer } from '../SendPaymentDrawer/index.ts';
import { countNeedsReason, dayCloseBranchId, typedRupees } from './day-close-view.ts';
import { DayCloseBar } from './DayCloseBar.tsx';
import { DayCloseGate } from './DayCloseGate.tsx';
import {
  DayCloseReopenConfirm,
  type DayCloseReopenTarget,
} from './DayCloseReopenConfirm.tsx';
import { DayCloseReport } from './DayCloseReport.tsx';
import { DayCloseReview } from './DayCloseReview.tsx';
import { DayCloseWorking, type DayCountErrors } from './DayCloseWorking.tsx';

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

/** The signed-in member as the team directory has them — their name and branches. */
function useMyTeamMember(): DirectoryMember | null {
  const myId = useMyMembershipId();
  const { byId } = useTeamDirectory();
  return myId ? (byId.get(myId) ?? null) : null;
}

/**
 * The branch reviewed (Q-G6): the URL's, the header's one, the member's own (the team
 * directory's), else the main one.
 */
function useDayCloseBranch(requested: string | undefined): string | null {
  const { openBranches, isPending } = useBranches();
  const { preferences } = usePreferences();
  const me = useMyTeamMember();
  if (isPending) return null;
  return dayCloseBranchId({
    branches: openBranches,
    branchFilter: preferences.branchFilter,
    ownBranchIds: me?.branchIds ?? [],
    requested,
  });
}

/** "Riya S." — the signed-in member, as the gate stamps the day. */
function useMyShortName(): string {
  const me = useMyTeamMember();
  const userName = useAuthStore((state) => state.user?.name ?? '');
  return shortPersonName(me?.name ?? userName);
}

/** What the drawer types for a day: the count and, when it is off, why. */
interface CountDraft {
  count: string;
  reason: string;
}

const EMPTY_DRAFT: CountDraft = { count: '', reason: '' };

/**
 * The drawer's count and reason as typed, per branch-day, with the server's refusals of them on
 * their fields — cleared once the day closes, so a reopened day starts a new count (clinozy-be
 * clears the old one).
 */
function useCountDraft(key: string) {
  const [drafts, setDrafts] = useState<Readonly<Record<string, CountDraft>>>({});
  const [errors, setErrors] = useState<DayCountErrors>({});
  const draft = drafts[key] ?? EMPTY_DRAFT;
  const patch = (next: Partial<CountDraft>) => {
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? EMPTY_DRAFT), ...next },
    }));
  };
  return {
    draft,
    errors,
    setErrors,
    setCount: (count: string) => {
      patch({ count });
      setErrors({});
    },
    setReason: (reason: string) => {
      patch({ reason });
      setErrors((current) => ({ ...current, differenceReason: undefined }));
    },
    clear: () => {
      setDrafts((current) => ({ ...current, [key]: EMPTY_DRAFT }));
      setErrors({});
    },
  };
}

/** A refused close's field messages (`counted_cash`, `difference_reason`), as the strip shows them. */
function countErrorsOf(error: unknown): DayCountErrors {
  const found: DayCountErrors = {};
  mapValidationErrors<{ countedCash: string; differenceReason: string }>(
    error,
    (name, { message }) => {
      if (name === 'countedCash' || name === 'differenceReason') found[name] ??= message;
    },
  );
  return found;
}

/**
 * The day's two drawer-level writes, each with its toast: accept the opening, close on the count.
 * clinozy-be's refusals read in the room's words — a day someone opened (`409
 * record_already_exists`) or closed (`409 transition_not_allowed`) meanwhile re-reads the day; a
 * close's `400` lands on the count or the reason.
 */
function useDayWrites({
  branchId,
  date,
  onCountErrors,
  onClosed,
}: {
  branchId: string | null;
  date: string;
  onCountErrors: (errors: DayCountErrors) => void;
  /** The day closed: the typed count is spent. */
  onClosed: () => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const { time: timeOf } = useAppClock();
  const queryClient = useQueryClient();
  const accept = useAcceptOpeningCash({ notifyOnError: false });
  const close = useCloseDay({ notifyOnError: false });
  const refreshDay = () => {
    queryClient
      .invalidateQueries({ queryKey: dayCloseQueryKeys.all })
      .catch(() => undefined);
  };
  /** A refusal the day explains once read again; anything else, the server's words. */
  const report = (error: unknown, refusal: { reason: string; key: string }) => {
    refreshDay();
    notify.error(
      apiErrorReason(error) === refusal.reason ? t(refusal.key) : mapApiError(error),
    );
  };
  return {
    accepting: accept.isPending,
    closing: close.isPending,
    accept: (recount: number | null) =>
      accept.mutate(
        { branchId: branchId ?? '', date, recount },
        {
          onSuccess: (record) =>
            notify.success(
              t(K.gate.accepted, {
                amount: formatRupees(record.openingCash),
                time: timeOf(record.openingAcceptedAt),
              }),
            ),
          onError: (error) =>
            report(error, {
              reason: 'record_already_exists',
              key: K.refusals.alreadyOpened,
            }),
        },
      ),
    close: (input: CloseDayInput) =>
      close.mutate(input, {
        onSuccess: () => {
          onClosed();
          notify.success(t(K.closed));
        },
        onError: (error) => {
          const fields = countErrorsOf(error);
          if (Object.keys(fields).length === 0) {
            report(error, {
              reason: 'transition_not_allowed',
              key: K.refusals.alreadyClosed,
            });
            return;
          }
          // The expected cash may have moved under the count: read the day again.
          refreshDay();
          onCountErrors(fields);
        },
      }),
  };
}

/** The day's state card: the gate, the working strip, or the report. */
function DayStateCard({
  view,
  counting,
  canAct,
  canReopen,
  writes,
  onReopen,
}: {
  view: DayCloseView;
  counting: ReturnType<typeof useCountDraft>;
  /** Accept the opening and close (`payment:update`). */
  canAct: boolean;
  /** Reopen a closed day (`payment:delete`). */
  canReopen: boolean;
  writes: ReturnType<typeof useDayWrites>;
  /** Reopen pressed: the closed day for the confirm. */
  onReopen: (target: DayCloseReopenTarget) => void;
}) {
  const titleOf = useDayLabel({ yesterday: true });
  const myName = useMyShortName();
  const reopenLabel = useReopenLabel(view);
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
        count={counting.draft.count}
        onCountChange={counting.setCount}
        reason={counting.draft.reason}
        onReasonChange={counting.setReason}
        errors={counting.errors}
        canAct={canAct}
      />
    );
  }
  return (
    <DayCloseReport
      view={view}
      dayTitle={titleOf(view.date)}
      canReopen={canReopen && view.canReopen && view.close !== null}
      onReopen={() => {
        if (view.close) onReopen({ closeId: view.close.id, label: reopenLabel });
      }}
    />
  );
}

/**
 * An entry's drawer over Day close (H:996, z below the page drawers): Receive or Send, in edit —
 * view only without `payment:update`.
 */
function EntryDrawer({
  entry,
  readOnly,
  onClose,
}: {
  entry: LedgerRow | null;
  readOnly: boolean;
  onClose: () => void;
}) {
  if (!entry) return null;
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

/** The closed day's pill in the reopen confirm: "Vesu · Oct 9". */
function useReopenLabel(view: DayCloseView): string {
  const { t } = useTranslation(PAYMENTS_NS);
  const { openBranches } = useBranches();
  const dayLabel = useDayLabel({ relative: false });
  const branch = openBranches.find((option) => option.id === view.branchId);
  return branch
    ? t(K.reopen.record, { branch: branch.name, day: dayLabel(view.date) })
    : dayLabel(view.date);
}

/**
 * The row-level dialogs over Day close: an open day's entry in its drawer, its delete confirm,
 * and a closed day's entry's reversal — the ledger's own, by the member's codes.
 */
function useEntryDialogs() {
  const { t } = useTranslation(PAYMENTS_NS);
  const access = usePaymentAccess();
  const [editing, setEditing] = useState<LedgerRow | null>(null);
  const [deleting, setDeleting] = useState<PaymentDeleteTarget | null>(null);
  const [reversing, setReversing] = useState<LedgerRow | null>(null);
  const actionsOf = useLedgerRowActions({
    onEdit: setEditing,
    onDelete: setDeleting,
    onReverse: setReversing,
  });
  const openEntry = (row: LedgerRow) => {
    const lock = ledgerEntryLock(row, t);
    if (lock) notify.info(lock);
    else setEditing(row);
  };
  const dialogs = (
    <>
      <EntryDrawer
        entry={editing}
        readOnly={access.resolved && !access.canEdit}
        onClose={() => setEditing(null)}
      />
      <PaymentDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <PaymentReverseConfirm entry={reversing} onClose={() => setReversing(null)} />
    </>
  );
  return { actionsOf, openEntry, dialogs };
}

/**
 * "Close day" from the bar: the count first ("Count the cash first"), then why it is off when it
 * differs from the server's expected cash — clinozy-be refuses a close without it — then the
 * close on the count, in rupees.
 */
function useCloseDayAction({
  view,
  counting,
  writes,
}: {
  view: DayCloseView | undefined;
  counting: ReturnType<typeof useCountDraft>;
  writes: ReturnType<typeof useDayWrites>;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  return () => {
    const closeId = view?.close?.id;
    if (closeId === undefined) return;
    const counted = typedRupees(counting.draft.count);
    if (counted === null) {
      notify.warning(t(K.countFirst));
      return;
    }
    const reason = counting.draft.reason.trim();
    if (reason === '' && countNeedsReason(counted, view?.expectedCash ?? null)) {
      notify.warning(t(K.strip.reasonFirst));
      counting.setErrors({ differenceReason: t(K.strip.reasonFirst) });
      return;
    }
    writes.close({
      closeId,
      countedCash: counted,
      differenceReason: reason === '' ? null : reason,
    });
  };
}

/** The day while it is not here: bars while it loads, Retry in place when it can't. */
function DayLoadState({ query }: { query: ReturnType<typeof useDayClose> }) {
  const { t } = useTranslation(PAYMENTS_NS);
  if (query.data) return null;
  if (query.isError) {
    return (
      <RetryError
        onRetry={() => {
          query.refetch().catch(() => undefined);
        }}
        isRetrying={query.isFetching}
      />
    );
  }
  return <PanelSkeleton name={t(K.title)} testId={`${DAY_CLOSE_TEST_ID}-loading`} />;
}

/**
 * Day close (KICKOFF §6.9; `payments.md:57–80, 182–194, 268–280, 326–331`; H:996–1012,
 * H:5083–5125) on clinozy-be (`/app/day-closes`) — the record drawer at 1040px (full screen below
 * `md`) on the canvas, with no footer: its actions sit in the bar. The bar picks the day and the
 * URL keeps it with the branch; the day runs gate → working → report: accept the opening cash
 * (carried, or recounted), count the drawer and "Close day" — the count against the server's
 * expected cash, with why when it is off; the day's money locks — then the report, its figures
 * and its steps the server's, with Reopen and its reason. "Review every entry" lists the day's
 * entries; a row opens the entry's drawer over it, as on the ledger, and a closed day's entry
 * offers Reverse. Accept and Close day need `payment:update`, Reopen `payment:delete` (the
 * OpenAPI); the drawer opens with `payment:read`. Esc closes it.
 */
export function DayCloseDrawer({
  open,
  search,
  onDayChange,
  onClose,
}: DayCloseDrawerProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const [today] = useState(() => appToday());
  const date = search.date && search.date <= today ? search.date : today;
  const branchId = useDayCloseBranch(search.branch);
  const query = useDayClose(branchId, date);
  const view = query.data;
  const access = usePaymentAccess();
  const counting = useCountDraft(`${branchId}|${date}`);
  const writes = useDayWrites({
    branchId,
    date,
    onCountErrors: counting.setErrors,
    onClosed: counting.clear,
  });
  const closeDay = useCloseDayAction({ view, counting, writes });
  const [reopening, setReopening] = useState<DayCloseReopenTarget | null>(null);
  const entries = useEntryDialogs();

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(K.title)}
        width={1040}
        hideFooter
        bodyClassName="bg-canvas px-(--drawer-pad-x) pt-3 pb-5"
        testId={DAY_CLOSE_TEST_ID}
      >
        <TooltipProvider delayDuration={160}>
          <div className="flex flex-col gap-3">
            <DayCloseBar
              date={date}
              today={today}
              view={view}
              canClose={access.canEdit && view?.state === 'open'}
              closing={writes.closing}
              onDayChange={onDayChange}
              onCloseDay={closeDay}
            />
            <DayLoadState query={query} />
            {view ? (
              <>
                <DayStateCard
                  key={`${view.branchId}|${view.date}|${view.state}`}
                  view={view}
                  counting={counting}
                  canAct={access.canEdit}
                  canReopen={access.canDelete}
                  writes={writes}
                  onReopen={setReopening}
                />
                <DayCloseReview
                  entries={view.entries}
                  onOpen={entries.openEntry}
                  actionsOf={entries.actionsOf}
                />
              </>
            ) : null}
          </div>
        </TooltipProvider>
      </RecordDrawer>
      {entries.dialogs}
      <DayCloseReopenConfirm target={reopening} onClose={() => setReopening(null)} />
    </>
  );
}
