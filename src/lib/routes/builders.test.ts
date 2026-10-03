import { describe, expect, it } from 'vitest';

import {
  organizationDashboard,
  organizationLead,
  organizationLeadCreate,
  organizationLeads,
  organizationPicker,
  organizationSuspended,
} from './builders.ts';

describe('route builders', () => {
  it('return {to, params} objects consumable by typed Link/navigate', () => {
    expect(organizationPicker()).toEqual({ to: '/organization' });
    expect(organizationDashboard('acme')).toEqual({
      to: '/organization/$organizationSlug/dashboard',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationSuspended('acme')).toEqual({
      to: '/organization/$organizationSlug/suspended',
      params: { organizationSlug: 'acme' },
    });
  });

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
