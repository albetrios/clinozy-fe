import { describe, expect, it } from 'vitest';

import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-contracts.ts';

import {
  patientPackage,
  treatmentRecord,
} from '../../__tests__/integration/treatment-doubles.ts';
import {
  canSpendSession,
  newTreatmentForm,
  nextSessionForm,
  onPackageForm,
  rememberTemplate,
  startingTemplate,
  storedTeeth,
  teethOf,
  templateTone,
  treatmentFieldsOf,
  treatmentFormOf,
  withTemplate,
} from './treatment-form.ts';

const LHR = treatmentRecord({
  bodyParts: ['face'],
  parameters: {
    type: 'Laser',
    skinType: 'Type IV',
    machine: 'Soprano Ice',
    wavelength: '810',
  },
  doctorId: 'mem_dr',
  therapistId: 'mem_th',
  offeringId: 'off_lhr',
  packageId: 'poff_lhr',
  remark: 'Mild redness',
  aftercareCall: 'in_two_days',
});

describe('the treatment form', () => {
  it('starts a new treatment on session 1 with the next-day call', () => {
    expect(
      newTreatmentForm('dental', { doctorId: 'mem_dr', therapistId: null }),
    ).toMatchObject({
      template: 'dental',
      sessionNumber: 1,
      doctorId: 'mem_dr',
      therapistId: null,
      packageId: null,
      aftercareCall: 'next_day',
    });
  });

  it('continues the last treatment: its name, areas and the next session (H:4811)', () => {
    const staff = { doctorId: 'mem_other', therapistId: null };
    expect(newTreatmentForm('skin', staff, { ...LHR, sessionNumber: 3 })).toMatchObject({
      template: 'skin',
      name: 'LHR Full Face',
      offeringId: 'off_lhr',
      packageId: null,
      areas: ['face'],
      parameters: {},
      sessionNumber: 4,
      doctorId: 'mem_other',
    });
    // Another template keeps the name and session, not the areas.
    expect(newTreatmentForm('physio', staff, LHR)).toMatchObject({
      template: 'physio',
      name: 'LHR Full Face',
      areas: [],
      sessionNumber: 2,
    });
  });

  it('opens a saved treatment with its chips from its body parts', () => {
    expect(treatmentFormOf(LHR)).toMatchObject({
      areas: ['face'],
      parameters: {
        type: 'Laser',
        skinType: 'Type IV',
        machine: 'Soprano Ice',
        wavelength: '810',
      },
      packageId: 'poff_lhr',
      remark: 'Mild redness',
      aftercareCall: 'in_two_days',
    });
  });

  it('maps the area chips onto the API’s body parts and keeps their exact list', () => {
    const values = {
      ...newTreatmentForm('skin', { doctorId: null, therapistId: null }),
      name: 'Upper lip LHR',
      areas: ['upperLip', 'chin', 'underarm', 'fullBody'],
    };
    const fields = treatmentFieldsOf(values, 'Treatment');
    expect(fields.bodyParts).toEqual(['upper_lip', 'chin', 'underarm', 'full_body']);
    expect(fields.parameters.areas).toBe('Upper lip, Chin, Underarm, Full body');
    expect(
      treatmentFormOf(treatmentRecord({ ...fields, parameters: fields.parameters }))
        .areas,
    ).toEqual(['upperLip', 'chin', 'underarm', 'fullBody']);
  });

  it('names Physio’s neck and back as body parts, the joints only in the list', () => {
    const values = {
      ...newTreatmentForm('physio', { doctorId: null, therapistId: null }),
      areas: ['neck', 'knee', 'back'],
    };
    const fields = treatmentFieldsOf(values, 'Treatment');
    expect(fields.bodyParts).toEqual(['neck', 'back']);
    expect(fields.parameters.areas).toBe('Neck, Back, Knee');
  });

  it('clears the areas and fields when the template switches', () => {
    const values = { ...treatmentFormOf(LHR), name: 'Peel' };
    expect(withTemplate(values, 'dental')).toMatchObject({
      template: 'dental',
      name: 'Peel',
      areas: [],
      parameters: {},
    });
  });

  it('saves a blank name as “Treatment” and drops blank fields (A-F11)', () => {
    const values = {
      ...newTreatmentForm('general', { doctorId: null, therapistId: null }),
      parameters: { area: '  ', parameters: 'Dose: 2 ml' },
    };
    expect(treatmentFieldsOf(values, 'Treatment')).toMatchObject({
      name: 'Treatment',
      parameters: { parameters: 'Dose: 2 ml' },
      bodyParts: [],
      remark: null,
    });
  });

  it('fills the next session of the last treatment, on its package while it has a session', () => {
    const current = newTreatmentForm('dental', { doctorId: null, therapistId: null });
    const last = { ...LHR, sessionNumber: 2 };
    const open = patientPackage({ id: 'poff_lhr' });
    expect(nextSessionForm(last, current, [open])).toMatchObject({
      template: 'skin',
      name: 'LHR Full Face',
      sessionNumber: 3,
      packageId: 'poff_lhr',
      doctorId: 'mem_dr',
      therapistId: 'mem_th',
      areas: ['face'],
    });
    const usedUp = patientPackage({ id: 'poff_lhr', status: 'used_up', sessionsLeft: 0 });
    expect(nextSessionForm(last, current, [usedUp]).packageId).toBeNull();
  });

  it('puts a session on a package: its name, offering and id (the server numbers it)', () => {
    const current = newTreatmentForm('skin', { doctorId: null, therapistId: null });
    const row = patientPackage();
    expect(onPackageForm(current, row)).toMatchObject({
      name: row.name,
      offeringId: row.offeringId,
      packageId: row.id,
    });
  });

  it('spends only an active package with a session left — the server’s counts', () => {
    const rows: PatientPackageRow[] = [
      patientPackage({ id: 'a' }),
      patientPackage({ id: 'b', status: 'used_up', sessionsLeft: 0 }),
      patientPackage({ id: 'c', status: 'expired' }),
    ];
    expect(rows.filter(canSpendSession).map((row) => row.id)).toEqual(['a']);
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
    expect(startingTemplate({ ...LHR, template: 'physio' })).toBe('physio');
    rememberTemplate('gynac');
    expect(startingTemplate(undefined)).toBe('gynac');
  });

  it('gives each template its tone', () => {
    expect(templateTone('skin')).toBe('lav');
    expect(templateTone('general')).toBe('stone');
  });
});
