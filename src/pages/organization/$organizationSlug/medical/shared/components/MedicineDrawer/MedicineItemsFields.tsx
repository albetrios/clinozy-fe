import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  type ItemsColumn,
  ItemsField,
  ItemsNumberCell,
  ItemsPickerCell,
  ItemsQtyCell,
  ItemsTextCell,
} from '@/shared/forms/ItemsField/index.ts';

import type { MedicalPickers } from '../../hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../hooks/useMedicalStack/index.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';
import {
  emptyBatch,
  formStock,
  MEDICINE_FORM_LIMITS,
  type MedicineFormValues,
  nextSupplierRate,
} from './medicine-form.ts';

const P = MEDICAL_DRAWER_KEYS.pickers;
const B = MEDICAL_DRAWER_KEYS.medicine.batches;
const R = MEDICAL_DRAWER_KEYS.medicine.rates;

/** What both item tables read. */
interface ItemsProps {
  form: UseFormReturn<MedicineFormValues>;
  values: MedicineFormValues;
  readOnly: boolean;
  testId: string;
}

/** The batch rows: Batch · Expiry "MM/YY" · Qty · Rate (H:5372). */
function useBatchColumns(): ItemsColumn<MedicineFormValues, 'batches'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  return [
    {
      id: 'batch',
      header: t(B.batch),
      track: 'minmax(0,1fr)',
      cell: (row) => (
        <ItemsTextCell
          {...row.bind('batchNo')}
          placeholder={t(B.batch)}
          maxLength={MEDICINE_FORM_LIMITS.batchNo}
          readOnly={!row.editable}
        />
      ),
    },
    {
      id: 'expiry',
      header: t(B.expiry),
      track: '90px',
      cell: (row) => (
        <ItemsTextCell
          {...row.bind('expiry')}
          placeholder={t(B.expiryPlaceholder)}
          maxLength={5}
          readOnly={!row.editable}
        />
      ),
    },
    {
      id: 'qty',
      header: t(B.qty),
      track: '70px',
      align: 'end',
      cell: (row) => (
        <ItemsNumberCell
          {...row.bind('qty')}
          placeholder={t(B.qty)}
          max={MEDICINE_FORM_LIMITS.level}
          readOnly={!row.editable}
        />
      ),
    },
    {
      id: 'rate',
      header: t(B.rate),
      track: '90px',
      align: 'end',
      cell: (row) => (
        <ItemsNumberCell
          {...row.bind('purchaseRate')}
          money
          placeholder={t(B.rate)}
          readOnly={!row.editable}
        />
      ),
    },
  ];
}

/** BATCHES: what is in stock, batch by batch, and the total (`medical.md:181`). */
export function MedicineBatchesField({ form, values, readOnly, testId }: ItemsProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  return (
    <ItemsField
      control={form.control}
      name="batches"
      label={t(B.title)}
      columns={useBatchColumns()}
      newRow={emptyBatch}
      addLabel={t(B.add)}
      total={t(B.total, { count: formStock(values) })}
      readOnly={readOnly}
      testId={`${testId}-batches`}
    />
  );
}

/** What the supplier-price table reads beside the form. */
interface RatesProps extends ItemsProps {
  pickers: MedicalPickers;
  /** Every live supplier with the makers it distributes — "+ Add supplier price" picks the next. */
  suppliers: readonly { id: string; manufacturerIds: readonly string[] }[];
  openChild?: OpenMedicalChild;
}

/** What the supplier-price columns read. */
type RateColumnsProps = Pick<RatesProps, 'form' | 'values' | 'pickers' | 'openChild'>;

/** The supplier-price rows: Supplier · Rate* · Free · Lead days (H:5373). */
function useRateColumns({
  form,
  values,
  pickers,
  openChild,
}: RateColumnsProps): ItemsColumn<MedicineFormValues, 'supplierRates'>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const makerId = values.manufacturerId;
  const makerIds = makerId ? [makerId] : [];
  const setSupplier = (index: number, supplierId: string) =>
    form.setValue(`supplierRates.${index}.supplierId`, supplierId, {
      shouldDirty: true,
    });
  return [
    {
      id: 'supplier',
      header: t(R.supplier),
      track: 'minmax(0,1.6fr)',
      cell: (row) => (
        <ItemsPickerCell
          {...row.bind('supplierId')}
          options={pickers.suppliers(makerId)}
          placeholder={t(R.supplier)}
          searchPlaceholder={t(P.searchSupplier)}
          searchable
          disabled={!row.editable}
          onCreate={(query) => {
            pickers
              .addSupplier(query, makerIds)
              .then((id) => setSupplier(row.index, id))
              .catch(() => undefined);
          }}
          createLabel={t(P.addSupplier)}
          onCreateFull={
            openChild
              ? (query) =>
                  openChild({
                    kind: 'supplier',
                    query,
                    manufacturerIds: makerIds,
                    onCreated: (supplier) => {
                      pickers.remember.supplier(supplier);
                      setSupplier(row.index, supplier.id);
                    },
                  })
              : undefined
          }
          createFullLabel={t(P.newSupplier)}
        />
      ),
    },
    {
      id: 'rate',
      header: t(R.rate),
      track: '90px',
      align: 'end',
      cell: (row) => (
        <ItemsNumberCell
          {...row.bind('rate')}
          money
          placeholder={t(R.rate)}
          readOnly={!row.editable}
        />
      ),
    },
    {
      id: 'free',
      header: t(R.free),
      track: '88px',
      align: 'end',
      cell: (row) => (
        <ItemsQtyCell {...row.bind('free')} min={0} readOnly={!row.editable} />
      ),
    },
    {
      id: 'lead-days',
      header: t(R.leadDays),
      track: '88px',
      align: 'end',
      cell: (row) => (
        <ItemsQtyCell {...row.bind('leadDays')} min={0} readOnly={!row.editable} />
      ),
    },
  ];
}

/**
 * SUPPLIER PRICES (`medical.md:182`): who sells it and at what — the supplier
 * (those distributing its maker first; quick-added or created in full on
 * top), the rate (required once a supplier is picked: the cell turns red with
 * "Enter this supplier’s rate"), free units and lead days. "+ Add supplier
 * price" offers the next supplier of its maker without a price.
 */
export function MedicineRatesField({
  form,
  values,
  readOnly,
  testId,
  pickers,
  suppliers,
  openChild,
}: RatesProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  return (
    <ItemsField
      control={form.control}
      name="supplierRates"
      label={t(R.title)}
      columns={useRateColumns({ form, values, pickers, openChild })}
      newRow={() =>
        nextSupplierRate(form.getValues(), suppliers, form.getValues('manufacturerId'))
      }
      addLabel={t(R.add)}
      readOnly={readOnly}
      testId={`${testId}-rates`}
    />
  );
}
