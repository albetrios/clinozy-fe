import { useState } from 'react';
import { useForm, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { CreditSettleResult } from '@/shared/api/clinic/credits-contracts.ts';
import { DrawerField, DrawerFieldGrid } from '@/shared/components/DrawerField/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import {
  paidSplits,
  SplitRowsField,
  splitsTotal,
} from '@/shared/forms/SplitRowsField/index.ts';
import { useSettleCredit } from '@/shared/hooks/useCredits/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  SETTLE_CREDIT_KEYS,
  SETTLE_CREDIT_NS,
  SETTLE_CREDIT_TEST_ID,
} from './settle-credit.constants.ts';
import {
  owedOn,
  type SettleCreditTarget,
  type SettleFormValues,
  settleProblem,
  settleStart,
} from './settle-credit.ts';

const K = SETTLE_CREDIT_KEYS;

/** One field, its item rows forcing the drawer to 840px (`payments.md:261`, Q-G2). */
const CONTENT_PROFILE = { fieldCount: 1, hasItems: true } as const;

/** Props of {@link SettleCreditDrawer}. */
export interface SettleCreditDrawerProps {
  /** The open credit to settle; null keeps the drawer shut (component state, no URL). */
  credit: SettleCreditTarget | null;
  /** The reason as the screen words it — a chip's own label; the stored text by default. */
  reasonLabel?: string;
  /** Back, the floating ×, the backdrop — and a save. */
  onClose: () => void;
}

/** One opening of the drawer: its rows, its checks, its write. */
function SettleSession({
  credit,
  reason,
  open,
  onClose,
}: {
  credit: SettleCreditTarget;
  reason: string;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(SETTLE_CREDIT_NS);
  const formatPaise = usePaiseFormat();
  const way = credit.direction;
  const owed = owedOn(credit);
  const form = useForm<SettleFormValues>({ defaultValues: settleStart(owed) });
  const rows = useWatch({ control: form.control, name: 'splits' });
  const { isDirty } = useFormState({ control: form.control });
  const total = splitsTotal(rows);
  const settle = useSettleCredit({ notifyOnError: false });

  const { saveState, save } = useDrawerSave<SettleFormValues, CreditSettleResult>({
    form,
    fieldOrder: ['splits'],
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
    // One field, always open.
    onField: () => undefined,
    write: () =>
      settle.mutateAsync({
        id: credit.id,
        settlement: {
          action: way === 'give' ? 'give_back' : 'got_back',
          splits: paidSplits(form.getValues().splits),
        },
      }),
    onDone: (result) => {
      notify.success(
        t(K.done[way], { amount: formatPaise(result.amount), name: credit.partyName }),
      );
      onClose();
    },
  });

  const rowsLabel = t(K.rows[way]);
  return (
    <RecordDrawer
      open={open}
      onClose={onClose}
      title={t(K.title[way])}
      tag={displayId.pendingCredit(credit.seq)}
      sub={t(K.sub[way], { name: credit.partyName, reason })}
      content={CONTENT_PROFILE}
      stacked
      saveLabel={t(K.save[way], { amount: formatPaise(total) })}
      onSave={() => void save()}
      saveState={saveState}
      dirty={isDirty}
      testId={SETTLE_CREDIT_TEST_ID}
    >
      <DrawerFieldGrid title={t(K.section[way])}>
        <DrawerField label={rowsLabel} required>
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
    </RecordDrawer>
  );
}

/**
 * Give back / Got it back (KICKOFF §6.9; `payments.md:170–180, 254–266`;
 * H:4035–4039) — a stacked drawer with no URL, 840px for its item rows: "Give
 * back" / "Got it back" with the credit's "CR-2", "To Tanvi Shah · Charged
 * twice for corn removal · adds an Out entry to Payments", and one section —
 * "How it goes back" / "How it came in" — of Mode · Amount rows ("Paid back
 * by" / "Received as") that open on everything owed, in UPI. Save checks an
 * amount, then at most what is owed ("More than the ₹500 owed"), and settles
 * the credit (`settleCredit`, `S:1713`): "₹500 given back to Tanvi Shah · Out
 * entry added". A part leaves the rest open ("₹X adjusted"); a patient's
 * give-back is a refund with its credit note. Payments › Pending and the
 * patient file's credit card both open it.
 */
export function SettleCreditDrawer({
  credit,
  reasonLabel,
  onClose,
}: SettleCreditDrawerProps) {
  const open = credit !== null;
  const { session } = useDrawerSession(open);
  // The credit stays on screen while the drawer slides out.
  const [shown, setShown] = useState(credit);
  if (credit !== null && credit !== shown) setShown(credit);
  const target = credit ?? shown;
  if (!target) return null;
  return (
    <SettleSession
      key={session}
      credit={target}
      reason={reasonLabel ?? target.reason}
      open={open}
      onClose={onClose}
    />
  );
}
