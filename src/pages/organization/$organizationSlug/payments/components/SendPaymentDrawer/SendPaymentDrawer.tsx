import type { TFunction } from 'i18next';
import { type ReactNode, useId, useState } from 'react';
import { useForm, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { ledgerDayOf } from '@/shared/api/clinic/day-close-api.ts';
import { attachPaymentFile } from '@/shared/api/clinic/payments-api.ts';
import {
  type LedgerRow,
  type OpenSupplierBill,
  supplierBillKey,
} from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { defaultBranchId } from '@/shared/clinic/clinic-branch.ts';
import {
  EXPENSE_CATEGORY_TONES,
  PAYMENT_MODE_TONES,
  SECTION_TONES,
} from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerStepBody,
  type PickedFile,
} from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import { PaymentDeleteConfirm } from '@/shared/components/PaymentDeleteConfirm/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import {
  type DrawerBadge,
  RecordDrawer,
} from '@/shared/components/RecordDrawer/index.ts';
import { RECORD_DRAWER_KEYS } from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useBranches } from '@/shared/hooks/useBranches/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { resetFormInPlace } from '@/shared/hooks/useEditingRecord/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import {
  useOpenSupplierBills,
  usePayExpense,
  useUpdatePayment,
} from '@/shared/hooks/usePayments/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useUploadQueue } from '@/shared/hooks/useUploadQueue/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';
import { useDayLabel } from '../../shared/hooks/useDayLabel/index.ts';
import {
  amountText,
  billOf,
  emptySendForm,
  SEND_QUICK_FILLS,
  sendAmount,
  sendFormOf,
  type SendFormValues,
  sendInputOf,
  sendMissing,
  sendPatchOf,
  withBill,
} from './send-form.ts';
import { useBillLabel } from './send-wording.ts';
import { SendBillFields, SendExpenseFields, SendPaymentFields } from './SendFields.tsx';

const K = PAYMENTS_KEYS.send;

/** The drawer's root test id — the pay route's manifest names it. */
export const SEND_DRAWER_TEST_ID = 'pay-drawer';

/** Nine fields, the eight category chips and the upload among them: the everyday 680px. */
const CONTENT_PROFILE = { fieldCount: 9, hasHeavyField: true } as const;

/** The drawer's steps, in order; "bill" only for a new payment while bills are open. */
type SendStepId = 'bill' | 'expense' | 'payment';

/** What every use of the drawer passes. */
interface SendDrawerBaseProps {
  open: boolean;
  /** Every exit, once the dirty guard has let it through — and a save. */
  onClose: () => void;
}

/** Send payment over the ledger (`/payments/pay`, `S:86`). */
interface SendCreateDrawerProps extends SendDrawerBaseProps {
  mode: 'create';
  /** `?bill=md:<id>|is:<id>` — Medical's and Clinic stock's "Pay ₹X". */
  bill?: string;
}

/** Edit payment out (`/payments/$paymentId/edit` for an expense or a bill, `S:87`). */
interface SendEditDrawerProps extends SendDrawerBaseProps {
  mode: 'edit';
  entry: LedgerRow;
  /** No Edit: the drawer only shows the entry. */
  readOnly?: boolean;
}

/** Props of {@link SendPaymentDrawer}. */
export type SendPaymentDrawerProps = SendCreateDrawerProps | SendEditDrawerProps;

/** The form's values as they stand, every key present. */
function useFormValues(form: UseFormReturn<SendFormValues>): SendFormValues {
  const watched = useWatch({ control: form.control });
  return { ...form.getValues(), ...watched } as SendFormValues;
}

/** Who may save here: Create for a new payment, Edit (and Delete) for an entry. */
function useDrawerAccess(props: SendPaymentDrawerProps) {
  const access = useClinicAccess();
  const editing = props.mode === 'edit';
  const readOnly =
    (props.mode === 'edit' && props.readOnly === true) ||
    (access.isResolved && !access.can('payments', editing ? 'edit' : 'create'));
  return {
    readOnly,
    canDelete: editing && !readOnly && access.can('payments', 'delete'),
  };
}

