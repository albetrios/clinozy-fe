import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

const { logoutMock } = vi.hoisted(() => ({
  logoutMock: vi.fn(() => new Promise<void>(() => undefined)),
}));
vi.mock('@/shared/auth/service.ts', () => ({ logout: logoutMock }));

import { Component as UnauthorizedPage } from './UnauthorizedPage.tsx';

describe('UnauthorizedPage', () => {
  it('renders the 403 with a Go Home link', async () => {
    renderWithProviders(<UnauthorizedPage />);
    expect(await screen.findByTestId('unauthorized-page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go home/i })).toBeInTheDocument();
  });

  it('is the public emblem: "Error 403" and the role it is closed to, as the page heading', async () => {
    renderWithProviders(<UnauthorizedPage />);
    const page = await screen.findByTestId('unauthorized-page');
    const heading = screen.getByRole('heading', { level: 1, name: /403/ });
    expect(heading).toHaveTextContent('Error 403');
    expect(heading).toHaveTextContent('This page isn’t open to your role');
    expect(
      screen.getByText(
        'Your access in this clinic doesn’t include it. If you need it, ask a clinic admin to update your role.',
      ),
    ).toBeInTheDocument();
    expect(page.querySelector('[data-emblem]')).toHaveAttribute('data-emblem', 'locked');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<UnauthorizedPage />);
    await screen.findByTestId('unauthorized-page');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('sends one logout for a double-clicked Sign out', async () => {
    // Two clicks in one frame — `disabled` has not re-rendered yet, so the
    // synchronous ref is what holds. logout() is single-flight underneath too;
    // this keeps the button honest about what it is doing.
    logoutMock.mockClear();
    renderWithProviders(<UnauthorizedPage />);
    const button = await screen.findByTestId('unauthorized-sign-out');

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });

  it('offers a Sign out escape so the page is never a dead-end', async () => {
    // Regression: "Go Home" alone can loop when `/` re-resolves to the target
    // that just denied access — sign-out always breaks out.
    logoutMock.mockClear();
    const user = userEvent.setup();
    renderWithProviders(<UnauthorizedPage />);
    await user.click(await screen.findByTestId('unauthorized-sign-out'));
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });
});
