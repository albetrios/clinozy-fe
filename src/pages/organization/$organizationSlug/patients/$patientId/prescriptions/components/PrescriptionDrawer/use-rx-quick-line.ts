import { useMemo } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type {
  RxCatalog,
  RxCatalogMedicine,
} from '@/shared/api/app/prescriptions-contracts.ts';
import {
  nameNumbers,
  type QuickLineItem,
  type QuickLineProps,
} from '@/shared/components/QuickLine/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import {
  RX_PLACES,
  rxCountOf,
  rxDoseValue,
  rxFormLineOf,
  type RxFormValues,
  rxLineFor,
  steppedRxLines,
  withRxLine,
} from './rx-form.ts';
import {
  browseRxMedicines,
  matchRxMedicines,
  parseRxLine,
  type RxBrowseGroup,
  type RxLineValues,
  typedRxName,
} from './rx-quick-line.ts';
import { useRxLabels } from './use-rx-labels.ts';

const K = RX_KEYS;

/**
 * Browse's groups (H:3797): All · Oral · Topical — the clinic's "Often prescribed" has no read
 * (G4).
 */
const GROUPS: readonly RxBrowseGroup[] = ['all', 'oral', 'topical'];

/** A name typed without the store's medicine behind it. */
const typedMedicine = (name: string): RxCatalogMedicine => ({
  name,
  medicineId: null,
  composition: null,
  stock: null,
  form: 'oral',
  last: null,
});

/** The pills a typed line shows, in the drawer's words — the quick line's and the Pad's. */
export function useRxLineTags() {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  return (values: RxLineValues) => {
    const place = RX_PLACES.find((candidate) => candidate.bodyPart === values.where);
    let when: string | undefined;
    if (values.when) {
      when = labels.when(
        values.when.kind === 'meal' ? values.when.meal : values.when.timing,
      );
    }
    return [
      values.dose ? labels.dose(rxDoseValue(values.dose)) : undefined,
      when,
      place ? labels.where(place.key) : undefined,
      values.days ? t(K.daysNote, { count: values.days }) : undefined,
      values.qty ? t(K.quick.qty, { qty: values.qty }) : undefined,
    ].filter((tag): tag is string => Boolean(tag));
  };
}

/**
 * The Rx quick line's grammar and catalogue (KICKOFF §6.6 step 2; H:4806):
 * the `__czRxMods` parser, the medicines matched and browsed with the
 * patient's last dosage and the store's stock, the parsed pills, and every
 * add writing the form's lines — a pick fills the first blank row ("Flubolt
 * 400 added"). No MRP until the rupee formatter (F10); no "Often prescribed"
 * (G4).
 */
export function useRxQuickLine(
  form: UseFormReturn<RxFormValues>,
  catalog: RxCatalog | undefined,
  items: RxFormValues['items'],
): QuickLineProps<RxCatalogMedicine, RxLineValues> {
  const { t } = useTranslation(RX_NS);
  const labels = useRxLabels();
  const tags = useRxLineTags();
  const medicines = useMemo(() => catalog?.medicines ?? [], [catalog]);
  const numbers = useMemo(
    () => nameNumbers(medicines.map((medicine) => medicine.name)),
    [medicines],
  );
  const toItem = (medicine: RxCatalogMedicine): QuickLineItem<RxCatalogMedicine> => {
    const dosage = medicine.last
      ? labels.directions(rxFormLineOf(medicine.last, labels.dayWords)) ||
        t(K.quick.lastSaved)
      : t(K.quick.noDosage);
    let stock: string | undefined;
    if (medicine.stock !== null) {
      stock =
        medicine.stock > 0
          ? t(K.quick.inStock, { count: medicine.stock })
          : t(K.quick.outOfStock);
    }
    return {
      key: medicine.name,
      label: medicine.name,
      sub: [dosage, stock].filter(Boolean).join(' · '),
      data: medicine,
    };
  };

  const setItems = (next: RxFormValues['items']) =>
    form.setValue('items', next, { shouldDirty: true });
  const add = (medicine: RxCatalogMedicine, values: RxLineValues) => {
    setItems(withRxLine(form.getValues('items'), rxLineFor(medicine, values)));
    notify.success(t(K.quick.added, { name: medicine.name }));
  };

  return {
    placeholder: t(K.quick.placeholder),
    hint: t(K.quick.hint),
    parse: (text) => {
      const { words, values } = parseRxLine(text, numbers);
      return { words, values, tags: tags(values) };
    },
    matches: (words) => matchRxMedicines(medicines, words).map(toItem),
    typedName: (words) => typedRxName(medicines, words),
    onPick: add,
    onCreate: (name, values) => add(typedMedicine(name), values),
    browse: {
      groups: GROUPS.map((id) => ({ id, label: t(K.quick.groups[id]) })),
      tiles: (group, words) =>
        browseRxMedicines(medicines, group as RxBrowseGroup, words).map(toItem),
      count: (item) => rxCountOf(items, item.data.name),
      added: medicines.filter((medicine) => rxCountOf(items, medicine.name) > 0).length,
      onStep: (item, step) =>
        setItems(steppedRxLines(form.getValues('items'), item.data, step)),
      newItem: {
        placeholder: t(K.quick.newMedicine),
        onAdd: (name) => add(typedMedicine(name), {}),
      },
    },
    testId: 'rx-quick-line',
  };
}