/** The Quick fill chips of a new payment: each presets category, payee, amount and mode. */
function quickFillItems(
  form: UseFormReturn<SendFormValues>,
  t: TFunction,
  tClinic: TFunction,
): QuickFillItem[] {
  return SEND_QUICK_FILLS.map((fill) => {
    const label =
      fill.id === 'consumables'
        ? tClinic(CLINIC_KEYS.expenseCategories.consumables)
        : t(K.presets[fill.id]);
    return {
      id: fill.id,
      label,
      tone: fill.tone,
      onSelect: () =>
        resetFormInPlace(
          form,
          {
            ...form.getValues(),
            category: fill.values.category,
            payeeName: fill.payee ?? label,
            amount: amountText(fill.values.amount),
            mode: fill.values.mode,
          },
          { keepDefaultValues: true },
        ),
    };
  });
}

/** The step cards: each step's heads (peek, summary, what is missing) and its body. */
function useSteps({
  values,
  bills,
  bodies,
}: {
  values: SendFormValues;
  bills: readonly OpenSupplierBill[] | null;
  bodies: Record<SendStepId, ReactNode>;
}): DrawerStep[] {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatPaise = usePaiseFormat();
  const billLabel = useBillLabel();
  const missing = sendMissing(values);
  const amount = sendAmount(values);
  const picked = values.bill
    ? bills?.find(
        (bill) => supplierBillKey(bill) === supplierBillKey(values.bill ?? bill),
      )
    : undefined;
  const billSummary = picked ? billLabel(picked) : t(K.otherSpend);
  const notFilled = t(RECORD_DRAWER_KEYS.step.notFilled, { ns: CLINIC_NS });
  const dayLabel = useDayLabel();
  const steps: DrawerStep[] = [];
  if (bills) {
    steps.push({
      id: 'bill',
      title: t(K.steps.bill),
      summary: billSummary,
      peek: [{ kind: 'value', label: t(K.bill), value: billSummary }],
      content: bodies.bill,
    });
  }
  steps.push(
    {
      id: 'expense',
      title: t(K.steps.expense),
      missing: missing.includes('payeeName') ? [t(K.paidTo)] : [],
      peek: [
        {
          kind: 'value',
          label: t(K.category),
          value: tClinic(CLINIC_KEYS.expenseCategories[values.category]),
          tone: EXPENSE_CATEGORY_TONES[values.category],
        },
        {
          kind: 'value',
          label: t(K.paidTo),
          value: values.payeeName.trim() || undefined,
        },
        { kind: 'value', label: t(K.note), value: values.note.trim() || undefined },
      ],
      summary: values.payeeName.trim() || notFilled,
      content: bodies.expense,
    },
    {
      id: 'payment',
      title: t(K.steps.payment),
      missing: missing.includes('amount') ? [t(K.amount)] : [],
      peek: [
        {
          kind: 'value',
          label: t(K.amount),
          value: amount > 0 ? formatPaise(amount) : undefined,
        },
        { kind: 'value', label: t(K.date), value: dayLabel(values.paidOn) },
        {
          kind: 'value',
          label: t(K.mode),
          value: tClinic(CLINIC_KEYS.paymentModes[values.mode]),
          tone: PAYMENT_MODE_TONES[values.mode],
        },
      ],
      summary: amount > 0 ? formatPaise(amount) : notFilled,
      content: bodies.payment,
    },
  );
  return steps;
}

/** The saved toast: an edit's, a bill's payment's, or a new expense's. */
function savedMessage(
  row: LedgerRow,
  editing: boolean,
  t: TFunction,
  formatPaise: (paise: number) => string,
): string {
  const ref = displayId.payment(row.seq);
  if (editing) return t(K.saved, { ref });
  if (!row.bill) return t(K.added, { ref });
  const bill = t(row.bill.kind === 'medical_po' ? K.billRef.medical : K.billRef.stock, {
    seq: row.bill.seq,
  });
  return t(K.paidBill, { amount: formatPaise(row.amount), bill });
}

/**
 * The save: Paid to and Amount first, then the write, its toast, the photos
 * filed through the upload tray, and the close — or, for "Add & another", a
 * fresh drawer.
 */
