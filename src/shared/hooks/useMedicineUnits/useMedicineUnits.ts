import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { packsAndLoose } from '@/shared/api/app/medicine-stock.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';

const K = APP_KEYS.medicineUnits;

/** A medicine's pack and HSN code, as a line names them. */
interface MedicineDetails {
  /** The pack as printed ("1*10") — a bill line's pack size. */
  pack: string | null;
  hsnCode: string | null;
}

/** What {@link useMedicineUnits} answers. */
export interface MedicineUnitsFormat {
  /**
   * A loose-selling medicine's units as packs and loose units — "3 packs + 4", "3 packs",
   * "4 loose"; `null` while it sells whole packs (`unitsPerPack` 1), so the screen keeps its
   * own words for a count of packs.
   */
  packs: (units: number, unitsPerPack: number) => string | null;
  /** "3 packs + 4 in stock"; `null` while it sells whole packs. */
  inStock: (units: number, unitsPerPack: number) => string | null;
  /** "= 1 pack + 2" — a line's units as packs; `null` while it sells whole packs. */
  packEquivalent: (units: number, unitsPerPack: number) => string | null;
  /** "2 packs" — whole packs, as an order counts them. */
  packCount: (packs: number) => string;
  /** "10 per pack"; `null` while it sells whole packs. */
  perPack: (unitsPerPack: number) => string | null;
  /** "₹12.55 a unit", from the price already formatted. */
  unitPrice: (price: string) => string;
  /** "1*10 · HSN 3004" — what a line shows under its name; empty when it has neither. */
  details: (details: MedicineDetails) => string;
  /** "HSN 3004". */
  hsn: (code: string) => string;
}

/**
 * The words for a medicine's units (change-pharmacy-record-fields D5): stock counts units — a
 * pack while `unitsPerPack` is 1 (every medicine reads as before), the loose strip or tablet
 * above it, shown as whole packs and the loose rest. Shared by the Medical room (the Medicines
 * tab, the medicine drawer, the sale views) and the Invoice drawer's New sale; the copy is in
 * `app`, which loads with the org shell.
 */
export function useMedicineUnits(): MedicineUnitsFormat {
  const { t } = useTranslation(APP_NS);
  return useMemo(() => {
    const hsn = (code: string) => t(K.hsn, { code });
    const packs = (units: number, unitsPerPack: number) => {
      if (unitsPerPack <= 1) return null;
      const split = packsAndLoose(units, unitsPerPack);
      if (split.packs === 0) return t(K.loose, { count: split.loose });
      if (split.loose === 0) return t(K.packs, { count: split.packs });
      return t(K.packsAndLoose, { count: split.packs, loose: split.loose });
    };
    return {
      packs,
      inStock: (units, unitsPerPack) => {
        const stock = packs(units, unitsPerPack);
        return stock === null ? null : t(K.inStock, { stock });
      },
      packEquivalent: (units, unitsPerPack) => {
        const equal = packs(units, unitsPerPack);
        return equal === null ? null : t(K.packEquivalent, { packs: equal });
      },
      packCount: (count) => t(K.packs, { count }),
      perPack: (unitsPerPack) =>
        unitsPerPack > 1 ? t(K.perPack, { count: unitsPerPack }) : null,
      unitPrice: (price) => t(K.unitPrice, { price }),
      details: ({ pack, hsnCode }) =>
        [pack?.trim(), hsnCode ? hsn(hsnCode) : ''].filter(Boolean).join(' · '),
      hsn,
    };
  }, [t]);
}
