import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DEPLOYMENT_FLAGS,
  parseDeploymentFlagsFromUserWire,
  resolveDeploymentMode,
} from './deployment-mode.ts';

const BASE_USER = {
  id: 'usr_abcdefghij0123456789x',
  email: 'a@b.test',
  is_email_verified: true,
  is_mfa_enabled: false,
  first_name: 'A',
  last_name: null,
  avatar_url: null,
  status: 'ACTIVE' as const,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('parseDeploymentFlagsFromUserWire', () => {
  it('reads nested user.capabilities (Phase 0 wire)', () => {
    expect(
      parseDeploymentFlagsFromUserWire({
        ...BASE_USER,
        capabilities: { personal_organizations: true, team_organizations: false },
      }),
    ).toEqual({ personalOrganizations: true, teamOrganizations: false });
  });

  it('accepts singular personal_organization from live clinozy-be wire', () => {
    expect(
      parseDeploymentFlagsFromUserWire({
        ...BASE_USER,
        capabilities: { personal_organization: true, team_organizations: true },
      }),
    ).toEqual({ personalOrganizations: true, teamOrganizations: true });
  });

  it('falls back to top-level booleans', () => {
    expect(
      parseDeploymentFlagsFromUserWire({
        ...BASE_USER,
        personal_organizations: false,
        team_organizations: true,
      }),
    ).toEqual({ personalOrganizations: false, teamOrganizations: true });
  });

  it('defaults to both enabled when absent', () => {
    expect(parseDeploymentFlagsFromUserWire(BASE_USER)).toEqual(DEFAULT_DEPLOYMENT_FLAGS);
  });
});

describe('resolveDeploymentMode', () => {
  it('maps the three deployment shapes', () => {
    expect(
      resolveDeploymentMode({ personalOrganizations: true, teamOrganizations: false }),
    ).toBe('personal-only');
    expect(
      resolveDeploymentMode({ personalOrganizations: false, teamOrganizations: true }),
    ).toBe('team-only');
    expect(
      resolveDeploymentMode({ personalOrganizations: true, teamOrganizations: true }),
    ).toBe('personal-and-team');
  });
});
