import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { MONEY_SCALE, textFromNumber } from '@/lib/number-text.ts';
import { MoneyCell } from '@/shared/components/Cells/index.ts';
import {
  DrawerField,
  DrawerFieldGrid,
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
import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import { StockItemPicker, StockVendorPicker } from '../StockPickers/index.ts';
import {
  billOf,
  emptyLine,
  linesTotal,
  type StockPurchaseFormValues,
} from './stock-purchase-form.ts';
import { usePurchaseQuickLine } from './use-purchase-quick-line.ts';

const K = STOCK_DRAWER_KEYS.purchase.fields;

/** An invoice number's longest text. */
const BILL_NO_MAX = 40;

/** A money field's longest text (₹ 9,99,99,999). */
const MONEY_MAX_LENGTH = 9;

/** What the step bodies read. */
export interface PurchaseFieldsProps {
  form: UseFormReturn<StockPurchaseFormValues>;
  idPrefix: string;
  readOnly: boolean;
  openChild?: OpenStockChild;
  testId: string;
}

/** BILL: Supplier* · Invoice no. · Bill date (`clinic-stock.md:146–148`). */
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
      <DrawerField span="third" label={t(K.billNo)} htmlFor={billNo.id}>
        <DrawerInput
          {...billNo.control}
          {...form.register('billNo')}
          capitalize={false}
          maxLength={BILL_NO_MAX}
          autoComplete="off"
          data-testid={`${testId}-bill-no`}
        />
      </DrawerField>
      <DrawerField span="third" label={t(K.date)} htmlFor={date.id}>
        <Controller
          control={form.control}
          name="date"
          render={({ field: control }) => (
            <CalendarPicker
              id={date.id}
              label={t(K.date)}
              value={control.value}
              onChange={control.onChange}
              disabled={readOnly}
              testId={`${testId}-date`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** The rows: Item · Qty · Rate* · Amount (`clinic-stock.md:149`; H:5276). */
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
      cell: (row) => (
        <MoneyCell
          paise={row.row.itemId ? row.row.qty * row.row.rate : 0}
          className="text-body font-medium"
        />
      ),
    },
  ];
}

/**
 * ITEMS RECEIVED (`clinic-stock.md:149`): the quick line — "gloves 10 @250",
 * the Low stock chips and Browse (`usePurchaseQuickLine`) — over the bill's
 * rows: an item ("Select item…"; "New clinic item · “q”" stacked), its
 * quantity, the rate it was bought at (required once an item is picked) and
 * the amount — "+ Add item" and the total.
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
  return (
    <ItemsField
      control={props.form.control}
      name="lines"
      label={t(K.items)}
      columns={useLineColumns(props)}
      newRow={emptyLine}
      addLabel={t(K.addItem)}
      total={formatPaise(linesTotal(lines))}
      totalLabel={t(K.total)}
      readOnly={props.readOnly}
      testId={`${props.testId}-lines`}
      toolbar={props.readOnly ? undefined : <QuickLine {...quickLine} />}
    />
  );
}

/** PAYMENT: Bill amount (the lines' total until typed) · Paid with "Full" · "Nothing" (`clinic-stock.md:150–151`). */
export function PaymentFields({ form, idPrefix, testId }: PurchaseFieldsProps) {
  const { t } = useTranslation(STOCK_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const bill = field('bill');
  const paid = field('paid');
  const lines = useWatch({ control: form.control, name: 'lines' });
  const billText = useWatch({ control: form.control, name: 'bill' });
  const total = billOf({ bill: billText, lines });
  const currency = tDrawer(RECORD_DRAWER_KEYS.currency);
  return (
    <DrawerFieldGrid>
      <DrawerField span="third" label={t(K.billAmount)} htmlFor={bill.id}>
        <Controller
          control={form.control}
          name="bill"
          render={({ field: control }) => (
            <DrawerNumberInput
              {...bill.control}
              value={control.value}
              onValueChange={control.onChange}
              onBlur={control.onBlur}
              prefix={currency}
              placeholder={textFromNumber(linesTotal(lines), MONEY_SCALE) || '0'}
              maxLength={MONEY_MAX_LENGTH}
              data-testid={`${testId}-bill`}
            />
          )}
        />
      </DrawerField>
      <DrawerField span="third" label={t(K.paid)} htmlFor={paid.id}>
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
                prefix={currency}
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
      </DrawerField>
    </DrawerFieldGrid>
  );
}
