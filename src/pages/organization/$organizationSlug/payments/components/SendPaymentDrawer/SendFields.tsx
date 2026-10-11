import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EXPENSE_CATEGORY_VALUES } from '@/shared/api/app/app-schema.ts';
import {
  EXPENSE_MODE_VALUES,
  type OpenSupplierBill,
  supplierBillKey,
} from '@/shared/api/app/payments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { EXPENSE_CATEGORY_TONES, PAYMENT_MODE_TONES } from '@/shared/app/app-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerFilesField,
  DrawerInput,
  DrawerNumberInput,
  DrawerQuickChips,
  type PickedFile,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { RECORD_DRAWER_KEYS } from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../payments.constants.ts';
import {
  ageTone,
  AMOUNT_QUICK,
  amountText,
  PAID_TO_QUICK,
  type SendFormValues,
} from './send-form.ts';
import { useBillAge, useBillLabel } from './send-wording.ts';

const K = PAYMENTS_KEYS.send;

/** The form's own limits — the contract's payee (120) and note (280). */
const LIMITS = { payee: 120, note: 280, money: 9 } as const;

/** The key "Other spend" holds in the bill picker. */
const OTHER_SPEND = 'other';

/** Everything the step bodies read. */
export interface SendFieldsProps {
  form: UseFormReturn<SendFormValues>;
  values: SendFormValues;
  idPrefix: string;
  testId: string;
  readOnly: boolean;
}

/** The bill picker's rows (`payments.md:116`): "Other spend", then the bills oldest first. */
function useBillOptions(bills: readonly OpenSupplierBill[]): PickerOption[] {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const age = useBillAge();
  const label = useBillLabel();
  return [
    {
      key: OTHER_SPEND,
      label: t(K.otherSpend),
      sub: t(K.otherSpendSub),
      group: t(K.groups.other),
      tone: 'lav',
    },
    ...bills.map((bill) => ({
      key: supplierBillKey(bill),
      label: label(bill),
      sub: [bill.billNo ? t(K.billNo, { bill: bill.billNo }) : '', age(bill.daysPending)]
        .filter(Boolean)
        .join(' · '),
      meta: formatRupees(bill.due),
      group: t(bill.kind === 'medical_po' ? K.groups.medical : K.groups.stock),
      tone: bill.kind === 'medical_po' ? ('blush' as const) : ('mint' as const),
    })),
  ];
}

