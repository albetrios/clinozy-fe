import { describe, expect, it } from 'vitest';

import {
  organizationDashboard,
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
});
