import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { INVOICE_REMARK_MAX } from '@/shared/api/clinic/invoices-contracts.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import { PAYMENT_MODE_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  type DrawerFieldProps,
  DrawerInfo,
  DrawerNumberInput,
  DrawerQuickChips,
  DrawerStepper,
  DrawerTextarea,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsNumberCell,
  ItemsPickerCell,
} from '@/shared/forms/ItemsField/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  INVOICE_DRAWER_TEST_IDS,
} from './invoice-drawer.constants.ts';
import type { InvoiceFigures } from './invoice-figures.ts';
import {
  blankPaidNow,
  type InvoiceFormValues,
  PAID_NOW_MODES,
  type PaidNowMode,
  type PaidNowRow,
  percentOf,
} from './invoice-form.ts';

const K = INVOICE_DRAWER_KEYS;

/** The three presets of "Quick fill" in the Payment step (`payments.md:144`). */
type PaymentPreset = 'full' | 'split' | 'nothing';

/** The most an overall discount takes as typed — seven digits of rupees. */
const OVERALL_DISCOUNT_MAX_LENGTH = 10;

/** Cash, UPI, Card — each on its tone's dot. */
function useModeOptions(): PickerOption[] {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  return PAID_NOW_MODES.map((mode) => ({
    key: mode,
    label: t(CLINIC_KEYS.paymentModes[mode]),
    tone: PAYMENT_MODE_TONES[mode],
  }));
}

/** The Mode · Amount rows (H:5063): `minmax(0,1fr) 150px` and the ×. */
function usePaidNowColumns(): ItemsColumn<InvoiceFormValues, 'paidNow'>[] {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const modes = useModeOptions();
  return [
    {
      id: 'mode',
      header: t(K.payment.mode),
      track: 'minmax(0,1fr)',
      cell: (row) => (
        <ItemsPickerCell
          {...row.bind('mode')}
          options={modes}
          placeholder={t(K.payment.mode)}
          searchable={false}
          minWidth={180}
        />
      ),
    },
    {
      id: 'amount',
      header: t(K.payment.amount),
      track: '150px',
      align: 'end',
      cell: (row) => <ItemsNumberCell {...row.bind('amount')} money />,
    },
  ];
}

/** The next row "+ Add another mode" adds: the first mode not in use, at what is left to pay. */
function nextPaidNowRow(rows: readonly PaidNowRow[], left: number): PaidNowRow | null {
  const used = new Set(rows.map((row) => row.mode));
  const mode = PAID_NOW_MODES.find((candidate) => !used.has(candidate));
  return mode ? { mode, amount: Math.max(0, left) } : null;
}

/** Props of {@link InvoicePaymentFields}. */
export interface InvoicePaymentFieldsProps {
  form: UseFormReturn<InvoiceFormValues>;
  values: InvoiceFormValues;
  figures: InvoiceFigures;
  /**
   * `sale` — a Medical sale (the overall discount a percent, Q-G7); `create` — a new invoice
   * (the overall discount in rupees, "Paid now" with the bill); `edit` — a saved invoice, whose
   * money is the ledger's: what it has received and what is due, no "Paid now".
   */
  mode: 'sale' | 'create' | 'edit';
  idPrefix: string;
  readOnly: boolean;
}

/** The overall discount: a sale's percent stepper, an invoice's rupees off the bill before tax. */
function OverallDiscountField({
  form,
  mode,
  idPrefix,
  readOnly,
}: Pick<InvoicePaymentFieldsProps, 'form' | 'mode' | 'idPrefix' | 'readOnly'> &
  Pick<DrawerFieldProps, 'span' | 'stretch'>) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const ids = useDrawerFieldIds(form, idPrefix);
  const sale = mode === 'sale';
  const field = ids(sale ? 'overallDiscountPct' : 'overallDiscount');
  return (
    <DrawerField
      span="half"
      stretch={false}
      label={t(K.fields.overallDiscount)}
      htmlFor={field.id}
      error={field.error}
    >
      {sale ? (
        <Controller
          control={form.control}
          name="overallDiscountPct"
          render={({ field: control }) => (
            // "−  0 %  +" (H:5063): a stored fraction reads as it is, a typed figure is whole.
            <DrawerStepper
              {...field.control}
              ref={control.ref}
              value={percentOf(control.value)}
              onValueChange={(next) => control.onChange(String(next))}
              onBlur={control.onBlur}
              suffix="%"
              max={100}
              disabled={readOnly}
              testId={INVOICE_DRAWER_TEST_IDS.overallDiscount}
            />
          )}
        />
      ) : (
        <Controller
          control={form.control}
          name="overallDiscount"
          render={({ field: control }) => (
            <DrawerNumberInput
              {...field.control}
              ref={control.ref}
              value={control.value}
              onValueChange={control.onChange}
              onBlur={control.onBlur}
              prefix={tDrawer(RECORD_DRAWER_KEYS.currency)}
              placeholder="0"
              maxLength={OVERALL_DISCOUNT_MAX_LENGTH}
              readOnly={readOnly}
              data-testid={INVOICE_DRAWER_TEST_IDS.overallDiscount}
            />
          )}
        />
      )}
    </DrawerField>
  );
}

