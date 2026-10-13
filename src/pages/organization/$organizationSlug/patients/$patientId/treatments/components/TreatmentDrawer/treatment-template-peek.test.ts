import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { newTreatmentForm, type TreatmentFormValues } from './treatment-form.ts';
import { treatmentDetailsView } from './treatment-template-peek.ts';

/** Echoes the key (and its options), so the tiles read as their copy keys. */
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}(${Object.values(options).join(',')})` : key) as unknown as TFunction;
const formatDay = (day: string) => `day:${day}`;

function form(
  template: TreatmentFormValues['template'],
  fields: Partial<TreatmentFormValues> = {},
): TreatmentFormValues {
  return {
    ...newTreatmentForm(template, { doctorId: null, therapistId: null }),
    ...fields,
  };
}

describe('treatmentDetailsView (H:3832–3840)', () => {
  it('peeks Skin · laser: chip labels, the areas as pills, Empty elsewhere', () => {
    const view = treatmentDetailsView(
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
    expect(view.peek).toHaveLength(8);
    expect(view.peek[0]).toEqual({
      kind: 'value',
      label: 'treatment.skin.therapyType',
      value: 'treatment.skin.therapyTypes.laser',
    });
    expect(view.peek[1]).toEqual({
      kind: 'multi',
      label: 'treatment.skin.bodyPart',
      values: [
        { label: 'treatment.skin.areas.face' },
        { label: 'treatment.skin.areas.chin' },
      ],
    });
    expect(view.peek[2]).toMatchObject({ value: 'treatment.skin.skinTypeValue(IV)' });
    expect(view.peek[3]).toMatchObject({
      label: 'treatment.skin.machine',
      value: undefined,
    });
    expect(view.filled).toEqual([
      'treatment.skin.therapyTypes.laser',
      'treatment.skin.areas.face, treatment.skin.areas.chin',
      'treatment.skin.skinTypeValue(IV)',
      '810',
    ]);
  });

  it('keeps a stored value the chips no longer list', () => {
    const view = treatmentDetailsView(
      form('skin', { parameters: { type: 'Cryo' } }),
      t,
      formatDay,
    );
    expect(view.peek[0]).toMatchObject({ value: 'Cryo' });
  });

  it('peeks Dental: the procedure, the teeth and the anaesthesia', () => {
    const given = treatmentDetailsView(
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
    expect(given.filled).toEqual([
      'treatment.dental.procedures.rct',
      '18, 11',
      'Composite',
      'treatment.dental.given',
    ]);
    const none = treatmentDetailsView(form('dental'), t, formatDay);
    expect(none.filled).toEqual([]);
  });

  it('peeks Physio and Gynac with their units and dates', () => {
    const physio = treatmentDetailsView(
      form('physio', {
        areas: ['back'],
        parameters: { modality: 'TENS', painBefore: '7' },
      }),
      t,
      formatDay,
    );
    expect(physio.filled).toEqual([
      'treatment.physio.regions.back',
      'treatment.physio.modalities.tens',
      '7',
    ]);
    const gynac = treatmentDetailsView(
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
    expect(gynac.filled).toEqual([
      'treatment.gynac.visitTypes.anc',
      'day:2026-07-01',
      '12 treatment.gynac.weeks',
    ]);
  });

  it('peeks General: the area and the parameters', () => {
    const view = treatmentDetailsView(
      form('general', { parameters: { area: 'Scalp', parameters: 'Dose: 2 ml' } }),
      t,
      formatDay,
    );
    expect(view.peek.map((tile) => tile.label)).toEqual([
      'treatment.general.area',
      'treatment.general.parameters',
    ]);
    expect(view.filled).toEqual(['Scalp', 'Dose: 2 ml']);
  });
});
