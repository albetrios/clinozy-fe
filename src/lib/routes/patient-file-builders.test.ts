import { describe, expect, it } from 'vitest';

import {
  organizationCheckInCreate,
  organizationCheckInEdit,
  organizationPatient,
  organizationPatientEdit,
  organizationPatientPhoto,
  organizationPatientPhotoEdit,
  organizationPatientSection,
  organizationPrescription,
  organizationPrescriptionEdit,
  organizationReport,
  organizationReviewCreate,
  organizationReviewEdit,
  organizationTreatmentEdit,
} from './patient-file-builders.ts';

const PARAMS = { organizationSlug: 'acme', patientId: 'P1' };

describe('patient-file route builders (KICKOFF §6.6)', () => {
  it('build the file, which lands on its default section', () => {
    expect(organizationPatient('acme', 'P1')).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId',
      params: PARAMS,
    });
  });

  it('build each section as its literal folder (D26)', () => {
    expect(organizationPatientSection('acme', 'P1', 'prescriptions')).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/prescriptions',
      params: PARAMS,
    });
    expect(organizationPatientSection('acme', 'P1', 'timeline').to).toBe(
      '/organization/$organizationSlug/patients/$patientId/timeline',
    );
  });

  it('build Edit patient over the file (S:34)', () => {
    expect(organizationPatientEdit('acme', 'P1')).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/edit',
      params: PARAMS,
    });
  });

  it('build the photo viewer and Photo details over the Photos section (S:41–42)', () => {
    expect(organizationPatientPhoto('acme', 'P1', 'I1')).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/images/$imageId',
      params: { ...PARAMS, imageId: 'I1' },
    });
    expect(organizationPatientPhotoEdit('acme', 'P1', 'I1').to).toBe(
      '/organization/$organizationSlug/patients/$patientId/images/$imageId/edit',
    );
  });

  it('build the check-in and review drawers over the file (S:44–47)', () => {
    expect(organizationCheckInCreate('acme', 'P1')).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/check-ins/create',
      params: PARAMS,
    });
    expect(organizationCheckInEdit('acme', 'P1', 'C1')).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/check-ins/$checkInId/edit',
      params: { ...PARAMS, checkInId: 'C1' },
    });
    expect(organizationReviewCreate('acme', 'P1').to).toBe(
      '/organization/$organizationSlug/patients/$patientId/reviews/create',
    );
    expect(organizationReviewEdit('acme', 'P1', 'R1')).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/reviews/$reviewId/edit',
      params: { ...PARAMS, reviewId: 'R1' },
    });
  });

  it('build the record dialogs over Prescriptions, Treatments and Reports (S:36–43)', () => {
    expect(organizationPrescription('acme', 'P1', 'X1')).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/prescriptions/$prescriptionId',
      params: { ...PARAMS, prescriptionId: 'X1' },
    });
    expect(organizationPrescriptionEdit('acme', 'P1', 'X1').to).toBe(
      '/organization/$organizationSlug/patients/$patientId/prescriptions/$prescriptionId/edit',
    );
    expect(organizationTreatmentEdit('acme', 'P1', 'T1')).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/treatments/$treatmentId/edit',
      params: { ...PARAMS, treatmentId: 'T1' },
    });
    expect(organizationReport('acme', 'P1', 'R1')).toEqual({
      to: '/organization/$organizationSlug/patients/$patientId/reports/$reportId',
      params: { ...PARAMS, reportId: 'R1' },
    });
  });
});
