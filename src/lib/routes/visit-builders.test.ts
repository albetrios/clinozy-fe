import { describe, expect, it } from 'vitest';

import { organizationVisit } from './visit-builders.ts';

describe('organizationVisit', () => {
  it('builds the Visit sheet’s route with the slug and the visit', () => {
    expect(organizationVisit('acme', 'v1')).toEqual({
      to: '/organization/$organizationSlug/visits/$visitId',
      params: { organizationSlug: 'acme', visitId: 'v1' },
    });
  });
});
