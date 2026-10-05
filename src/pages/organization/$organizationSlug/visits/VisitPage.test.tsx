import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { notify } from '@/shared/notify/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderVisitRoute,
  resetVisitRoute,
  visitPath,
} from './__tests__/integration/visit-test-router.tsx';
import { VisitPage } from './VisitPage.tsx';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const tabNames = () =>
  within(screen.getByRole('tablist'))
    .getAllByRole('tab')
    .map((tab) => tab.textContent);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:42')));
  resetClinicFixtures();
  vi.mocked(notify.info).mockClear();
  vi.mocked(notify.error).mockClear();
});
afterEach(() => {
  resetVisitRoute();
  resetClinicFixtures();
  vi.useRealTimers();
});

describe('VisitPage (`/visits/$visitId`, KICKOFF §6.13)', () => {
  it('opens the visit as a full-screen dialog named for the person, focus on the name', async () => {
    renderVisitRoute(visitPath(2865), VisitPage);
    const dialog = await screen.findByRole('dialog', { name: 'Dhruv Patel' });
    expect(dialog).toHaveAttribute('data-testid', 'visit-page');
    await waitFor(() => expect(screen.getByTestId('visit-name')).toHaveFocus());
    expect(tabNames()).toEqual(['History', 'Consult & Rx', 'Treatment', 'Checkout']);
    expect(screen.getByRole('tab', { name: 'History' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('opens on the tab a lane asks for', async () => {
    renderVisitRoute(visitPath(2866, 'consult'), VisitPage, { role: 'doctor' });
    expect(await screen.findByTestId('visit-consult')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Consult & Rx' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('shows each role the tabs whose records it writes, and its first one in place of the rest', async () => {
    renderVisitRoute(visitPath(2866, 'checkout'), VisitPage, { role: 'doctor' });
    await screen.findByRole('dialog');
    await waitFor(() =>
      expect(tabNames()).toEqual(['History', 'Consult & Rx', 'Treatment']),
    );
    expect(screen.getByTestId('visit-page')).toHaveAttribute('data-tab', 'timeline');
  });

  it('gives the front desk History and Checkout, and the accountant Checkout alone', async () => {
    const desk = renderVisitRoute(visitPath(2864), VisitPage, { role: 'front_desk' });
    await screen.findByRole('dialog');
    await waitFor(() => expect(tabNames()).toEqual(['History', 'Checkout']));
    desk.unmount();
    resetVisitRoute();
    renderVisitRoute(visitPath(2864), VisitPage, { role: 'accountant' });
    await screen.findByRole('dialog');
    await waitFor(() => expect(tabNames()).toEqual(['Checkout']));
    expect(screen.getByTestId('visit-page')).toHaveAttribute('data-tab', 'checkout');
  });

  it('moves between tabs through the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderVisitRoute(visitPath(2865), VisitPage);
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('tab', { name: 'Treatment' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ tab: 'treatment' }),
    );
    expect(await screen.findByTestId('visit-treatment')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'History' }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });

  it('goes back to Today on Esc, "Close · Esc" and the strip', async () => {
    const user = userEvent.setup();
    const first = renderVisitRoute(visitPath(2865), VisitPage);
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent(
      '/organization/acme/today',
    );
    first.unmount();

    const second = renderVisitRoute(visitPath(2865), VisitPage);
    await user.click(await screen.findByTestId('visit-close'));
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent(
      '/organization/acme/today',
    );
    second.unmount();

    renderVisitRoute(visitPath(2865), VisitPage);
    const strip = await screen.findByRole('button', { name: 'Close visit' });
    expect(strip).toHaveAttribute('tabindex', '-1');
    await user.click(strip);
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent(
      '/organization/acme/today',
    );
  });

  it('opens the patient file’s Overview from "Full profile"', async () => {
    const user = userEvent.setup();
    renderVisitRoute(visitPath(2865), VisitPage);
    await user.click(await screen.findByTestId('visit-full-profile'));
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent(
      /\/patients\/[^/]+\/timeline$/,
    );
  });

  it('goes back to Today with "Visit not found" for a visit it does not know', async () => {
    renderVisitRoute(
      '/organization/acme/visits/00000000-0000-4000-8000-000000000999',
      VisitPage,
    );
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent(
      '/organization/acme/today',
    );
    expect(notify.info).toHaveBeenCalledWith(
      'Visit not found · it may have been deleted',
    );
  });

  it('sends a member who may use no tab back to Today with the permission toast', async () => {
    renderVisitRoute(visitPath(2865), VisitPage, { role: 'marketing' });
    expect(await screen.findByTestId('elsewhere')).toHaveTextContent(
      '/organization/acme/today',
    );
    expect(notify.error).toHaveBeenCalledWith(
      'You do not have permission to access this page.',
    );
  });

  it('has no axe violations', async () => {
    const { baseElement } = renderVisitRoute(visitPath(2865), VisitPage);
    await screen.findByRole('dialog', { name: 'Dhruv Patel' });
    await screen.findAllByTestId('visit-history-row');
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });
});
