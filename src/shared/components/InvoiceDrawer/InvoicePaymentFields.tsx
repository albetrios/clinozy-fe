import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { INVOICE_REMARK_MAX } from '@/shared/api/clinic/invoices-contracts.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import { PAYMENT_MODE_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerQuickChips,
  DrawerStepper,
  DrawerTextarea,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
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
import {
  blankPaidNow,
  type InvoiceDraftFigures,
  type InvoiceFormValues,
  PAID_NOW_MODES,
  type PaidNowMode,
  type PaidNowRow,
  percentOf,
} from './invoice-form.ts';

const K = INVOICE_DRAWER_KEYS;

/** The three presets of "Quick fill" in the Payment step (`payments.md:144`). */
type PaymentPreset = 'full' | 'split' | 'nothing';

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
  figures: InvoiceDraftFigures;
  /** What the invoice has already received — an edit's; 0 for a new one. */
  alreadyPaid: number;
  idPrefix: string;
  readOnly: boolean;
}

/**
 * The Payment step (`payments.md:143–146`; H:5063): the overall discount as a
 * percent — before tax, off the subtotal after line discounts (Q-G7) — the
 * Quick fill presets ("Full · ₹324 in UPI" · "Split cash + UPI" · "Nothing
 * now"), the "Paid now" rows with "Paid ₹324 · due ₹0" and "+ Add another
 * mode", and the Remark — "Shown on the printed invoice", the one note that
 * prints (§7.3).
 */
export function InvoicePaymentFields({
  form,
  values,
  figures,
  alreadyPaid,
  idPrefix,
  readOnly,
}: InvoicePaymentFieldsProps) {
  const { t } = useTranslation(INVOICE_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const ids = useDrawerFieldIds(form, idPrefix);
  const columns = usePaidNowColumns();
  // What is left to take now: the bill less what the ledger already has.
  const left = Math.max(0, figures.totals.bill - alreadyPaid);
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
  const applyPreset = (preset: PaymentPreset) => {
    if (preset === 'full') setPaidNow([{ mode: firstMode, amount: left }]);
    else if (preset === 'split') {
      const cash = Math.round(left / 2);
      setPaidNow([
        { mode: 'cash', amount: cash },
        { mode: 'upi', amount: left - cash },
      ]);
    } else setPaidNow(blankPaidNow(firstMode));
  };

  const next = nextPaidNowRow(values.paidNow, left - figures.paidNow);
  const discount = ids('overallDiscountPct');
  const remark = ids('remark');

  return (
    <DrawerFieldGrid>
      <DrawerField
        span="half"
        stretch={false}
        label={t(K.fields.overallDiscount)}
        htmlFor={discount.id}
        error={discount.error}
      >
        <Controller
          control={form.control}
          name="overallDiscountPct"
          render={({ field }) => (
            // "−  0 %  +" (H:5063): a stored fraction reads as it is, a typed figure is whole.
            <DrawerStepper
              {...discount.control}
              ref={field.ref}
              value={percentOf(field.value)}
              onValueChange={(next) => field.onChange(String(next))}
              onBlur={field.onBlur}
              suffix="%"
              max={100}
              disabled={readOnly}
              testId={INVOICE_DRAWER_TEST_IDS.overallDiscount}
            />
          )}
        />
      </DrawerField>
      {readOnly ? null : (
        <DrawerField span="full" label={t(K.fields.quickFill)}>
          <DrawerQuickChips
            label={t(K.fields.quickFill)}
            options={presets}
            value={null}
            onChange={applyPreset}
            testId={INVOICE_DRAWER_TEST_IDS.paymentQuickFill}
          />
        </DrawerField>
      )}
      <DrawerField span="full" label={t(K.fields.paidNow)}>
        <ItemsField
          control={form.control}
          name="paidNow"
          label={t(K.fields.paidNow)}
          columns={columns}
          compact
          minRows={1}
          clearRow={() => ({ mode: firstMode, amount: 0 })}
          newRow={next ? () => next : undefined}
          addLabel={t(K.payment.addMode)}
          total={t(K.payment.paidTotal, {
            paid: formatPaise(alreadyPaid + figures.paidNow),
            due: formatPaise(figures.balance.due),
          })}
          readOnly={readOnly}
          testId={INVOICE_DRAWER_TEST_IDS.paidNow}
        />
      </DrawerField>
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
