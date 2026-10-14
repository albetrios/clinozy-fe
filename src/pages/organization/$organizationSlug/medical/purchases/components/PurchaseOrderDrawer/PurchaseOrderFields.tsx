import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { MoneyCell } from '@/shared/components/Cells/index.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { CalendarPicker } from '@/shared/components/Picker/CalendarPicker/index.ts';
import { QuickLine } from '@/shared/components/QuickLine/index.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsNumberCell,
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
  lineAmount,
  orderTotal,
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

/** The rows: Medicine · Qty · Free · Rate* · Amount (`medical.md:261`; H:5389). */
function useLineColumns(
  { form, openChild }: OrderFieldsProps,
  supplierId: string | null,
  options: ReturnType<typeof useMedicineOptions>,
): ItemsColumn<PurchaseOrderFormValues, 'lines'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
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
      id: 'amount',
      header: t(K.amount),
      track: '96px',
      align: 'end',
      cell: ({ row }) => (
        <MoneyCell paise={lineAmount(row)} className="text-body font-medium" />
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
 * picked) and the amount — "+ Add medicine" and the total.
 */
export function ItemsFields(props: OrderFieldsProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const lines = useWatch({ control: props.form.control, name: 'lines' });
  const supplierId = useWatch({ control: props.form.control, name: 'supplierId' });
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
  return (
    <ItemsField
      control={props.form.control}
      name="lines"
      label={t(K.items)}
      columns={useLineColumns(props, supplierId, options)}
      newRow={emptyOrderLine}
      addLabel={t(K.add)}
      total={formatPaise(orderTotal(lines))}
      totalLabel={t(K.total)}
      readOnly={props.readOnly}
      testId={`${props.testId}-lines`}
      toolbar={props.readOnly ? undefined : <QuickLine {...quickLine} />}
    />
  );
}
