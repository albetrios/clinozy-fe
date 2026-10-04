import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as NotifyModule from '@/shared/notify/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';
import { taskRowFixture } from '@/tests/utils/task-row-fixture.ts';

import { WhatsNextSheet } from './WhatsNextSheet.tsx';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof NotifyModule>()),
  notify: notifyMock,
}));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:00')));
  for (const mock of Object.values(notifyMock)) mock.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetClinicFixtures();
  vi.useRealTimers();
});

async function openSheet() {
  const onClose = vi.fn();
  const view = renderWithProviders(
    <WhatsNextSheet
      task={taskRowFixture()}
      result="Confirmed on call"
      onClose={onClose}
    />,
  );
  await view.router.load();
  const sheet = await screen.findByTestId('whats-next-drawer');
  return { ...view, sheet, onClose, user: userEvent.setup() };
}

describe('WhatsNextSheet (KICKOFF §6.10 What’s next)', () => {
  it('asks what’s next for the person after the task it closed', async () => {
    const { sheet } = await openSheet();
    expect(
      screen.getByRole('heading', { name: 'What’s next for Priti?' }),
    ).toBeInTheDocument();
    expect(sheet).toHaveAccessibleDescription(
      'Closed · Confirm Priti’s visit · Confirmed on call',
    );
    expect(screen.getByTestId('whats-next-drawer-dismiss')).toHaveTextContent(
      'Nothing next',
    );
    expect(await axeForDialog(sheet)).toHaveNoViolations();
  });

  it('needs a step, then a time — each named under its field', async () => {
    const { user } = await openSheet();
    await user.click(screen.getByTestId('whats-next-step-sendWhatsApp'));
    await user.click(screen.getByTestId('whats-next-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick when');
    expect(screen.getByRole('alert')).toHaveTextContent('Pick when');
  });

  it('closes on "Nothing next"', async () => {
    const { user, onClose } = await openSheet();
    await user.click(screen.getByTestId('whats-next-drawer-dismiss'));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
