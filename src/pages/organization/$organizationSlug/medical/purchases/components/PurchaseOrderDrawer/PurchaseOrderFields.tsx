import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { MedicineRow } from '@/shared/api/clinic/medicines-contracts.ts';
import { MoneyCell } from '@/shared/components/Cells/index.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { CalendarPicker } from '@/shared/components/Picker/CalendarPicker/index.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import {
  type ItemsColumn,
  ItemsField,
  ItemsNumberCell,
  ItemsPickerCell,
  ItemsQtyCell,
} from '@/shared/forms/ItemsField/index.ts';
import {
  useMedicineCatalogue,
  useQuickCreateMedicine,
} from '@/shared/hooks/useMedicines/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import { MedicalPartnerPicker } from '../../../shared/components/MedicalPartnerPicker/index.ts';
import { useSupplierCatalogue } from '../../../shared/hooks/useMedicalLists/index.ts';
import type { MedicalPickers } from '../../../shared/hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../../shared/hooks/useMedicalStack/index.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';
import {
  emptyOrderLine,
  lineAmount,
  orderTotal,
  type PurchaseOrderFormValues,
  supplierRateOf,
} from './purchase-order-form.ts';

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

/**
 * The medicine picker's options (`medical.md:261`): with a supplier picked,
 * the medicines it prices first ("From K R Medical Agency") then "Other
 * medicines"; each "8 in stock · ALVI" or "Out of stock · DERM", the
 * supplier's rate at the end.
 */
function useMedicineOptions(supplierId: string | null): PickerOption<MedicineRow>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const medicines = useMedicineCatalogue().data ?? [];
  const supplierName = useSupplierCatalogue().data?.find(
    (row) => row.id === supplierId,
  )?.name;
  const fromSupplier = supplierName
    ? t(K.fromSupplier, { supplier: supplierName })
    : undefined;
  const option = (row: MedicineRow, group?: string): PickerOption<MedicineRow> => {
    const maker = row.manufacturer?.name ?? '';
    const rate = supplierRateOf(row, supplierId);
    return {
      key: row.id,
      label: row.name,
      sub:
        row.stock > 0
          ? t(K.inStock, { count: row.stock, maker })
          : t(K.outOfStock, { maker }),
      meta: rate > 0 ? formatPaise(rate) : undefined,
      group,
      keywords: [row.composition ?? '', maker],
      leading: { kind: 'none' },
      data: row,
    };
  };
  if (!fromSupplier) return medicines.map((row) => option(row));
  const priced = (row: MedicineRow) =>
    row.supplierRates.some((rate) => rate.supplierId === supplierId);
  const others = t(K.otherMedicines);
  return [
    ...medicines.filter(priced).map((row) => option(row, fromSupplier)),
    ...medicines.filter((row) => !priced(row)).map((row) => option(row, others)),
  ];
}

/** The rows: Medicine · Qty · Free · Rate* · Amount (`medical.md:261`; H:5389). */
function useLineColumns({
  form,
  openChild,
}: OrderFieldsProps): ItemsColumn<PurchaseOrderFormValues, 'lines'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const supplierId = useWatch({ control: form.control, name: 'supplierId' });
  const options = useMedicineOptions(supplierId);
  const quickMedicine = useQuickCreateMedicine({
    successMessage: (medicine) =>
      t(MEDICAL_DRAWER_KEYS.quick.medicine, { name: medicine.name }),
  });
  const setMedicine = (index: number, medicineId: string, rate: number) => {
    form.setValue(`lines.${index}.medicineId`, medicineId, { shouldDirty: true });
    form.setValue(`lines.${index}.rate`, rate, { shouldDirty: true });
  };
  return [
    {
      id: 'medicine',
      header: t(K.medicine),
      track: 'minmax(0,2fr)',
      cell: (row) => (
        <ItemsPickerCell<PurchaseOrderFormValues, MedicineRow>
          {...row.bind('medicineId')}
          options={options}
          placeholder={t(K.selectMedicine)}
          searchPlaceholder={t(K.searchMedicine)}
          searchable
          disabled={!row.editable}
          onPick={(option) => {
            if (option?.data) {
              form.setValue(
                `lines.${row.index}.rate`,
                supplierRateOf(option.data, supplierId),
                { shouldDirty: true },
              );
            }
          }}
          onCreate={(query) => {
            quickMedicine
              .mutateAsync({ name: query, supplierId })
              .then((medicine) => setMedicine(row.index, medicine.id, 0))
              .catch(() => undefined);
          }}
          autoCreate
          createLabel={t(K.addMedicine)}
          onCreateFull={
            openChild
              ? (query) =>
                  openChild({
                    kind: 'medicine',
                    query,
                    onCreated: (medicine) => setMedicine(row.index, medicine.id, 0),
                  })
              : undefined
          }
          createFullLabel={t(K.newMedicine)}
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
 * ITEMS (`medical.md:261`): the order's rows — a medicine (grouped by the
 * supplier's price list; "Add medicine “q”" makes a quick one linked to the
 * supplier, "New medicine · “q”" opens it in full on top), its quantity, the
 * free units, the purchase rate (required once a medicine is picked) and the
 * amount — "+ Add medicine" and the total. The quick line, Browse and the Low
 * stock chips arrive with the shared quick line (L-45).
 */
export function ItemsFields(props: OrderFieldsProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const lines = useWatch({ control: props.form.control, name: 'lines' });
  return (
    <ItemsField
      control={props.form.control}
      name="lines"
      label={t(K.items)}
      columns={useLineColumns(props)}
      newRow={emptyOrderLine}
      addLabel={t(K.add)}
      total={formatPaise(orderTotal(lines))}
      totalLabel={t(K.total)}
      readOnly={props.readOnly}
      testId={`${props.testId}-lines`}
    />
  );
}
