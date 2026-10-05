import { describe, expect, it } from 'vitest';

import {
  organizationLead,
  organizationLeadCreate,
  organizationLeads,
} from './leads-builders.ts';

describe('the Leads room builders', () => {
  it('build the Leads room and its dialog routes (S:22–25)', () => {
    expect(organizationLeads('acme')).toEqual({
      to: '/organization/$organizationSlug/leads',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationLead('acme', 'L1')).toEqual({
      to: '/organization/$organizationSlug/leads/$leadId',
      params: { organizationSlug: 'acme', leadId: 'L1' },
    });
    expect(organizationLeadCreate('acme')).toEqual({
      to: '/organization/$organizationSlug/leads/create',
      params: { organizationSlug: 'acme' },
    });
  });
});
