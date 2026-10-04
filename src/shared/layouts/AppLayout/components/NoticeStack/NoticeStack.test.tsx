import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  resetClinicAccessFixture,
  saveRoleMatrixChange,
} from '@/shared/api/clinic/access-api.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { RoleSummary } from '@/shared/api/organization-contracts.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NoticeStack } from './NoticeStack.tsx';

const { meContextMock } = vi.hoisted(() => ({ meContextMock: vi.fn() }));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({ useMeContext: meContextMock }));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const api = vi.hoisted(() => ({ listRoles: vi.fn() }));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  ...api,
}));

/** A custom clinozy-be role (Appendix F), as `listRoles` maps it. */
const SENIOR_DESK: RoleSummary = {
  id: 'rol_senioraaaaaaaaaaaaaaa',
  name: 'Senior desk',
  description: '',
  permissions: [],
  memberCount: 0,
  isSystem: false,
};

beforeEach(() => {
  meContextMock.mockReturnValue({ data: undefined });
  resetClinicAccessFixture();
  api.listRoles.mockReset();
  api.listRoles.mockResolvedValue({ rows: [SENIOR_DESK], next: null, hasMore: false });
  useAuthStore.setState({
    user: { id: 'usr_me', email: 'owner@elsewhere.com', role: 'user' } as AuthUser,
  });
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore
    .getState()
    .setPermissions(['organization:read', 'organization:delete', 'role:read']);
  useUIStore.getState().setPreviewRole(null);
});
afterEach(() => {
  resetClinicAccessFixture();
  useAuthStore.setState({ user: null });
  useUIStore.getState().setPreviewRole(null);
});

describe('NoticeStack', () => {
  it('shows nothing without a notice', async () => {
    renderWithProviders(<NoticeStack />);
    await act(async () => {});
    expect(screen.queryByTestId('view-as-bar')).toBeNull();
    expect(screen.queryByTestId('email-verify-banner')).toBeNull();
    // The shell lists no roles unless a custom role is previewed.
    expect(api.listRoles).not.toHaveBeenCalled();
  });

  it('shows the View-as pill with the previewed role’s sections', async () => {
    useUIStore.getState().setPreviewRole('marketing');
    const { container } = renderWithProviders(<NoticeStack />);
    const pill = await screen.findByTestId('view-as-bar');
    expect(pill).toHaveAttribute('data-slot', 'notice-pill');
    expect(pill).toHaveTextContent('Previewing as Marketing');
    expect(await screen.findByText('Today · Leads · Tasks')).toBeInTheDocument();
    expect(pill).not.toHaveTextContent('No sections');
    expect(api.listRoles).not.toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names a previewed custom role and draws its matrix tone (L-31e)', async () => {
    await saveRoleMatrixChange({ kind: 'addCustom', key: SENIOR_DESK.id, tone: 'lime' });
    await saveRoleMatrixChange({
      kind: 'section',
      key: SENIOR_DESK.id,
      section: 'leads',
      grants: { view: true, create: false, edit: false, delete: false },
    });
    useUIStore.getState().setPreviewRole(SENIOR_DESK.id);
    const { container } = renderWithProviders(<NoticeStack />);
    const pill = await screen.findByTestId('view-as-bar');
    await waitFor(() => expect(pill).toHaveTextContent('Previewing as Senior desk'));
    expect(await screen.findByText('Today · Leads')).toBeInTheDocument();
    expect(pill.querySelector('.bg-tone-lime-dot')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ends the preview on "Exit preview" — back to the member’s own access', async () => {
    const user = userEvent.setup();
    useUIStore.getState().setPreviewRole('doctor');
    renderWithProviders(<NoticeStack />);
    await user.click(await screen.findByTestId('view-as-exit'));
    expect(useUIStore.getState().previewRole).toBeNull();
    expect(notify.success).toHaveBeenCalledWith('Back to your own access');
    expect(screen.queryByTestId('view-as-bar')).toBeNull();
  });

  it('draws the email notice as a pill above it', async () => {
    meContextMock.mockReturnValue({
      data: { user: { isEmailVerified: false, email: 'riya@acme.test' } },
    });
    renderWithProviders(<NoticeStack />);
    const pill = await screen.findByTestId('email-verify-banner');
    expect(pill).toHaveAttribute('data-slot', 'notice-pill');
  });
});
