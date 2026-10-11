import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as DirectoryApiModule from '@/shared/api/app/directory-api.ts';
import type { DirectoryRole } from '@/shared/api/app/directory-api.ts';
import type * as OrganizationApiModule from '@/shared/api/organization-api.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { notify } from '@/shared/notify/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { holdPreset, PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NoticeStack } from './NoticeStack.tsx';

const { meContextMock } = vi.hoisted(() => ({ meContextMock: vi.fn() }));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({ useMeContext: meContextMock }));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const api = vi.hoisted(() => ({
  getRolePermissions: vi.fn(),
  fetchRoleDirectory: vi.fn(),
}));
vi.mock('@/shared/api/organization-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OrganizationApiModule>()),
  getRolePermissions: api.getRolePermissions,
}));
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof DirectoryApiModule>()),
  fetchRoleDirectory: api.fetchRoleDirectory,
}));

/** The role directory: a preset and the clinic's own role. */
const MARKETING: DirectoryRole = {
  id: 'rol_marketing',
  name: 'Marketing',
  tone: 'plum',
  isSystem: true,
  isLocked: false,
  preset: 'marketing',
};
const SENIOR_DESK: DirectoryRole = {
  id: 'rol_senioraaaaaaaaaaaaaaa',
  name: 'Senior desk',
  tone: 'lime',
  isSystem: false,
  isLocked: false,
  preset: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  meContextMock.mockReturnValue({ data: undefined });
  api.fetchRoleDirectory.mockResolvedValue([MARKETING, SENIOR_DESK]);
  api.getRolePermissions.mockImplementation(async (roleId: string) =>
    roleId === MARKETING.id
      ? [...PRESET_CODES.marketing]
      : ['organization:read', 'lead:read'],
  );
  useAuthStore.setState({
    user: { id: 'usr_me', email: 'owner@elsewhere.com', role: 'user' } as AuthUser,
  });
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  holdPreset('owner');
  useUIStore.getState().setPreviewRole(null);
});
afterEach(() => {
  useAuthStore.setState({ user: null });
  useUIStore.getState().setPreviewRole(null);
});

describe('NoticeStack', () => {
  it('shows nothing without a notice', async () => {
    renderWithProviders(<NoticeStack />);
    await act(async () => {});
    expect(screen.queryByTestId('view-as-bar')).toBeNull();
    expect(screen.queryByTestId('email-verify-banner')).toBeNull();
    // The shell reads no roles unless a role is previewed.
    expect(api.fetchRoleDirectory).not.toHaveBeenCalled();
  });

  it('shows the View-as pill with the previewed role’s name and the sections its codes open', async () => {
    useUIStore.getState().setPreviewRole(MARKETING.id);
    const { container } = renderWithProviders(<NoticeStack />);
    const pill = await screen.findByTestId('view-as-bar');
    expect(pill).toHaveAttribute('data-slot', 'notice-pill');
    await waitFor(() => expect(pill).toHaveTextContent('Previewing as Marketing'));
    expect(
      await screen.findByText('Today · Leads · Patients · Tasks · Offerings'),
    ).toBeInTheDocument();
    expect(pill.querySelector('.bg-tone-plum-dot')).not.toBeNull();
    expect(api.getRolePermissions).toHaveBeenCalledWith(MARKETING.id);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('names a previewed custom role by its own name and draws its tone', async () => {
    useUIStore.getState().setPreviewRole(SENIOR_DESK.id);
    const { container } = renderWithProviders(<NoticeStack />);
    const pill = await screen.findByTestId('view-as-bar');
    await waitFor(() => expect(pill).toHaveTextContent('Previewing as Senior desk'));
    expect(await screen.findByText('Today · Leads · Offerings')).toBeInTheDocument();
    expect(pill.querySelector('.bg-tone-lime-dot')).not.toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ends the preview on "Exit preview" — back to the member’s own access', async () => {
    const user = userEvent.setup();
    useUIStore.getState().setPreviewRole(MARKETING.id);
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
