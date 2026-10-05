import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { MedicineRow } from '@/shared/api/clinic/medicines-contracts.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';
import { useMedicineCatalogue } from '@/shared/hooks/useMedicines/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';

import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../../shared/medical-drawers.constants.ts';
import { pricedBy, supplierRateOf } from './purchase-order-form.ts';

/*
 * A purchase line's medicine (`medical.md:261`) — the purchase order's rows
 * and Receive goods' unexpected lines (H:5388) pick it, and ask for its rate,
 * the same way. The picker itself is `OrderMedicineCell`.
 */

const K = MEDICAL_DRAWER_KEYS.purchaseOrder;

/**
 * The medicine picker's options (`medical.md:261`): with a supplier picked,
 * the medicines it prices first ("From K R Medical Agency") then "Other
 * medicines"; each "8 in stock · ALVI" or "Out of stock · DERM", the
 * supplier's rate at the end.
 */
export function useMedicineOptions(
  supplierId: string | null,
  supplierName: string | undefined,
): PickerOption<MedicineRow>[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const medicines = useMedicineCatalogue().data ?? [];
  const fromSupplier = supplierName
    ? t(K.fields.fromSupplier, { supplier: supplierName })
    : undefined;
  const option = (row: MedicineRow, group?: string): PickerOption<MedicineRow> => {
    const maker = row.manufacturer?.name ?? '';
    const rate = supplierRateOf(row, supplierId);
    return {
      key: row.id,
      label: row.name,
      sub:
        row.stock > 0
          ? t(K.fields.inStock, { count: row.stock, maker })
          : t(K.fields.outOfStock, { maker }),
      meta: rate > 0 ? formatPaise(rate) : undefined,
      group,
      keywords: [row.composition ?? '', maker],
      leading: { kind: 'none' },
      data: row,
    };
  };
  if (!fromSupplier) return medicines.map((row) => option(row));
  const priced = (row: MedicineRow) => pricedBy(row, supplierId);
  const others = t(K.fields.otherMedicines);
  return [
    ...medicines.filter(priced).map((row) => option(row, fromSupplier)),
    ...medicines.filter((row) => !priced(row)).map((row) => option(row, others)),
  ];
}

/** The medicine a line takes: its id and name, and the rate it starts at. */
export interface OrderLineMedicine {
  id: string;
  name: string;
  /** The supplier's rate for it, else its best rate; 0 for a medicine just made. */
  rate: number;
}

/**
 * "Enter the rate for Epriva Tab" — or, for several, "Enter the rate for 2
 * medicines": the names of the lines with no rate, in order.
 */
export function rateMessage(
  names: readonly (string | undefined)[],
  t: TFunction,
): string {
  const [name] = names;
  if (names.length === 1 && name) return t(K.rateFor, { name });
  return t(K.rateForCount, { count: names.length });
}
