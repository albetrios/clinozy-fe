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
  /** "10 per pack"; `null` while it sells whole packs. */
  perPack: (unitsPerPack: number) => string | null;
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
    return {
      packs: (units, unitsPerPack) => {
        if (unitsPerPack <= 1) return null;
        const { packs, loose } = packsAndLoose(units, unitsPerPack);
        if (packs === 0) return t(K.loose, { count: loose });
        if (loose === 0) return t(K.packs, { count: packs });
        return t(K.packsAndLoose, { count: packs, loose });
      },
      perPack: (unitsPerPack) =>
        unitsPerPack > 1 ? t(K.perPack, { count: unitsPerPack }) : null,
      details: ({ pack, hsnCode }) =>
        [pack?.trim(), hsnCode ? hsn(hsnCode) : ''].filter(Boolean).join(' · '),
      hsn,
    };
  }, [t]);
}
