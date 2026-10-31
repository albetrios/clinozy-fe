import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { GST_PERCENT_VALUES } from '@/shared/api/app/offerings-contracts.ts';
import { MoneyCell } from '@/shared/components/Cells/index.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerToggle,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { CalendarPicker } from '@/shared/components/Picker/CalendarPicker/index.ts';
import { QuickLine } from '@/shared/components/QuickLine/index.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsNumberCell,
  ItemsPickerCell,
  ItemsQtyCell,
} from '@/shared/forms/ItemsField/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { MedicalPartnerPicker } from '../../../shared/components/MedicalPartnerPicker/index.ts';
import { useSupplierCatalogue } from '../../../shared/hooks/useMedicalLists/index.ts';
import type { MedicalPickers } from '../../../shared/hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../../shared/hooks/useMedicalStack/index.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';
import { useMedicineOptions } from './order-medicine.ts';
import { OrderMedicineCell } from './OrderMedicineCell.tsx';
import {
  emptyOrderLine,
  lineMoney,
  orderMoney,
  type PurchaseOrderFormValues,
} from './purchase-order-form.ts';
import { useOrderQuickLine } from './use-order-quick-line.ts';

const K = MEDICAL_DRAWER_KEYS.purchaseOrder.fields;

/** An invoice number's longest text (the contract's 40). */
const BILL_NO_MAX = 40;

/** What the step bodies read. */
export interface OrderFieldsProps {
  form: UseFormReturn<PurchaseOrderFormValues>;
  idPrefix: string;
  readOnly: boolean;
  pickers: MedicalPickers;
  openChild?: OpenMedicalChild;
  testId: string;
}

/** ORDER: Supplier* · Invoice no. · Order date (`medical.md:258–260`). */
export function OrderFields({
  form,
  idPrefix,
  readOnly,
  pickers,
  openChild,
  testId,
}: OrderFieldsProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const supplier = field('supplierId');
  const billNo = field('billNo');
  const date = field('date');
  return (
    <DrawerFieldGrid>
      <DrawerField
        span="half"
        stretch={false}
        label={t(K.supplier)}
        htmlFor={supplier.id}
        required
        error={supplier.error}
      >
        <Controller
          control={form.control}
          name="supplierId"
          render={({ field: control }) => (
            <MedicalPartnerPicker
              kind="supplier"
              id={supplier.id}
              invalid={Boolean(supplier.error)}
              label={t(K.supplier)}
              value={control.value}
              onChange={control.onChange}
              pickers={pickers}
              openChild={openChild}
              disabled={readOnly}
              testId={`${testId}-supplier`}
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
          readOnly={readOnly}
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

/** The GST picker's options: 0 % · 5 % · 12 % · 18 % · 28 %. */
function useGstOptions() {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  return GST_PERCENT_VALUES.map((value) => ({
    key: String(value),
    label: t(K.gstRate, { value }),
  }));
}

/**
 * The rows: Medicine · Qty · Free · Rate* · GST · Amount (`medical.md:261`; H:5389) — GST the
 * line's rate, the picked medicine's until changed (feat-purchase-line-gst D3).
 */
function useLineColumns(
  { form, openChild }: OrderFieldsProps,
  supplierId: string | null,
  options: ReturnType<typeof useMedicineOptions>,
  gstInclusive: boolean,
): ItemsColumn<PurchaseOrderFormValues, 'lines'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const gstOptions = useGstOptions();
  return [
    {
      id: 'medicine',
      header: t(K.medicine),
      track: 'minmax(0,2fr)',
      cell: (row) => (
        <OrderMedicineCell<PurchaseOrderFormValues>
          binding={row.bind('medicineId')}
          options={options}
          supplierId={supplierId}
          openChild={openChild}
          disabled={!row.editable}
          onMedicine={(medicine) => {
            form.setValue(`lines.${row.index}.medicineId`, medicine.id, {
              shouldDirty: true,
            });
            form.setValue(`lines.${row.index}.rate`, medicine.rate, {
              shouldDirty: true,
            });
            form.setValue(`lines.${row.index}.gst`, String(medicine.gstPercent), {
              shouldDirty: true,
            });
          }}
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
      id: 'free',
      header: t(K.free),
      track: '88px',
      align: 'end',
      cell: (row) => (
        <ItemsQtyCell {...row.bind('free')} min={0} readOnly={!row.editable} />
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
      id: 'gst',
      header: t(K.gst),
      track: '84px',
      cell: (row) => (
        <ItemsPickerCell<PurchaseOrderFormValues>
          {...row.bind('gst')}
          options={gstOptions}
          placeholder={t(K.gst)}
          disabled={!row.editable}
        />
      ),
    },
    {
      id: 'amount',
      header: t(K.amount),
      track: '96px',
      align: 'end',
      cell: ({ row }) => (
        <MoneyCell
          paise={lineMoney(row, gstInclusive).amount}
          className="text-body font-medium"
        />
      ),
    },
  ];
}

/**
 * ITEMS (`medical.md:261`): the quick line — "azel 20 +2 @180", the Low stock
 * chips and Browse (`useOrderQuickLine`) — over the order's rows: a medicine
 * (grouped by the supplier's price list; "Add medicine “q”" keeps the typed
 * name for the save to add, "New medicine · “q”" opens it in full on top), its
 * quantity, the free units, the purchase rate (required once a medicine is
 * picked), its GST rate and the amount — "+ Add medicine" and the total; under them "Rates
 * include GST" (one switch for the order) and "Taxable ₹x · GST ₹y".
 */
export function ItemsFields(props: OrderFieldsProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const lines = useWatch({ control: props.form.control, name: 'lines' });
  const supplierId = useWatch({ control: props.form.control, name: 'supplierId' });
  const gstInclusive = useWatch({ control: props.form.control, name: 'gstInclusive' });
  const money = orderMoney(lines, gstInclusive);
  const supplierName = useSupplierCatalogue().data?.find(
    (row) => row.id === supplierId,
  )?.name;
  const options = useMedicineOptions(supplierId, supplierName);
  const quickLine = useOrderQuickLine({
    form: props.form,
    options,
    lines,
    supplierId,
    supplierName,
    testId: props.testId,
  });
  const columns = useLineColumns(props, supplierId, options, gstInclusive);
  return (
    <>
      <ItemsField
        control={props.form.control}
        name="lines"
        label={t(K.items)}
        columns={columns}
        newRow={emptyOrderLine}
        addLabel={t(K.add)}
        total={formatPaise(money.amount)}
        totalLabel={t(K.total)}
        readOnly={props.readOnly}
        testId={`${props.testId}-lines`}
        toolbar={props.readOnly ? undefined : <QuickLine {...quickLine} />}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Controller
          control={props.form.control}
          name="gstInclusive"
          render={({ field: control }) => (
            <DrawerToggle
              aria-label={t(K.ratesIncludeGst)}
              checked={control.value}
              onCheckedChange={control.onChange}
              onLabel={t(K.ratesIncludeGst)}
              offLabel={t(K.gstOnTop)}
              disabled={props.readOnly}
              data-testid={`${props.testId}-gst-inclusive`}
            />
          )}
        />
        <p
          className="text-caption text-muted-foreground tabular-nums"
          data-testid={`${props.testId}-gst-totals`}
        >
          {t(K.gstTotals, {
            taxable: formatPaise(money.taxable),
            gst: formatPaise(money.gst),
          })}
        </p>
      </div>
    </>
  );
}
