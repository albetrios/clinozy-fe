import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as IdleTimeoutModule from '@/shared/auth/idle-timeout.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { SessionTimeoutDialog } from './SessionTimeoutDialog.tsx';

/**
 * The warning's FRAME — the confirm frame every confirm shares (the end panel
 * from `md`, the bottom sheet below). Its behaviour is pinned by the two other
 * suites, which run as they always did; this one only checks where it sits
 * and that an unattended prompt still cannot be waved away.
 */
const { viewport, startIdleTimeoutMock, logoutMock } = vi.hoisted(() => {
  const handle = { extend: vi.fn(), stop: vi.fn() };
  return {
    viewport: { tier: 'desktop' as ViewportTier },
    startIdleTimeoutMock: vi.fn((_options: unknown) => handle),
    logoutMock: vi.fn((_opts?: { reason?: string }) => Promise.resolve()),
  };
});
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
}));
vi.mock('@/shared/auth/idle-timeout.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof IdleTimeoutModule>()),
  startIdleTimeout: startIdleTimeoutMock,
}));
vi.mock('@/shared/auth/service.ts', () => ({
  logout: logoutMock,
  forceLogout: vi.fn(),
}));

/** Render, let the router settle, and enter the warning as the idle timer does. */
async function renderWarned() {
  const view = renderWithProviders(<SessionTimeoutDialog />);
  await act(async () => {
    await Promise.resolve();
  });
  const options = startIdleTimeoutMock.mock.calls.at(-1)?.[0] as
    { onWarn: (info: { logoutAt: number }) => void } | undefined;
  if (!options) throw new Error('startIdleTimeout was never called');
  act(() => options.onWarn({ logoutAt: Date.now() + 90_000 }));
  return view;
}

describe('SessionTimeoutDialog — the confirm frame', () => {
  beforeEach(() => {
    viewport.tier = 'desktop';
    useAuthStore.getState().setUser({
      id: 'test-user',
      email: 'test@example.com',
      role: 'user',
      organizationId: 't1',
      name: 'Test User',
    });
  });
  afterEach(() => {
    useAuthStore.getState().clearAuth();
    vi.resetAllMocks();
  });

  it.each([
    ['desktop', 'panel'],
    ['tablet', 'panel'],
    ['phone', 'sheet'],
  ] as const)('is the %s’s %s, named "Session expiring"', async (tier, layout) => {
    viewport.tier = tier;
    await renderWarned();

    const dialog = screen.getByRole('alertdialog', { name: 'Session expiring' });
    expect(dialog).toBe(screen.getByTestId('session-timeout-dialog'));
    expect(dialog).toHaveAttribute('data-layout', layout);
    await waitFor(() => expect(screen.getByTestId('session-stay')).toHaveFocus());
  });

  it.each(['desktop', 'phone'] as const)(
    'has no × and Esc does not wave it away (%s)',
    async (tier) => {
      viewport.tier = tier;
      const user = userEvent.setup();
      await renderWarned();

      expect(screen.queryByTestId('confirm-close')).not.toBeInTheDocument();
      await user.keyboard('{Escape}');

      expect(screen.getByTestId('session-timeout-dialog')).toBeVisible();
      expect(logoutMock).not.toHaveBeenCalled();
    },
  );

  it.each(['desktop', 'phone'] as const)(
    'has no accessibility violations while warning (%s)',
    async (tier) => {
      viewport.tier = tier;
      const { baseElement } = await renderWarned();
      expect(await axeForDialog(baseElement)).toHaveNoViolations();
    },
  );
});