function useSendSave({
  form,
  entry,
  files,
  onStep,
  onDayClosed,
  onClose,
  onAnother,
}: {
  form: UseFormReturn<SendFormValues>;
  entry: LedgerRow | null;
  files: readonly PickedFile[];
  onStep: (stepId: SendStepId) => void;
  onDayClosed: () => void;
  onClose: () => void;
  onAnother: () => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatPaise = usePaiseFormat();
  const { openBranches } = useBranches();
  const { preferences } = usePreferences();
  const { enqueue } = useUploadQueue();
  const pay = usePayExpense({ notifyOnError: false });
  const update = useUpdatePayment({ notifyOnError: false });
  const fallbackBranch =
    defaultBranchId(openBranches, preferences.branchFilter) ?? openBranches[0]?.id ?? '';

  const fileAttachments = (paymentId: string) => {
    if (files.length === 0) return;
    enqueue(
      files.map((picked) => picked.file),
      {
        onUploaded: (key) => attachPaymentFile({ paymentId, key }).then(() => undefined),
      },
    );
  };

  return useDrawerSave<SendFormValues, LedgerRow>({
    form,
    fieldOrder: ['bill', 'category', 'payeeName', 'note', 'amount', 'paidOn', 'mode'],
    toastId: 'send-payment-save-failed',
    check: (current) => {
      const missing = sendMissing(current);
      return missing.length > 0 ? { fields: missing, message: t(K.missing) } : null;
    },
    onConflict: () => {
      onDayClosed();
      notify.error(t(PAYMENTS_KEYS.dialog.dayClosed));
    },
    onField: (name) => onStep(name === 'payeeName' ? 'expense' : 'payment'),
    write: () =>
      entry
        ? update.mutateAsync({ id: entry.id, patch: sendPatchOf(form.getValues()) })
        : pay.mutateAsync(sendInputOf(form.getValues(), fallbackBranch)),
    onDone: (row, another) => {
      fileAttachments(row.id);
      notify.success(savedMessage(row, entry !== null, t, formatPaise));
      if (another) onAnother();
      else onClose();
    },
  });
}

/** The header's badges and the footer's summary, as the form stands. */
function useChrome(values: SendFormValues, bills: readonly OpenSupplierBill[] | null) {
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const formatPaise = usePaiseFormat();
  const billLabel = useBillLabel();
  const amount = sendAmount(values);
  const category = tClinic(CLINIC_KEYS.expenseCategories[values.category]);
  const picked = values.bill
    ? (bills ?? []).find(
        (bill) => supplierBillKey(bill) === supplierBillKey(values.bill ?? bill),
      )
    : undefined;
  const badges: DrawerBadge[] = [
    { id: 'category', label: category, tone: EXPENSE_CATEGORY_TONES[values.category] },
  ];
  if (amount > 0)
    badges.push({ id: 'amount', label: `− ${formatPaise(amount)}`, tone: 'blush' });
  badges.push({ id: 'mode', label: tClinic(CLINIC_KEYS.paymentModes[values.mode]) });
  const summary = [
    picked ? billLabel(picked) : category,
    values.payeeName.trim(),
    amount > 0 ? formatPaise(amount) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return { badges, summary };
}

/** The words that change with an edit: the title, the tag and the save label. */
function drawerLabels(entry: LedgerRow | null, t: TFunction) {
  if (!entry) return { title: t(K.title), tag: undefined, save: t(K.save) };
  return {
    title: t(K.titleEdit),
    tag: displayId.payment(entry.seq),
    save: t(K.saveEdit),
  };
}

/** The three steps' bodies, each a fieldset that turns view only with the drawer. */
function stepBodies({
  form,
  values,
  bills,
  idPrefix,
  readOnly,
  today,
  editing,
  files,
  onFiles,
}: {
  form: UseFormReturn<SendFormValues>;
  values: SendFormValues;
  bills: readonly OpenSupplierBill[] | null;
  idPrefix: string;
  readOnly: boolean;
  today: string;
  editing: boolean;
  files: readonly PickedFile[];
  onFiles: (files: PickedFile[]) => void;
}): Record<SendStepId, ReactNode> {
  const fieldsProps = { form, values, idPrefix, testId: SEND_DRAWER_TEST_ID, readOnly };
  return {
    bill: (
      <DrawerStepBody readOnly={readOnly}>
        <SendBillFields
          bills={bills ?? []}
          picked={values.bill ? supplierBillKey(values.bill) : null}
          onPick={(bill) =>
            resetFormInPlace(form, withBill(form.getValues(), bill), {
              keepDefaultValues: true,
            })
          }
          readOnly={readOnly}
          testId={SEND_DRAWER_TEST_ID}
          idPrefix={idPrefix}
        />
      </DrawerStepBody>
    ),
    expense: (
      <DrawerStepBody readOnly={readOnly}>
        <SendExpenseFields {...fieldsProps} />
      </DrawerStepBody>
    ),
    payment: (
      <DrawerStepBody readOnly={readOnly}>
        <SendPaymentFields
          {...fieldsProps}
          today={today}
          dateLocked={editing}
          files={files}
          onFiles={onFiles}
        />
      </DrawerStepBody>
    ),
  };
}

/** One opening of the drawer: the form, its steps, its save and its files. */
function SendSession({
  props,
  start,
  bills,
  onAnother,
}: {
  props: SendPaymentDrawerProps;
  start: SendFormValues;
  /** The open bills — step 1 shows while there are any, for a new payment. */
  bills: readonly OpenSupplierBill[] | null;
  onAnother: () => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const idPrefix = `send-${useId().replace(/:/g, '')}`;
  const [today] = useState(() => clinicToday());
  const entry = props.mode === 'edit' ? props.entry : null;
  const { readOnly: noWrite, canDelete } = useDrawerAccess(props);
  const [dayClosed, setDayClosed] = useState(false);
  const readOnly = noWrite || dayClosed;

  const form = useForm<SendFormValues>({ defaultValues: start });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [openStep, setOpenStep] = useState<string>(bills ? 'bill' : 'expense');
  const [deleting, setDeleting] = useState(false);
  const { saveState, save } = useSendSave({
    form,
    entry,
    files,
    onStep: setOpenStep,
    onDayClosed: () => setDayClosed(true),
    onClose: props.onClose,
    onAnother,
  });
  const chrome = useChrome(values, bills);

  const steps = useSteps({
    values,
    bills,
    bodies: stepBodies({
      form,
      values,
      bills,
      idPrefix,
      readOnly,
      today,
      editing: entry !== null,
      files,
      onFiles: setFiles,
    }),
  });
  const labels = drawerLabels(entry, t);

  return (
    <>
      <RecordDrawer
        open={props.open}
        onClose={props.onClose}
        title={labels.title}
        tag={labels.tag}
        sub={t(K.sub)}
        badges={chrome.badges}
        quickFill={entry ? undefined : quickFillItems(form, t, tClinic)}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.payments}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        onMissing={() => notify.warning(t(K.missing))}
        summary={chrome.summary}
        readOnly={readOnly}
        saveLabel={labels.save}
        onSave={() => void save()}
        saveState={saveState}
        saveAndAddLabel={t(K.another)}
        onSaveAndAdd={entry ? undefined : () => void save(true)}
        onDelete={canDelete ? () => setDeleting(true) : undefined}
        dirty={isDirty || files.length > 0}
        testId={SEND_DRAWER_TEST_ID}
      />
      {entry ? (
        <PaymentDeleteConfirm
          target={deleting ? { entry } : null}
          onClose={() => setDeleting(false)}
          onDeleted={props.onClose}
        />
      ) : null}
    </>
  );
}

/**
 * Send payment (KICKOFF §6.9; `payments.md:112–130, 212–224`; H:5126–5134)
 * on the shared record drawer, 680px, in steps whose sequence varies by input:
 * "Pay against a bill" — for a new payment while supplier bills are open: the
 * bill picker, oldest first, and "Pending longest" — then "Expense" (Category,
 * Paid to, Note) and "Payment" (Amount, Date, Mode, the bill photo). Quick fill
 * presets a new one ("⚡ Consumables", "⚡ Tea & snacks", "⚡ Courier");
 * `?bill=` arrives with that bill picked. Save opens the step missing Paid to
 * or Amount ("Add who was paid and the amount"). "₹2,980 paid against Medical
 * PO #431" (the PO paid in full is Paid) or "Expense PAY-5601 added"; "Add &
 * another" saves and starts again. An edit — an open day's expense — "PAY-311
 * saved · change logged", with Delete; a day closed meanwhile turns it view
 * only. The photos file after the save, through the upload tray.
 */
export function SendPaymentDrawer(props: SendPaymentDrawerProps) {
  const { session, restart, fresh } = useDrawerSession(props.open);
  const { openBranches, isPending } = useBranches();
  const { preferences } = usePreferences();
  const [today] = useState(() => clinicToday());
  const creating = props.mode === 'create';
  const open = useOpenSupplierBills(creating);
  if (isPending || (creating && !open.isFetched)) return null;

  const bills = creating && (open.data?.length ?? 0) > 0 ? (open.data ?? null) : null;
  let start = emptySendForm(
    defaultBranchId(openBranches, preferences.branchFilter),
    today,
  );
  if (props.mode === 'edit') start = sendFormOf(props.entry, ledgerDayOf(props.entry));
  else if (!fresh && bills) start = withBill(start, billOf(bills, props.bill));
  return (
    <SendSession
      key={session}
      props={props}
      start={start}
      bills={bills}
      onAnother={restart}
    />
  );
}
