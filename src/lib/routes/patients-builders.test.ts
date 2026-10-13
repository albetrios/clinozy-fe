import { describe, expect, it } from 'vitest';

import { organizationPatientCreate, organizationPatients } from './patients-builders.ts';

describe('the Patients room builders', () => {
  it('build the Patients room and its New patient dialog route (S:30–31)', () => {
    expect(organizationPatients('acme')).toEqual({
      to: '/organization/$organizationSlug/patients',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationPatientCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/patients/create',
      params: { organizationSlug: 'acme' },
    });
  });
});
