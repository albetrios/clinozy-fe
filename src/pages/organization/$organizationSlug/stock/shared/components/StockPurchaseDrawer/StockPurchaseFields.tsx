import type { ReactElement } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { MONEY_SCALE, textFromNumber } from '@/lib/number-text.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import type { BranchOption } from '@/shared/api/app/branches-api.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { PAYMENT_MODE_TONES } from '@/shared/app/app-tones.ts';
import { MoneyCell } from '@/shared/components/Cells/index.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
  DrawerInput,
  DrawerNumberInput,
  DrawerQuickChips,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { CalendarPicker } from '@/shared/components/Picker/CalendarPicker/index.ts';
import { QuickLine } from '@/shared/components/QuickLine/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsNumberCell,
  ItemsQtyCell,
} from '@/shared/forms/ItemsField/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import type { OpenStockChild } from '../../hooks/useStockStack/index.ts';
import { useStockWords } from '../../hooks/useStockWords/index.ts';
import type { StockPurchaseRow } from '../../stock-contracts.ts';
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import { StockItemPicker, StockVendorPicker } from '../StockPickers/index.ts';
import {
  BILL_NO_MAX,
  billOf,
  emptyLine,
  lineAmount,
  linesTotal,
  PURCHASE_LINES_MAX,
  PURCHASE_PAYMENT_MODES,
  type StockPurchaseFormValues,
} from './stock-purchase-form.ts';
import { usePurchaseQuickLine } from './use-purchase-quick-line.ts';

const K = STOCK_DRAWER_KEYS.purchase.fields;

/** A money field's longest text (₹ 9,99,99,999). */
const MONEY_MAX_LENGTH = 9;

/**
 * What a new purchase's "Paid" offers a member who may pay (`payment:create`):
 * the branches they work in and the one it starts on.
 */
export interface PurchasePayment {
  branches: readonly BranchOption[];
  /** The member's default branch — the header's one branch, else the main one. */
  branchId: string | null;
}

/** What the step bodies read. */
export interface PurchaseFieldsProps {
  form: UseFormReturn<StockPurchaseFormValues>;
  idPrefix: string;
  readOnly: boolean;
  openChild?: OpenStockChild;
  testId: string;
  /** Edit purchase: the purchase as saved — its lines fixed, its Paid the server's. */
  saved: StockPurchaseRow | null;
  /** A new purchase's "Paid"; null without `payment:create` (and on an edit). */
  payment: PurchasePayment | null;
}

