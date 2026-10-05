import type { FieldValues } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { MedicineRow } from '@/shared/api/clinic/medicines-contracts.ts';
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
import { supplierRateOf } from './purchase-order-form.ts';
import { useOrderMedicineCreate } from './use-order-quick-line.ts';

const K = MEDICAL_DRAWER_KEYS.purchaseOrder.fields;

/** Props of {@link OrderMedicineCell}. */
export interface OrderMedicineCellProps<TForm extends FieldValues> {
  /** `row.bind('medicineId')`. */
  binding: ItemsCellBinding<TForm>;
  /** `useMedicineOptions` for the order's supplier. */
  options: PickerOption<MedicineRow>[];
  /** The order's supplier: its rate fills the line; a typed name is linked to it. */
  supplierId: string | null;
  /** "New medicine · “q”" opens on top; without it there are no full details. */
  openChild?: OpenMedicalChild;
  disabled: boolean;
  /** A medicine picked, quick-made or saved on top: the line takes it. */
  onMedicine: (medicine: OrderLineMedicine) => void;
}

/**
 * A purchase line's medicine picker (`medical.md:261`, `:319`) — the purchase
 * order's rows and Receive goods' unexpected lines (H:5388): the options
 * grouped by the supplier's price list; "Add medicine “q”" — or a typed name
 * left behind — makes a quick one linked to the supplier ("Azel cream added ·
 * set MRP later in Stock"), and "New medicine · “q”" opens it in full on top.
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
  const createMedicine = useOrderMedicineCreate(supplierId);
  const made = (medicine: { id: string; name: string }) =>
    onMedicine({ id: medicine.id, name: medicine.name, rate: 0 });
  return (
    <ItemsPickerCell<TForm, MedicineRow>
      {...binding}
      options={options}
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
          });
        }
      }}
      onCreate={(query) => {
        void createMedicine(query).then((medicine) => {
          if (medicine) made(medicine);
        });
      }}
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
