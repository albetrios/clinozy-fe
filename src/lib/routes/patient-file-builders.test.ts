import { describe, expect, it } from 'vitest';

import {
  organizationPatient,
  organizationPatientEdit,
  organizationPatientSection,
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
});
