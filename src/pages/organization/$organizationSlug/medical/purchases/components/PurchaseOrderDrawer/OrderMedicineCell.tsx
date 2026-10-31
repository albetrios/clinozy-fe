import { type FieldValues, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { MedicineRow } from '@/shared/api/app/medicines-contracts.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import {
  type ItemsCellBinding,
  ItemsPickerCell,
} from '@/shared/forms/ItemsField/index.ts';

import type { OpenMedicalChild } from '../../../shared/hooks/useMedicalStack/index.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';
import type { OrderLineMedicine } from './order-medicine.ts';
import {
  supplierRateOf,
  TYPED_MEDICINE_GST,
  typedMedicineKey,
  typedMedicineName,
} from './purchase-order-form.ts';

const K = MEDICAL_DRAWER_KEYS.purchaseOrder.fields;

/** Props of {@link OrderMedicineCell}. */
export interface OrderMedicineCellProps<TForm extends FieldValues> {
  /** `row.bind('medicineId')`. */
  binding: ItemsCellBinding<TForm>;
  /** `useMedicineOptions` for the order's supplier. */
  options: PickerOption<MedicineRow>[];
  /** The order's supplier: its rate fills the line. */
  supplierId: string | null;
  /** "New medicine · “q”" opens on top; without it there are no full details. */
  openChild?: OpenMedicalChild;
  disabled: boolean;
  /** A medicine picked, typed or saved on top: the line takes it. */
  onMedicine: (medicine: OrderLineMedicine) => void;
}

/**
 * A purchase line's medicine picker (`medical.md:261`, `:319`) — the purchase
 * order's rows and Receive goods' unexpected lines (H:5388): the options
 * grouped by the supplier's price list; "Add medicine “q”" — or a typed name
 * left behind — keeps the name on the line, "New medicine" under it, and the
 * save sends it for the server to add as a quick medicine (MD26); "New
 * medicine · “q”" opens it in full on top.
 */
export function OrderMedicineCell<TForm extends FieldValues>({
  binding,
  options,
  supplierId,
  openChild,
  disabled,
  onMedicine,
}: OrderMedicineCellProps<TForm>) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const value: unknown = useWatch({ control: binding.control, name: binding.name });
  const typed = typeof value === 'string' ? typedMedicineName(value) : null;
  // The line's typed medicine is an option of its own, so the cell names it.
  const lineOptions: PickerOption<MedicineRow>[] =
    typed === null
      ? options
      : [
          {
            key: typedMedicineKey(typed),
            label: typed,
            sub: t(K.newMedicine),
            leading: { kind: 'none' },
          },
          ...options,
        ];
  const made = (medicine: { id: string; name: string }) =>
    onMedicine({
      id: medicine.id,
      name: medicine.name,
      rate: 0,
      gstPercent: TYPED_MEDICINE_GST,
    });
  return (
    <ItemsPickerCell<TForm, MedicineRow>
      {...binding}
      options={lineOptions}
      placeholder={t(K.selectMedicine)}
      searchPlaceholder={t(K.searchMedicine)}
      searchable
      disabled={disabled}
      onPick={(option) => {
        if (option?.data) {
          onMedicine({
            id: option.data.id,
            name: option.data.name,
            rate: supplierRateOf(option.data, supplierId),
            gstPercent: option.data.gstPct,
          });
        }
      }}
      onCreate={(query) => made({ id: typedMedicineKey(query), name: query.trim() })}
      autoCreate
      createLabel={t(K.addMedicine)}
      onCreateFull={
        openChild
          ? (query) => openChild({ kind: 'medicine', query, onCreated: made })
          : undefined
      }
      createFullLabel={t(K.newMedicine)}
    />
  );
}
