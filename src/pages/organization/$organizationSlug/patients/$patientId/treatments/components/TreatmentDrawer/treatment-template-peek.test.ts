import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import type { DrawerPeekItem } from '@/shared/components/DrawerSteps/index.ts';

import { newTreatmentForm, type TreatmentFormValues } from './treatment-form.ts';
import { treatmentDetailsPeek } from './treatment-template-peek.ts';

/** Echoes the key (and its options), so the tiles read as their copy keys. */
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}(${Object.values(options).join(',')})` : key) as unknown as TFunction;
const formatDay = (day: string) => `day:${day}`;

/** Each tile as it reads: its value, or its pills joined; `undefined` while unset. */
function tileTexts(peek: readonly DrawerPeekItem[]): (string | undefined)[] {
  return peek.map((tile) => {
    if (tile.kind === 'value') return tile.value;
    if (tile.kind === 'multi') return tile.values.map((pill) => pill.label).join(', ');
    return tile.names.join(', ');
  });
}

function form(
  template: TreatmentFormValues['template'],
  fields: Partial<TreatmentFormValues> = {},
): TreatmentFormValues {
  return {
    ...newTreatmentForm(template, { doctorId: null, therapistId: null }),
    ...fields,
  };
}

describe('treatmentDetailsPeek (H:3832–3834)', () => {
  it('peeks Skin · laser: chip labels, the areas as pills, no value elsewhere', () => {
    const peek = treatmentDetailsPeek(
      form('skin', {
        areas: ['face', 'chin', 'unknown'],
        parameters: {
          type: 'Laser',
          skinType: 'Type IV',
          wavelength: '810',
          machine: ' ',
        },
      }),
      t,
      formatDay,
    );
    expect(peek).toHaveLength(8);
    expect(peek[0]).toEqual({
      kind: 'value',
      label: 'treatment.skin.therapyType',
      value: 'treatment.skin.therapyTypes.laser',
    });
    expect(peek[1]).toEqual({
      kind: 'multi',
      label: 'treatment.skin.bodyPart',
      values: [
        { label: 'treatment.skin.areas.face' },
        { label: 'treatment.skin.areas.chin' },
      ],
    });
    expect(peek[2]).toMatchObject({ value: 'treatment.skin.skinTypeValue(IV)' });
    expect(peek[3]).toMatchObject({
      label: 'treatment.skin.machine',
      value: undefined,
    });
    expect(tileTexts(peek)).toEqual([
      'treatment.skin.therapyTypes.laser',
      'treatment.skin.areas.face, treatment.skin.areas.chin',
      'treatment.skin.skinTypeValue(IV)',
      undefined,
      '810',
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('keeps a stored value the chips no longer list', () => {
    const peek = treatmentDetailsPeek(
      form('skin', { parameters: { type: 'Cryo' } }),
      t,
      formatDay,
    );
    expect(peek[0]).toMatchObject({ value: 'Cryo' });
  });

  it('peeks Dental: the procedure, the teeth and the anaesthesia', () => {
    const given = treatmentDetailsPeek(
      form('dental', {
        parameters: {
          procedure: 'RCT',
          teeth: '1811',
          anaesthesia: 'Given',
          material: 'Composite',
        },
      }),
      t,
      formatDay,
    );
    expect(tileTexts(given)).toEqual([
      'treatment.dental.procedures.rct',
      '18, 11',
      'Composite',
      'treatment.dental.given',
    ]);
    const none = treatmentDetailsPeek(form('dental'), t, formatDay);
    expect(tileTexts(none)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('peeks Physio and Gynac with their units and dates', () => {
    const physio = treatmentDetailsPeek(
      form('physio', {
        areas: ['back'],
        parameters: { modality: 'TENS', painBefore: '7' },
      }),
      t,
      formatDay,
    );
    expect(tileTexts(physio)).toEqual([
      'treatment.physio.regions.back',
      'treatment.physio.modalities.tens',
      '7',
      undefined,
      undefined,
    ]);
    const gynac = treatmentDetailsPeek(
      form('gynac', {
        parameters: {
          visitType: 'ANC',
          lmp: '2026-07-01',
          gestationWeeks: '12',
          weightKg: '0',
        },
      }),
      t,
      formatDay,
    );
    // A zero weight is unset, like an empty one.
    expect(tileTexts(gynac)).toEqual([
      'treatment.gynac.visitTypes.anc',
      'day:2026-07-01',
      '12 treatment.gynac.weeks',
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('peeks General: the area and the parameters', () => {
    const peek = treatmentDetailsPeek(
      form('general', { parameters: { area: 'Scalp', parameters: 'Dose: 2 ml' } }),
      t,
      formatDay,
    );
    expect(peek.map((tile) => tile.label)).toEqual([
      'treatment.general.area',
      'treatment.general.parameters',
    ]);
    expect(tileTexts(peek)).toEqual(['Scalp', 'Dose: 2 ml']);
  });
});