/** The open bills' read failed: the step says so, with Retry in place. */
function BillsFailed({ onRetry, testId }: { onRetry: () => void; testId: string }) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  return (
    <DrawerFieldGrid>
      <DrawerField label={t(K.bill)}>
        <span className="flex flex-wrap items-center gap-2" data-testid={testId}>
          <span className="text-caption text-destructive">{t(K.billsFailed)}</span>
          <button
            type="button"
            onClick={onRetry}
            data-testid={`${testId}-retry`}
            className="text-caption text-foreground font-medium underline underline-offset-2"
          >
            {tApp(APP_KEYS.lists.retry)}
          </button>
        </span>
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/**
 * Step 1, "Pay against a bill" (new, while bills are open; H:5129–5130): the
 * Supplier bill picker — "Other spend", then each open bill — and, while
 * nothing is picked, "Pending longest": the three oldest as chips in their
 * age's tone. A failed read says so, with Retry.
 */
export function SendBillFields({
  bills,
  picked,
  onPick,
  onRetry,
  readOnly,
  testId,
  idPrefix,
}: {
  bills: readonly OpenSupplierBill[];
  picked: string | null;
  onPick: (bill: OpenSupplierBill | null) => void;
  /** The open bills' read failed: read them again. */
  onRetry?: () => void;
  readOnly: boolean;
  testId: string;
  idPrefix: string;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const formatRupees = useRupeeFormat();
  const age = useBillAge();
  const options = useBillOptions(bills);
  const id = `${idPrefix}-bill`;
  if (onRetry) return <BillsFailed onRetry={onRetry} testId={`${testId}-bill`} />;
  return (
    <DrawerFieldGrid>
      <DrawerField
        label={t(K.bill)}
        htmlFor={id}
        hint={t(K.billHint, { count: bills.length })}
      >
        <Picker
          id={id}
          label={t(K.bill)}
          placeholder={t(K.billPlaceholder)}
          searchPlaceholder={t(K.billPlaceholder)}
          searchable
          options={options}
          value={picked ?? OTHER_SPEND}
          onChange={(key) =>
            onPick(bills.find((bill) => supplierBillKey(bill) === key) ?? null)
          }
          disabled={readOnly}
          size="md"
          minWidth={320}
          testId={`${testId}-bill`}
        />
      </DrawerField>
      {picked === null && bills.length > 0 ? (
        <DrawerField label={t(K.oldest)}>
          <DrawerChips
            label={t(K.oldest)}
            options={bills.slice(0, 3).map((bill) => ({
              value: supplierBillKey(bill),
              label: t(K.oldestChip, {
                seq: bill.seq,
                supplier: bill.supplierName.split(' ')[0] ?? bill.supplierName,
                due: formatRupees(bill.due),
                age: age(bill.daysPending),
              }),
              tone: ageTone(bill.daysPending),
            }))}
            value={null}
            onChange={(key) =>
              onPick(bills.find((bill) => supplierBillKey(bill) === key) ?? null)
            }
            disabled={readOnly}
            testId={`${testId}-oldest`}
          />
        </DrawerField>
      ) : null}
    </DrawerFieldGrid>
  );
}

/** Clinic spend's Category chips (Consumables first picked) — a supplier bill has none. */
function CategoryField({
  form,
  testId,
  readOnly,
}: Pick<SendFieldsProps, 'form' | 'testId' | 'readOnly'>) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  return (
    <DrawerField label={t(K.category)}>
      <Controller
        control={form.control}
        name="category"
        render={({ field: control }) => (
          <DrawerChips
            label={t(K.category)}
            options={EXPENSE_CATEGORY_VALUES.map((category) => ({
              value: category,
              label: tApp(APP_KEYS.expenseCategories[category]),
              tone: EXPENSE_CATEGORY_TONES[category],
            }))}
            value={control.value}
            onChange={(next) => {
              if (next) control.onChange(next);
            }}
            disabled={readOnly}
            testId={`${testId}-category`}
          />
        )}
      />
    </DrawerField>
  );
}

/**
 * Step 2, "Expense" (H:5131): Category chips (Consumables first picked) — or, paying a supplier
 * bill, the bill itself ("Stock PO #15 · Cranix Pharma"), which takes no category · Paid to —
 * required, with "Medline Surgicals" · "Meta ads" · "Electricity" — and Note ("What was bought").
 */
export function SendExpenseFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
}: SendFieldsProps) {
  const { t } = useTranslation(PAYMENTS_NS);
  const billLabel = useBillLabel();
  const field = useDrawerFieldIds(form, idPrefix);
  const payee = field('payeeName');
  const note = field('note');
  const quick = [...PAID_TO_QUICK, t(K.electricity)];
  return (
    <DrawerFieldGrid>
      {values.bill ? (
        <DrawerField label={t(K.bill)}>
          <span className="text-body font-medium" data-testid={`${testId}-bill-label`}>
            {billLabel(values.bill)}
          </span>
        </DrawerField>
      ) : (
        <CategoryField form={form} testId={testId} readOnly={readOnly} />
      )}
      <DrawerField
        span="half"
        label={t(K.paidTo)}
        htmlFor={payee.id}
        required
        error={payee.error}
      >
        <div className="flex flex-col gap-1.5">
          <DrawerInput
            {...payee.control}
            {...form.register('payeeName')}
            aria-required="true"
            maxLength={LIMITS.payee}
            placeholder={t(K.paidToPlaceholder)}
            autoComplete="off"
            readOnly={readOnly}
            data-testid={`${testId}-paid-to`}
          />
          <DrawerQuickChips
            label={t(K.paidTo)}
            options={quick.map((name) => ({ label: name, value: name }))}
            value={values.payeeName}
            onChange={(name) =>
              form.setValue('payeeName', name, {
                shouldDirty: true,
                shouldValidate: false,
              })
            }
            disabled={readOnly}
            testId={`${testId}-paid-to-quick`}
          />
        </div>
      </DrawerField>
      <DrawerField span="half" label={t(K.note)} htmlFor={note.id}>
        <DrawerInput
          {...note.control}
          {...form.register('note')}
          maxLength={LIMITS.note}
          placeholder={t(K.notePlaceholder)}
          autoComplete="off"
          readOnly={readOnly}
          data-testid={`${testId}-note`}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/**
 * Step 3, "Payment" (H:5131): Amount — required, with ₹500 · ₹1,000 · ₹2,000
 * · ₹5,000 — · Date (today by default, never ahead; fixed on an edit) · Mode
 * chips (Cash first picked) · "Bill / receipt": photos or a PDF, filed once
 * the payment is saved.
 */
export function SendPaymentFields({
  form,
  values,
  idPrefix,
  testId,
  readOnly,
  today,
  dateLocked,
  files,
  onFiles,
}: SendFieldsProps & {
  today: string;
  /** An edit keeps the entry on its day: its day close counted it. */
  dateLocked: boolean;
  files: readonly PickedFile[];
  onFiles: (files: PickedFile[]) => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const formatPaise = usePaiseFormat();
  const field = useDrawerFieldIds(form, idPrefix);
  const amount = field('amount');
  const date = field('paidOn');
  const filesId = `${idPrefix}-files`;
  return (
    <DrawerFieldGrid>
      <DrawerField
        span="half"
        label={t(K.amount)}
        htmlFor={amount.id}
        required
        error={amount.error}
      >
        <div className="flex flex-col gap-1.5">
          <Controller
            control={form.control}
            name="amount"
            render={({ field: control }) => (
              <DrawerNumberInput
                {...amount.control}
                aria-required="true"
                value={control.value}
                onValueChange={control.onChange}
                onBlur={control.onBlur}
                prefix={tApp(RECORD_DRAWER_KEYS.currency)}
                placeholder="0"
                maxLength={LIMITS.money}
                readOnly={readOnly}
                data-testid={`${testId}-amount`}
              />
            )}
          />
          <DrawerQuickChips
            label={t(K.amount)}
            options={AMOUNT_QUICK.map((paise) => ({
              label: formatPaise(paise),
              value: amountText(paise),
            }))}
            value={values.amount}
            onChange={(text) => form.setValue('amount', text, { shouldDirty: true })}
            disabled={readOnly}
            testId={`${testId}-amount-quick`}
          />
        </div>
      </DrawerField>
      <DrawerField span="half" label={t(K.date)} htmlFor={date.id}>
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
              disabled={readOnly || dateLocked}
              testId={`${testId}-date`}
            />
          )}
        />
      </DrawerField>
      <DrawerField label={t(K.mode)}>
        <Controller
          control={form.control}
          name="mode"
          render={({ field: control }) => (
            <DrawerChips
              label={t(K.mode)}
              options={EXPENSE_MODE_VALUES.map((mode) => ({
                value: mode,
                label: tApp(APP_KEYS.paymentModes[mode]),
                tone: PAYMENT_MODE_TONES[mode],
              }))}
              value={control.value}
              onChange={(next) => {
                if (next) control.onChange(next);
              }}
              disabled={readOnly}
              testId={`${testId}-mode`}
            />
          )}
        />
      </DrawerField>
      <DrawerField label={t(K.files)} htmlFor={filesId}>
        <DrawerFilesField
          id={filesId}
          files={files}
          onChange={onFiles}
          accept="image/*,application/pdf"
          takes={(file) =>
            file.type.startsWith('image/') || file.type === 'application/pdf'
          }
          title={t(K.filesDrop)}
          hint={t(K.filesHint)}
          removeLabel={(name) => t(K.filesRemove, { name })}
          disabled={readOnly}
          testId={`${testId}-files`}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}