/** BILL: Supplier* · Invoice no. (≤ 30) · Bill date, never after today (`clinic-stock.md:146–148`). */
export function BillFields({
  form,
  idPrefix,
  readOnly,
  openChild,
  testId,
}: PurchaseFieldsProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const vendor = field('vendorId');
  const billNo = field('billNo');
  const date = field('date');
  return (
    <DrawerFieldGrid>
      <DrawerField
        span="half"
        stretch={false}
        label={t(K.vendor)}
        hint={t(STOCK_DRAWER_KEYS.pickers.vendorsHint)}
        htmlFor={vendor.id}
        required
        error={vendor.error}
      >
        <Controller
          control={form.control}
          name="vendorId"
          render={({ field: control }) => (
            <StockVendorPicker
              id={vendor.id}
              label={t(K.vendor)}
              value={control.value}
              onChange={control.onChange}
              openChild={openChild}
              invalid={Boolean(vendor.error)}
              disabled={readOnly}
              testId={`${testId}-vendor`}
            />
          )}
        />
      </DrawerField>
      <DrawerField
        span="third"
        label={t(K.billNo)}
        htmlFor={billNo.id}
        error={billNo.error}
      >
        <DrawerInput
          {...billNo.control}
          {...form.register('billNo')}
          capitalize={false}
          maxLength={BILL_NO_MAX}
          autoComplete="off"
          data-testid={`${testId}-bill-no`}
        />
      </DrawerField>
      <DrawerField span="third" label={t(K.date)} htmlFor={date.id} error={date.error}>
        <Controller
          control={form.control}
          name="date"
          render={({ field: control }) => (
            <CalendarPicker
              id={date.id}
              label={t(K.date)}
              value={control.value}
              onChange={control.onChange}
              max={appToday()}
              invalid={Boolean(date.error)}
              aria-describedby={date.control['aria-describedby']}
              disabled={readOnly}
              testId={`${testId}-date`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/**
 * The rows: Item · Qty · Rate* · Amount (`clinic-stock.md:149`; H:5276) — a
 * saved line's amount the server's, a new one's quantity × rate as typed.
 */
function useLineColumns({
  form,
  openChild,
}: PurchaseFieldsProps): ItemsColumn<StockPurchaseFormValues, 'lines'>[] {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const vendorId = useWatch({ control: form.control, name: 'vendorId' });
  return [
    {
      id: 'item',
      header: t(K.item),
      track: 'minmax(0,2fr)',
      cell: (row) => (
        <Controller
          control={form.control}
          name={`${row.name}.itemId`}
          render={({ field: control }) => (
            <StockItemPicker
              label={t(K.item)}
              value={control.value}
              onChange={control.onChange}
              openChild={openChild}
              vendorId={vendorId}
              disabled={!row.editable}
              testId={row.testId}
            />
          )}
        />
      ),
    },
    {
      id: 'qty',
      header: t(K.qty),
      track: '88px',
      align: 'end',
      cell: (row) => (
        <ItemsQtyCell {...row.bind('qty')} min={1} readOnly={!row.editable} />
      ),
    },
    {
      id: 'rate',
      header: t(K.rate),
      track: '90px',
      align: 'end',
      cell: (row) => (
        <ItemsNumberCell
          {...row.bind('rate')}
          money
          placeholder={t(K.rate)}
          readOnly={!row.editable}
        />
      ),
    },
    {
      id: 'amount',
      header: t(K.amount),
      track: '96px',
      align: 'end',
      cell: (row) =>
        row.row.amount === null ? (
          <MoneyCell paise={lineAmount(row.row)} className="text-body font-medium" />
        ) : (
          <MoneyCell rupees={row.row.amount} className="text-body font-medium" />
        ),
    },
  ];
}

/**
 * ITEMS RECEIVED (`clinic-stock.md:149`): on a new purchase the quick line —
 * "gloves 10 @250", the Low stock chips and Browse (`usePurchaseQuickLine`) —
 * over the bill's rows: an item ("Select item…"; "New clinic item · “q”"
 * stacked), its quantity, the rate it was bought at (required once an item is
 * picked) and the amount — "+ Add item" up to 50 rows, and the total. A saved
 * purchase's lines were received into stock and stay as they are.
 */
export function ItemsFields(props: PurchaseFieldsProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const lines = useWatch({ control: props.form.control, name: 'lines' });
  const vendorId = useWatch({ control: props.form.control, name: 'vendorId' });
  const quickLine = usePurchaseQuickLine({
    form: props.form,
    lines,
    vendorId,
    testId: props.testId,
  });
  const fixed = props.readOnly || props.saved !== null;
  const full = lines.length >= PURCHASE_LINES_MAX;
  return (
    <ItemsField
      control={props.form.control}
      name="lines"
      label={t(K.items)}
      columns={useLineColumns(props)}
      newRow={full ? undefined : emptyLine}
      addLabel={t(K.addItem)}
      total={formatPaise(linesTotal(lines))}
      totalLabel={t(K.total)}
      readOnly={fixed}
      testId={`${props.testId}-lines`}
      toolbar={fixed ? undefined : <QuickLine {...quickLine} />}
    />
  );
}

/** "Paid" on a new purchase: its amount with "Full" · "Nothing", how it was paid, and from which branch. */
function usePaidNowFields({
  form,
  idPrefix,
  testId,
  saved,
  payment,
}: PurchaseFieldsProps): ReactElement[] {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const values = useWatch({ control: form.control });
  if (saved || !payment) return [];
  const paid = field('paid');
  const branch = field('paidBranchId');
  const total = billOf({ bill: values.bill ?? '', lines: form.getValues('lines') });
  const fields = [
    <DrawerField
      key="paid"
      span="third"
      label={t(K.paid)}
      htmlFor={paid.id}
      error={paid.error}
    >
      <div className="flex flex-col gap-2">
        <Controller
          control={form.control}
          name="paid"
          render={({ field: control }) => (
            <DrawerNumberInput
              {...paid.control}
              value={control.value}
              onValueChange={control.onChange}
              onBlur={control.onBlur}
              prefix={tDrawer(RECORD_DRAWER_KEYS.currency)}
              placeholder="0"
              maxLength={MONEY_MAX_LENGTH}
              data-testid={`${testId}-paid`}
            />
          )}
        />
        <DrawerQuickChips
          label={t(K.paid)}
          options={[
            { value: 'full', label: t(K.full) },
            { value: 'nothing', label: t(K.nothing) },
          ]}
          value={null}
          onChange={(value) =>
            form.setValue(
              'paid',
              value === 'full' ? textFromNumber(total, MONEY_SCALE) : '',
              { shouldDirty: true },
            )
          }
          testId={`${testId}-paid-quick`}
        />
      </div>
    </DrawerField>,
    <DrawerField key="mode" span="third" label={t(K.mode)}>
      <DrawerChips
        label={t(K.mode)}
        options={PURCHASE_PAYMENT_MODES.map((mode) => ({
          value: mode,
          label: tApp(APP_KEYS.paymentModes[mode]),
          tone: PAYMENT_MODE_TONES[mode],
        }))}
        value={values.paidMode ?? 'cash'}
        onChange={(mode) => {
          if (mode) form.setValue('paidMode', mode, { shouldDirty: true });
        }}
        testId={`${testId}-paid-mode`}
      />
    </DrawerField>,
  ];
  // One open branch shows no branch UI (KICKOFF §6.12): the payment is that branch's.
  if (payment.branches.length > 1) {
    fields.push(
      <DrawerField key="branch" span="full" label={t(K.branch)} error={branch.error}>
        <DrawerChips
          label={t(K.branch)}
          options={payment.branches.map((option) => ({
            value: option.id,
            label: option.name,
            tone: option.tone,
          }))}
          value={values.paidBranchId ?? payment.branchId}
          onChange={(branchId) => {
            if (branchId) form.setValue('paidBranchId', branchId, { shouldDirty: true });
          }}
          testId={`${testId}-paid-branch`}
        />
      </DrawerField>,
    );
  }
  return fields;
}

/**
 * PAYMENT (`clinic-stock.md:150–151`): Bill amount — the lines' total until
 * typed — then, on a new purchase for a member who may pay, "Paid": an amount,
 * its mode (Cash · UPI · Card) and the paying branch, recorded as a
 * supplier-bill payment with the purchase. A saved purchase shows what is paid
 * on it as the server has it ("₹892.50 paid · Partly paid"); paying the rest
 * waits for Payments.
 */
export function PaymentFields(props: PurchaseFieldsProps) {
  const { form, idPrefix, testId, saved } = props;
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const words = useStockWords();
  const field = useDrawerFieldIds(form, idPrefix);
  const bill = field('bill');
  const lines = useWatch({ control: form.control, name: 'lines' });
  const paidNow = usePaidNowFields(props);
  return (
    <DrawerFieldGrid>
      <DrawerField
        span="third"
        label={t(K.billAmount)}
        htmlFor={bill.id}
        error={bill.error}
      >
        <Controller
          control={form.control}
          name="bill"
          render={({ field: control }) => (
            <DrawerNumberInput
              {...bill.control}
              value={control.value}
              onValueChange={control.onChange}
              onBlur={control.onBlur}
              prefix={tDrawer(RECORD_DRAWER_KEYS.currency)}
              placeholder={textFromNumber(linesTotal(lines), MONEY_SCALE) || '0'}
              maxLength={MONEY_MAX_LENGTH}
              data-testid={`${testId}-bill`}
            />
          )}
        />
      </DrawerField>
      {saved ? (
        <DrawerField span="third" label={t(K.paid)}>
          <DrawerInfo testId={`${testId}-paid`}>
            {t(K.paidSoFar, {
              amount: words.formatRupees(saved.paid),
              status: words.status(saved.status).label,
            })}
          </DrawerInfo>
        </DrawerField>
      ) : null}
      {paidNow}
    </DrawerFieldGrid>
  );
}
