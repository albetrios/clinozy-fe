import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import {
  Controller,
  useForm,
  type UseFormReturn,
  useFormState,
  useWatch,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import type {
  CreditRow,
  CreditSettleResult,
} from '@/shared/api/app/credits-contracts.ts';
import { defaultBranchId } from '@/shared/app/app-branch.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { apiErrorReason, notifyError } from '@/shared/errors/errorHandler.ts';
import type { HttpError } from '@/shared/errors/HttpError.ts';
import { SplitRowsField, splitsTotal } from '@/shared/forms/SplitRowsField/index.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useSettleCredit } from '@/shared/hooks/useCredits/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  SETTLE_CREDIT_KEYS,
  SETTLE_CREDIT_NS,
  SETTLE_CREDIT_TEST_ID,
} from './settle-credit.constants.ts';
import {
  owedInPaise,
  type SettleFormValues,
  settlementOf,
  settleProblem,
  settleStart,
} from './settle-credit.ts';

const K = SETTLE_CREDIT_KEYS;

/** One section, its item rows forcing the drawer to 840px (`payments.md:261`, Q-G2). */
const CONTENT_PROFILE = { fieldCount: 3, hasItems: true } as const;

/** The API's names the form spells differently: the amount is the rows', `paid_at` the day's. */
const SERVER_FIELDS = { amount: 'splits', paidAt: 'paidOn' } as const;

/** Props of {@link SettleCreditDrawer}. */
export interface SettleCreditDrawerProps {
  /** The open credit to settle; null keeps the drawer shut (component state, no URL). */
  credit: CreditRow | null;
  /** The reason as the screen words it — a chip's own label; the stored text by default. */
  reasonLabel?: string;
  /** Back, the floating ×, the backdrop — and a save. */
  onClose: () => void;
}

/**
 * The success toast's entry: the numbers the settlement wrote — "PAY-6", with the credit note a
 * refund on an invoice wrote ("PAY-6 · CN-003") — or, when they did not come back, "Out entry
 * added" / "In entry added".
 */
function entryOf(result: CreditSettleResult, way: CreditRow['direction'], t: TFunction) {
  const numbers = [
    result.paymentSeq === null ? null : displayId.payment(result.paymentSeq),
    result.creditNoteSeq === null ? null : displayId.creditNote(result.creditNoteSeq),
  ].filter((part): part is string => part !== null);
  return numbers.length > 0 ? numbers.join(' · ') : t(K.entry[way]);
}

/**
 * A refusal the drawer tells apart (`409`): the day picked is closed at that branch — the Date
 * field says so; more than the credit's invoice has paid — the rows say so; settled in full
 * meanwhile — the drawer closes on it. Any other says the server's reason.
 */
function useSettleConflict(
  form: UseFormReturn<SettleFormValues>,
  credit: CreditRow,
  onClose: () => void,
) {
  const { t } = useTranslation(SETTLE_CREDIT_NS);
  const refuse = (field: 'paidOn' | 'splits', message: string) => {
    form.setError(field, { type: 'server', message });
    notify.error(message);
  };
  return (error: HttpError) => {
    const reason = apiErrorReason(error);
    if (reason === 'day_closed') {
      refuse('paidOn', t(K.dayClosed));
    } else if (reason === 'more_than_paid') {
      refuse('splits', t(K.moreThanPaid));
    } else if (reason === 'credit_closed') {
      notify.info(t(K.closed, { ref: displayId.pendingCredit(credit.seq) }));
      onClose();
    } else {
      notifyError(error);
    }
  };
}

/** The save: an amount, at most what is owed, then the settlement, its toast and the close. */
function useSettleSave({
  form,
  credit,
  owed,
  onClose,
}: {
  form: UseFormReturn<SettleFormValues>;
  credit: CreditRow;
  /** Paise. */
  owed: number;
  onClose: () => void;
}) {
  const { t } = useTranslation(SETTLE_CREDIT_NS);
  const formatPaise = usePaiseFormat();
  const formatRupees = useRupeeFormat();
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  const settle = useSettleCredit({ notifyOnError: false });
  const onConflict = useSettleConflict(form, credit, onClose);
  const fallbackBranch = defaultBranchId(openBranches, preferences.branchFilter) ?? '';
  const way = credit.direction;
  return useDrawerSave<SettleFormValues, CreditSettleResult>({
    form,
    fieldOrder: ['branchId', 'paidOn', 'splits'],
    serverFields: SERVER_FIELDS,
    toastId: 'settle-credit-save-failed',
    check: (values) => {
      const problem = settleProblem(values, owed);
      if (!problem) return null;
      return {
        fields: ['splits'],
        message:
          problem === 'amount'
            ? t(K.enterAmount)
            : t(K.moreThanOwed, { amount: formatPaise(owed) }),
      };
    },
    onConflict,
    // One section, always open.
    onField: () => undefined,
    write: () =>
      settle.mutateAsync({
        credit,
        settlement: settlementOf({
          values: form.getValues(),
          direction: way,
          fallbackBranch,
        }),
      }),
    onDone: (result) => {
      notify.success(
        t(K.done[way], {
          amount: formatRupees(result.amount),
          name: credit.partyName,
          entry: entryOf(result, way, t),
        }),
      );
      onClose();
    },
  });
}

/**
 * The drawer's one section: Branch (two or more open branches) and Date (today by default,
 * never ahead — its day must be open at that branch), then the Mode · Amount rows.
 */
