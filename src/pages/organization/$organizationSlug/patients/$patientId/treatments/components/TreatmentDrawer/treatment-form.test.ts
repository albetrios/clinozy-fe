import { describe, expect, it } from 'vitest';

import type { Treatment } from '@/shared/api/clinic/clinic-schema.ts';

import {
  newTreatmentForm,
  nextSessionForm,
  rememberTemplate,
  startingTemplate,
  storedTeeth,
  teethOf,
  templateTone,
  treatmentFormOf,
  treatmentInputOf,
  withTemplate,
} from './treatment-form.ts';

const CONTEXT = {
  patientId: 'p',
  appointmentId: null,
  performedAt: '2026-10-03T06:30:00.000Z',
  fallbackName: 'Treatment',
};

function treatment(fields: Partial<Treatment> = {}): Treatment {
  return {
    name: 'LHR Full Face',
    template: 'skin',
    sessionNo: 1,
    bodyParts: ['face'],
    params: {
      type: 'Laser',
      skinType: 'Type IV',
      machine: 'Soprano Ice',
      wavelength: '810',
    },
    doctorId: 'dr',
    therapistId: 'th',
    offeringId: 'of',
    packageId: 'pk',
    remark: 'Mild redness',
    aftercareCall: 'in_2_days',
    ...fields,
  } as Treatment;
}

describe('the treatment form', () => {
  it('starts a new treatment on session 1 with the next-day call', () => {
    expect(
      newTreatmentForm('dental', { doctorId: 'dr', therapistId: null }),
    ).toMatchObject({
      template: 'dental',
      sessionNo: 1,
      doctorId: 'dr',
      therapistId: null,
      aftercareCall: 'next_day',
    });
  });

  it('continues the last treatment: its name, areas and the next session (H:4811)', () => {
    const staff = { doctorId: 'dr2', therapistId: null };
    expect(newTreatmentForm('skin', staff, treatment({ sessionNo: 3 }))).toMatchObject({
      template: 'skin',
      name: 'LHR Full Face',
      offeringId: 'of',
      packageId: null,
      areas: ['face'],
      params: {},
      sessionNo: 4,
      doctorId: 'dr2',
    });
    // Another template keeps the name and session, not the areas.
    expect(newTreatmentForm('physio', staff, treatment())).toMatchObject({
      template: 'physio',
      name: 'LHR Full Face',
      areas: [],
      sessionNo: 2,
    });
  });

  it('opens a saved treatment with its chips from its body parts', () => {
    expect(treatmentFormOf(treatment())).toMatchObject({
      areas: ['face'],
      params: {
        type: 'Laser',
        skinType: 'Type IV',
        machine: 'Soprano Ice',
        wavelength: '810',
      },
      remark: 'Mild redness',
    });
  });

  it('keeps the exact area chips through a save', () => {
    const values = {
      ...newTreatmentForm('skin', { doctorId: null, therapistId: null }),
      name: 'Upper lip LHR',
      areas: ['upperLip', 'chin', 'underarm'],
    };
    const input = treatmentInputOf(values, CONTEXT);
    expect(input.bodyParts).toEqual(['face', 'underarm']);
    expect(input.params.areas).toBe('Upper lip, Chin, Underarm');
    expect(treatmentFormOf(treatment({ ...input, params: input.params })).areas).toEqual([
      'upperLip',
      'chin',
      'underarm',
    ]);
  });

  it('clears the areas and fields when the template switches', () => {
    const values = { ...treatmentFormOf(treatment()), name: 'Peel' };
    expect(withTemplate(values, 'dental')).toMatchObject({
      template: 'dental',
      name: 'Peel',
      areas: [],
      params: {},
    });
  });

  it('saves a blank name as “Treatment” and drops blank fields (A-F11)', () => {
    const values = {
      ...newTreatmentForm('general', { doctorId: null, therapistId: null }),
      params: { area: '  ', parameters: 'Dose: 2 ml' },
    };
    expect(treatmentInputOf(values, CONTEXT)).toMatchObject({
      name: 'Treatment',
      params: { parameters: 'Dose: 2 ml' },
      bodyParts: [],
      remark: null,
    });
  });

  it('fills the next session of the last treatment', () => {
    const current = newTreatmentForm('dental', { doctorId: null, therapistId: null });
    expect(nextSessionForm(treatment({ sessionNo: 2 }), current)).toMatchObject({
      template: 'skin',
      name: 'LHR Full Face',
      sessionNo: 3,
      packageId: 'pk',
      doctorId: 'dr',
      therapistId: 'th',
      areas: ['face'],
    });
  });

  it('stores teeth as their FDI codes back to back', () => {
    expect(storedTeeth([21, 18, 11])).toBe('111821');
    expect(teethOf('111821')).toEqual([11, 18, 21]);
    expect(teethOf(undefined)).toEqual([]);
    const all = [
      11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35,
      36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
    ];
    expect(storedTeeth(all).length).toBeLessThanOrEqual(80);
  });

  it('starts from the patient’s last template, else the one saved last', () => {
    expect(startingTemplate(treatment({ template: 'physio' }))).toBe('physio');
    rememberTemplate('gynac');
    expect(startingTemplate(undefined)).toBe('gynac');
  });

  it('gives each template its tone', () => {
    expect(templateTone('skin')).toBe('lav');
    expect(templateTone('general')).toBe('stone');
  });
});
