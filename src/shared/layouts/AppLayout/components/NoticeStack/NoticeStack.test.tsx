import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { NoticeStack } from './NoticeStack.tsx';

const { meContextMock } = vi.hoisted(() => ({ meContextMock: vi.fn() }));
vi.mock('@/shared/hooks/useMeContext/index.ts', () => ({ useMeContext: meContextMock }));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  meContextMock.mockReturnValue({ data: undefined });
  useOrganizationStore
    .getState()
    .setPermissions(['organization:read', 'organization:delete']);
  useUIStore.getState().setPreviewRole(null);
});

describe('NoticeStack', () => {
  it('shows nothing without a notice', async () => {
    renderWithProviders(<NoticeStack />);
    await act(async () => {});
    expect(screen.queryByTestId('view-as-bar')).toBeNull();
    expect(screen.queryByTestId('email-verify-banner')).toBeNull();
  });

  it('shows the View-as pill with the previewed role’s sections', async () => {
    useUIStore.getState().setPreviewRole('marketing');
    const { container } = renderWithProviders(<NoticeStack />);
    const pill = await screen.findByTestId('view-as-bar');
    expect(pill).toHaveAttribute('data-slot', 'notice-pill');
    expect(pill).toHaveTextContent('Previewing as Marketing');
    expect(await screen.findByText('Today · Leads · Tasks')).toBeInTheDocument();
    expect(pill).not.toHaveTextContent('No sections');
    expect(await axe(container)).toHaveNoViolations();
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
