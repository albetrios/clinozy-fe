import type { TFunction } from 'i18next';

import type {
  DrawerPeekItem,
  DrawerPeekPill,
} from '@/shared/components/DrawerSteps/index.ts';

import { TREATMENT_KEYS } from '../../treatments.constants.ts';
import {
  ANAESTHESIA,
  DENTAL_PROCEDURES,
  GYNAC_VISIT_TYPES,
  PHYSIO_MODALITIES,
  PHYSIO_REGIONS,
  SKIN_AREAS,
  SKIN_THERAPY_TYPES,
  SKIN_TYPES,
  teethOf,
  type TemplateOption,
  type TreatmentFormValues,
} from './treatment-form.ts';

const K = TREATMENT_KEYS;

/** A stored chip value as the chip reads it; a value the list lacks stays as stored. */
function chipLabel(
  options: readonly TemplateOption[],
  value: string | undefined,
  label: (key: string) => string,
): string | undefined {
  if (!value) return undefined;
  const option = options.find((entry) => entry.value === value);
  return option ? label(option.key) : value;
}

/** The picked areas as pills. */
function areaPills(
  keys: readonly string[],
  options: readonly TemplateOption[],
  label: (key: string) => string,
): DrawerPeekPill[] {
  return keys
    .filter((key) => options.some((option) => option.key === key))
    .map((key) => ({ label: label(key) }));
}

/** A number param with its unit ("24 weeks"); none while unset or zero. */
function withUnit(value: string | undefined, unit: string): string | undefined {
  return value && Number(value) > 0 ? `${value} ${unit}` : undefined;
}

/** Each template's tiles, in the order its fields show. */
function templateTiles(
  values: TreatmentFormValues,
  t: TFunction,
  formatDay: (civilDate: string) => string,
): DrawerPeekItem[] {
  const p = values.params;
  const value = (label: string, text: string | undefined): DrawerPeekItem => ({
    kind: 'value',
    label,
    value: text?.trim() || undefined, // NOSONAR(S6606): a blank value is unset — "" falls back
  });
  switch (values.template) {
    case 'skin':
      return [
        value(
          t(K.skin.therapyType),
          chipLabel(SKIN_THERAPY_TYPES, p.type, (key) =>
            t(K.skin.therapyTypes[key as keyof typeof K.skin.therapyTypes]),
          ),
        ),
        {
          kind: 'multi',
          label: t(K.skin.bodyPart),
          values: areaPills(values.areas, SKIN_AREAS, (key) =>
            t(K.skin.areas[key as keyof typeof K.skin.areas]),
          ),
        },
        value(
          t(K.skin.skinType),
          chipLabel(SKIN_TYPES, p.skinType, (key) =>
            t(K.skin.skinTypeValue, { type: key }),
          ),
        ),
        value(t(K.skin.machine), p.machine),
        value(t(K.skin.wavelength), p.wavelength),
        value(t(K.skin.startReading), p.startReading),
        value(t(K.skin.endReading), p.endReading),
        value(t(K.skin.power), p.power),
      ];
    case 'dental':
      return [
        value(
          t(K.dental.procedure),
          chipLabel(DENTAL_PROCEDURES, p.procedure, (key) =>
            t(K.dental.procedures[key as keyof typeof K.dental.procedures]),
          ),
        ),
        value(t(K.dental.teeth), teethOf(p.teeth).join(', ')),
        value(t(K.dental.material), p.material),
        value(
          t(K.dental.anaesthesia),
          p.anaesthesia === ANAESTHESIA.given ? t(K.dental.given) : undefined,
        ),
      ];
    case 'physio':
      return [
        {
          kind: 'multi',
          label: t(K.physio.region),
          values: areaPills(values.areas, PHYSIO_REGIONS, (key) =>
            t(K.physio.regions[key as keyof typeof K.physio.regions]),
          ),
        },
        value(
          t(K.physio.modality),
          chipLabel(PHYSIO_MODALITIES, p.modality, (key) =>
            t(K.physio.modalities[key as keyof typeof K.physio.modalities]),
          ),
        ),
        value(t(K.physio.painBefore), p.painBefore),
        value(t(K.physio.painAfter), p.painAfter),
        value(t(K.physio.exercises), p.exercises),
      ];
    case 'gynac':
      return [
        value(
          t(K.gynac.visitType),
          chipLabel(GYNAC_VISIT_TYPES, p.visitType, (key) =>
            t(K.gynac.visitTypes[key as keyof typeof K.gynac.visitTypes]),
          ),
        ),
        value(t(K.gynac.lmp), p.lmp ? formatDay(p.lmp) : undefined),
        value(t(K.gynac.gestation), withUnit(p.gestationWeeks, t(K.gynac.weeks))),
        value(t(K.gynac.bp), p.bp),
        value(t(K.gynac.weight), withUnit(p.weightKg, t(K.gynac.kg))),
        value(t(K.gynac.findings), p.findings),
      ];
    default:
      return [
        value(t(K.general.area), p.area),
        value(t(K.general.parameters), p.parameters),
      ];
  }
}

/**
 * Step 2's peek and head line (H:3832–3840): the template's fields as tiles —
 * a chip's label, the areas as pills, "Empty" where nothing is set — and the
 * first four filled values for the open card's sub line.
 */
export function treatmentDetailsView(
  values: TreatmentFormValues,
  t: TFunction,
  formatDay: (civilDate: string) => string,
): { peek: DrawerPeekItem[]; filled: string[] } {
  const peek = templateTiles(values, t, formatDay);
  const filled = peek.flatMap((tile) => {
    if (tile.kind === 'multi')
      return tile.values.length ? [tile.values.map((pill) => pill.label).join(', ')] : [];
    if (tile.kind === 'value' && tile.value) return [tile.value];
    return [];
  });
  return { peek, filled };
}
