import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  requireOrgStatus,
  requireProvisionedWorkspace,
  requireSuspendedOrgStatus,
  requireTeamDeployment,
  resolveActiveOrg,
} from './org-gates.ts';
import {
  requireActiveOrganization,
  requireOrganizationContext,
  requireProvisionedTeamWorkspace,
  requireSuspendedOrganization,
  requireTeamOrganizationsDeployment,
} from './route-guards.ts';

vi.mock('./route-guards.ts', () => ({
  requireActiveOrganization: vi.fn(),
  requireOrganizationContext: vi.fn(),
  requireProvisionedTeamWorkspace: vi.fn(),
  requireSuspendedOrganization: vi.fn(),
  requireTeamOrganizationsDeployment: vi.fn(),
}));

describe('org gates — thin wrappers stay faithful to the underlying guards', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('resolveActiveOrg forwards the slug param (empty string when absent)', async () => {
    await resolveActiveOrg({ params: { organizationSlug: 'acme' } });
    expect(requireOrganizationContext).toHaveBeenCalledWith('acme');

    await resolveActiveOrg({ params: {} });
    expect(requireOrganizationContext).toHaveBeenLastCalledWith('');
  });

  it('requireOrgStatus forwards the slug param (empty string when absent)', async () => {
    await requireOrgStatus({ params: { organizationSlug: 'acme' } });
    expect(requireActiveOrganization).toHaveBeenCalledWith('acme');

    await requireOrgStatus({ params: {} });
    expect(requireActiveOrganization).toHaveBeenLastCalledWith('');
  });

  it('requireSuspendedOrgStatus forwards the slug param (empty string when absent)', async () => {
    await requireSuspendedOrgStatus({ params: { organizationSlug: 'acme' } });
    expect(requireSuspendedOrganization).toHaveBeenCalledWith('acme');

    await requireSuspendedOrgStatus({ params: {} });
    expect(requireSuspendedOrganization).toHaveBeenLastCalledWith('');
  });

  it('the deployment gate calls its mode guard with no context', async () => {
    await requireTeamDeployment({ params: {} });
    expect(requireTeamOrganizationsDeployment).toHaveBeenCalledTimes(1);
  });

  it('returns synchronously from passing organization gates', () => {
    expect(requireOrgStatus({ params: {} })).toBeUndefined();
    expect(requireTeamDeployment({ params: {} })).toBeUndefined();
  });

  it('synchronously propagates access denials from organization gates', () => {
    const denial = new Error('redirect');
    vi.mocked(requireActiveOrganization).mockImplementationOnce(() => {
      throw denial;
    });
    expect(() => requireOrgStatus({ params: {} })).toThrow(denial);
    vi.mocked(requireTeamOrganizationsDeployment).mockImplementationOnce(() => {
      throw denial;
    });
    expect(() => requireTeamDeployment({ params: {} })).toThrow(denial);
  });

  it('the workspace gate carries the deep link for the onboarding redirect', async () => {
    await requireProvisionedWorkspace({ params: {}, redirectFrom: '/organization' });
    expect(requireProvisionedTeamWorkspace).toHaveBeenCalledWith({
      redirectFrom: '/organization',
    });

    await requireProvisionedWorkspace({
      params: { organizationSlug: 'acme' },
      redirectFrom: '/organization/acme/today',
    });
    expect(requireProvisionedTeamWorkspace).toHaveBeenLastCalledWith({
      redirectFrom: '/organization/acme/today',
    });
  });

  it('guard failures propagate — gates add no swallowing layer', async () => {
    vi.mocked(requireOrganizationContext).mockRejectedValueOnce(new Error('redirect'));
    await expect(
      resolveActiveOrg({ params: { organizationSlug: 'acme' } }),
    ).rejects.toThrow('redirect');
  });
});