/**
 * "Paid now"'s Quick fill (`payments.md:144`): "Full · ₹324 in UPI" · "Split cash + UPI" ·
 * "Nothing now", and the row "+ Add another mode" adds — from what the bill still needs before
 * this save (an invoice's is the server's preview).
 */
function usePaidNowPresets({
  form,
  values,
  figures,
}: Pick<InvoicePaymentFieldsProps, 'form' | 'values' | 'figures'>) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const left = Math.max(0, figures.dueBefore);
  const firstMode: PaidNowMode = values.paidNow[0]?.mode ?? 'upi';
  const setPaidNow = (rows: PaidNowRow[]) =>
    form.setValue('paidNow', rows, { shouldDirty: true });
  const presets: { label: string; value: PaymentPreset }[] = [
    {
      value: 'full',
      label: t(K.payment.full, {
        amount: formatPaise(left),
        mode: t(CLINIC_KEYS.paymentModes[firstMode]),
      }),
    },
    { value: 'split', label: t(K.payment.split) },
    { value: 'nothing', label: t(K.payment.nothing) },
  ];
  const apply = (preset: PaymentPreset) => {
    if (preset === 'full') setPaidNow([{ mode: firstMode, amount: left }]);
    else if (preset === 'split') {
      const cash = Math.round(left / 2);
      setPaidNow([
        { mode: 'cash', amount: cash },
        { mode: 'upi', amount: left - cash },
      ]);
    } else setPaidNow(blankPaidNow(firstMode));
  };
  return {
    presets,
    apply,
    firstMode,
    next: nextPaidNowRow(values.paidNow, left - figures.paidNow),
  };
}

/**
 * The Payment step (`payments.md:143–146`; H:5063): the overall discount — a sale's percent
 * (Q-G7), an invoice's rupees off the bill before tax — "Paid now" with its presets on a new
 * invoice or sale (a saved invoice shows what it has received and what is due: more money is
 * the ledger's Receive payment), and the Remark — "Shown on the printed invoice", the one note
 * that prints (§7.3).
 */
export function InvoicePaymentFields({
  form,
  values,
  figures,
  mode,
  idPrefix,
  readOnly,
}: InvoicePaymentFieldsProps) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const ids = useDrawerFieldIds(form, idPrefix);
  const columns = usePaidNowColumns();
  const paidNow = usePaidNowPresets({ form, values, figures });
  const nextRow = paidNow.next;
  const remark = ids('remark');
  const saved = mode === 'edit';

  return (
    <DrawerFieldGrid>
      <OverallDiscountField
        span="half"
        stretch={false}
        form={form}
        mode={mode}
        idPrefix={idPrefix}
        readOnly={readOnly}
      />
      {saved ? (
        <DrawerField span="half" label={t(K.fields.paid)}>
          <DrawerInfo testId={INVOICE_DRAWER_TEST_IDS.paidNow}>
            {t(K.payment.paidTotal, {
              paid: formatPaise(figures.paidBefore),
              due: formatPaise(figures.due),
            })}
          </DrawerInfo>
        </DrawerField>
      ) : null}
      {saved || readOnly ? null : (
        <DrawerField span="full" label={t(K.fields.quickFill)}>
          <DrawerQuickChips
            label={t(K.fields.quickFill)}
            options={paidNow.presets}
            value={null}
            onChange={paidNow.apply}
            testId={INVOICE_DRAWER_TEST_IDS.paymentQuickFill}
          />
        </DrawerField>
      )}
      {saved ? null : (
        <DrawerField span="full" label={t(K.fields.paidNow)}>
          <ItemsField
            control={form.control}
            name="paidNow"
            label={t(K.fields.paidNow)}
            columns={columns}
            compact
            minRows={1}
            clearRow={() => ({ mode: paidNow.firstMode, amount: 0 })}
            newRow={nextRow ? () => nextRow : undefined}
            addLabel={t(K.payment.addMode)}
            total={t(K.payment.paidTotal, {
              paid: formatPaise(figures.paidBefore + figures.paidNow),
              due: formatPaise(figures.due),
            })}
            readOnly={readOnly}
            testId={INVOICE_DRAWER_TEST_IDS.paidNow}
          />
        </DrawerField>
      )}
      <DrawerField span="full" label={t(K.fields.remark)} htmlFor={remark.id}>
        <DrawerTextarea
          {...remark.control}
          {...form.register('remark')}
          rows={2}
          maxLength={INVOICE_REMARK_MAX}
          placeholder={t(K.fields.remarkPlaceholder)}
          readOnly={readOnly}
          data-testid={INVOICE_DRAWER_TEST_IDS.remark}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}
