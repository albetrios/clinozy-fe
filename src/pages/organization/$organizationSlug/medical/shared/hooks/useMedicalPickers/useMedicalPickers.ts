import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  Manufacturer,
  MedicalRep,
  Supplier,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import type { PickerOption } from '@/shared/components/Picker/index.ts';

import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';
import {
  useManufacturerCatalogue,
  useMrCatalogue,
  useSupplierCatalogue,
} from '../useMedicalLists/index.ts';
import {
  useQuickCreateManufacturer,
  useQuickCreateMedicalRep,
  useQuickCreateSupplier,
} from '../useMedicalPartners/index.ts';

const K = MEDICAL_DRAWER_KEYS;

/** A maker as a picker reads it. */
interface MakerEntry {
  id: string;
  name: string;
  tone: Tone;
  medicineCount: number;
}

/** A supplier or MR as a picker reads them. */
interface PartnerEntry {
  id: string;
  name: string;
  phone: string | null;
  manufacturerIds: readonly string[];
}

/** What the room has just created and the catalogues may not list yet. */
interface Added {
  manufacturers: MakerEntry[];
  suppliers: PartnerEntry[];
  mrs: PartnerEntry[];
}

const NONE: Added = { manufacturers: [], suppliers: [], mrs: [] };

/** The catalogue's rows, then what was just created that it does not list yet. */
function withAdded<T extends { id: string }>(rows: readonly T[], added: readonly T[]) {
  const known = new Set(rows.map((row) => row.id));
  return [...rows, ...added.filter((row) => !known.has(row.id))];
}

/** What {@link useMedicalPickers} hands a drawer. */
export interface MedicalPickers {
  /** Makers as tone pills, "2 medicines" under each (`medical.md:175`). */
  manufacturers: PickerOption[];
  /**
   * Suppliers, sub the phone or "No phone yet" — with a maker, the ones that
   * distribute it first under "Distributes ALVI", then "Other suppliers".
   */
  suppliers: (makerId?: string | null) => PickerOption[];
  /** MRs, sub the phone or "No phone yet". */
  mrs: PickerOption[];
  /** "Add manufacturer “acme”": created, toasted, listed — resolves to its id. */
  addManufacturer: (name: string) => Promise<string>;
  /** "Add supplier “Om Pharma”", distributing the makers given. */
  addSupplier: (name: string, manufacturerIds?: readonly string[]) => Promise<string>;
  /** "Add MR “Ravi”". */
  addMr: (name: string) => Promise<string>;
  /** List a record a stacked child created until the catalogue does. */
  remember: {
    manufacturer: (maker: Manufacturer) => void;
    supplier: (supplier: Supplier) => void;
    mr: (rep: MedicalRep) => void;
  };
}

/**
 * The partner pickers of the Medical drawers (`medical.md:170–231, 311–325`):
 * the makers, suppliers and MRs as options, and the quick records their
 * create rows add — toasted ("Manufacturer ACME added"), listed at once and
 * handed back to select.
 */
export function useMedicalPickers(): MedicalPickers {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const makers = useManufacturerCatalogue().data ?? [];
  const suppliers = useSupplierCatalogue().data ?? [];
  const reps = useMrCatalogue().data ?? [];
  const [added, setAdded] = useState<Added>(NONE);

  const quickMaker = useQuickCreateManufacturer({
    successMessage: (maker) => t(K.quick.manufacturer, { name: maker.name }),
  });
  const quickSupplier = useQuickCreateSupplier({
    successMessage: (supplier) => t(K.quick.supplier, { name: supplier.name }),
  });
  const quickMr = useQuickCreateMedicalRep({
    successMessage: (rep) => t(K.quick.mr, { name: rep.name }),
  });

  const listMaker = (maker: Manufacturer) =>
    setAdded((current) => ({
      ...current,
      manufacturers: [...current.manufacturers, { ...maker, medicineCount: 0 }],
    }));
  const listPartner = (key: 'suppliers' | 'mrs', partner: PartnerEntry) =>
    setAdded((current) => ({ ...current, [key]: [...current[key], partner] }));

  const phoneLine = (phone: string | null) =>
    phone ? formatClinicPhone(phone) : t(K.pickers.noPhone);
  const partnerOption = (row: PartnerEntry, group?: string): PickerOption => ({
    key: row.id,
    label: row.name,
    sub: phoneLine(row.phone),
    group,
    leading: { kind: 'none' },
  });

  const supplierOptions = (makerId?: string | null): PickerOption[] => {
    const rows = withAdded<PartnerEntry>(suppliers, added.suppliers);
    const maker = makerId ? makers.find((row) => row.id === makerId) : undefined;
    if (!maker) return rows.map((row) => partnerOption(row));
    const distributes = (row: PartnerEntry) => row.manufacturerIds.includes(maker.id);
    const ours = t(K.pickers.distributes, { maker: maker.name });
    const others = t(K.pickers.otherSuppliers);
    return [
      ...rows.filter(distributes).map((row) => partnerOption(row, ours)),
      ...rows.filter((row) => !distributes(row)).map((row) => partnerOption(row, others)),
    ];
  };

  return {
    manufacturers: withAdded<MakerEntry>(makers, added.manufacturers).map((maker) => ({
      key: maker.id,
      label: maker.name,
      sub: t(K.pickers.medicineCount, { count: maker.medicineCount }),
      tone: maker.tone,
      leading: { kind: 'pill' },
    })),
    suppliers: supplierOptions,
    mrs: withAdded<PartnerEntry>(reps, added.mrs).map((rep) => partnerOption(rep)),
    addManufacturer: async (name) => {
      const maker = await quickMaker.mutateAsync(name);
      listMaker(maker);
      return maker.id;
    },
    addSupplier: async (name, manufacturerIds = []) => {
      const supplier = await quickSupplier.mutateAsync({ name, manufacturerIds });
      listPartner('suppliers', supplier);
      return supplier.id;
    },
    addMr: async (name) => {
      const rep = await quickMr.mutateAsync(name);
      listPartner('mrs', rep);
      return rep.id;
    },
    remember: {
      manufacturer: listMaker,
      supplier: (supplier) => listPartner('suppliers', supplier),
      mr: (rep) => listPartner('mrs', rep),
    },
  };
}