function SettleFields({
  form,
  credit,
  branches,
  today,
  owed,
}: {
  form: UseFormReturn<SettleFormValues>;
  credit: CreditRow;
  branches: readonly BranchOption[];
  today: string;
  /** Paise. */
  owed: number;
}) {
  const { t } = useTranslation(SETTLE_CREDIT_NS);
  const formatPaise = usePaiseFormat();
  const idPrefix = `settle-credit-${useId().replace(/:/g, '')}`;
  const field = useDrawerFieldIds(form, idPrefix);
  const date = field('paidOn');
  const splits = field('splits');
  const rows = useWatch({ control: form.control, name: 'splits' });
  const total = splitsTotal(rows);
  const way = credit.direction;
  const rowsLabel = t(K.rows[way]);
  return (
    <DrawerFieldGrid title={t(K.section[way])}>
      {branches.length > 1 ? (
        <DrawerField span="half" stretch={false} label={t(K.branch)}>
          <Controller
            control={form.control}
            name="branchId"
            render={({ field: control }) => (
              <DrawerChips
                label={t(K.branch)}
                options={branches.map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                  tone: branch.tone,
                }))}
                value={control.value}
                onChange={(id) => {
                  if (id) control.onChange(id);
                }}
                testId={`${SETTLE_CREDIT_TEST_ID}-branch`}
              />
            )}
          />
        </DrawerField>
      ) : null}
      <DrawerField span="half" label={t(K.date)} htmlFor={date.id} error={date.error}>
        <Controller
          control={form.control}
          name="paidOn"
          render={({ field: control }) => (
            <DatePicker
              id={date.id}
              label={t(K.date)}
              value={control.value}
              onChange={(day) => {
                if (day) control.onChange(day);
              }}
              today={today}
              max={today}
              size="md"
              testId={`${SETTLE_CREDIT_TEST_ID}-date`}
            />
          )}
        />
      </DrawerField>
      <DrawerField label={rowsLabel} required error={splits.error}>
        <SplitRowsField
          control={form.control}
          label={rowsLabel}
          rows={rows}
          limit={owed}
          addLabel={t(K.add)}
          total={t(K.total, { total: formatPaise(total), owed: formatPaise(owed) })}
          testId={`${SETTLE_CREDIT_TEST_ID}-splits`}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** One opening of the drawer: its fields, its checks, its write. */
function SettleSession({
  credit,
  reason,
  open,
  start,
  onClose,
}: {
  credit: CreditRow;
  reason: string;
  open: boolean;
  start: SettleFormValues;
  onClose: () => void;
}) {
  const { t } = useTranslation(SETTLE_CREDIT_NS);
  const formatPaise = usePaiseFormat();
  const { openBranches } = useBranches();
  const way = credit.direction;
  const owed = owedInPaise(credit);
  const form = useForm<SettleFormValues>({ defaultValues: start });
  const rows = useWatch({ control: form.control, name: 'splits' });
  const { isDirty } = useFormState({ control: form.control });
  const { saveState, save } = useSettleSave({ form, credit, owed, onClose });
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title[way])}
      tag={displayId.pendingCredit(credit.seq)}
      sub={t(K.sub[way], isolateValues({ name: credit.partyName, reason }))}
      content={CONTENT_PROFILE}
      stacked
      saveLabel={t(K.save[way], { amount: formatPaise(splitsTotal(rows)) })}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={SETTLE_CREDIT_TEST_ID}
    >
      <SettleFields
        form={form}
        credit={credit}
        branches={openBranches}
        today={start.paidOn}
        owed={owed}
      />
    </RecordDrawer>
  );
}

/**
 * Give back / Got it back (KICKOFF §6.9; `payments.md:170–180, 254–266`; H:4035–4039) on
 * clinozy-be (`POST /app/pending-credits/:id/settle`, `method: money`) — a stacked drawer with
 * no URL, 840px for its item rows: "Give back" / "Got it back" with the credit's "CR-2", "To
 * Tanvi Shah · Charged twice for corn removal · adds an Out entry to Payments", and one section
 * — "How it goes back" / "How it came in" — of Branch (with two or more open branches), Date
 * (today; an earlier day must still be open there) and the Mode · Amount rows ("Paid back by" /
 * "Received as"), opening on everything left (`left_amount`) in UPI. Save checks an amount,
 * then at most what is owed ("More than the ₹500 owed"), and settles the credit: "₹500 given
 * back to Tanvi Shah · PAY-6 · CN-003". A part leaves the rest open ("₹X adjusted"); a give-back
 * on a credit for an invoice is a refund with its credit note (at most what that invoice has
 * paid, `409 more_than_paid`). A closed day (`409 day_closed`) outlines the Date. Payments ›
 * Pending opens it, for those who may record money (`payment:create`).
 */
export function SettleCreditDrawer({
  credit,
  reasonLabel,
  onClose,
}: SettleCreditDrawerProps) {
  const open = credit !== null;
  const { session } = useDrawerSession(open);
  const { openBranches, isPending } = useBranches();
  const { preferences } = usePreferences();
  // The credit stays on screen while the drawer slides out.
  const [shown, setShown] = useState(credit);
  if (credit !== null && credit !== shown) setShown(credit);
  const target = credit ?? shown;
  if (!target || isPending) return null;
  const start = settleStart({
    owed: owedInPaise(target),
    branchId: defaultBranchId(openBranches, preferences.branchFilter),
    today: appToday(),
  });
  return (
    <SettleSession
      key={session}
      credit={target}
      reason={reasonLabel ?? target.reason}
      open={open}
      start={start}
      onClose={onClose}
    />
  );
}
