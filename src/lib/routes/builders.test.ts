import { describe, expect, it } from 'vitest';

import {
  organizationDashboard,
  organizationHome,
  organizationPicker,
  organizationSuspended,
} from './builders.ts';
import * as barrel from './index.ts';

describe('route builders', () => {
  it('return {to, params} objects consumable by typed Link/navigate', () => {
    expect(organizationPicker()).toEqual({ to: '/organization' });
    expect(organizationHome('acme')).toEqual({
      to: '/organization/$organizationSlug',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationDashboard('acme')).toEqual({
      to: '/organization/$organizationSlug/dashboard',
      params: { organizationSlug: 'acme' },
    });
    expect(organizationSuspended('acme')).toEqual({
      to: '/organization/$organizationSlug/suspended',
      params: { organizationSlug: 'acme' },
    });
  });

  it('keeps the barrel to the organization-level builders — the entry chunk imports it', () => {
    // A room's builders are imported by path (`leads-builders.ts`, …): through
    // this barrel they would ride every first paint again.
    expect(Object.keys(barrel).sort()).toEqual([
      'organizationDashboard',
      'organizationHome',
      'organizationPicker',
      'organizationSuspended',
    ]);
  });
});
