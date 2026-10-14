import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  logMrVisit: vi.fn(),
}));
import { addCivilMonths, appToday } from '@/shared/api/app/app-time.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { mrRow, mrVisitRow, TEST_MR_ID } from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { logMrVisit } from '../../../shared/medical-records-api.ts';
import { MrVisitDrawer } from './MrVisitDrawer.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: notifyMock,
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

const D = 'rep-visit-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
});
afterEach(() => {
  resetMedicalRoutes();
  useOrganizationStore.getState().clearOrganization();
});

describe('MrVisitDrawer (medical.md:239–252)', () => {
  it('logs today’s visit with the next one a month on — the visit write with its samples', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(logMrVisit).mockResolvedValue(mrVisitRow());
    renderMedicalDrawer(<MrVisitDrawer open onClose={onClose} mr={mrRow()} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Log MR visit');
    expect(drawer).toHaveTextContent('Rahul Mehta');
    expect(within(drawer).getByTestId(`${D}-summary`)).toHaveTextContent(/^Next visit /);

    await user.click(within(drawer).getByTestId(`${D}-step-details-trigger`));
    expect(within(drawer).getByTestId(`${D}-next-visit-quick-twoWeeks`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(drawer).getByTestId(`${D}-next-visit-quick-oneMonth`));
    expect(within(drawer).getByTestId(`${D}-next-visit-quick-oneMonth`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.type(within(drawer).getByTestId(`${D}-samples`), '4 tubes Azelan');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId(`${D}-save`));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const today = appToday();
    expect(logMrVisit).toHaveBeenCalledWith({
      input: {
        mrId: TEST_MR_ID,
        date: today,
        nextVisitOn: addCivilMonths(today, 1),
        samples: '4 tubes Azelan',
        notes: null,
      },
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/^Visit logged · reminder set for /),
    );
  });

  it('a visit with no next one says so; a refusal keeps the drawer open', async () => {
    const user = setup();
    const onClose = vi.fn();
    vi.mocked(logMrVisit)
      .mockRejectedValueOnce(
        new HttpError('down', 503, '/app/medical-reps/mrep_x/visits', 'POST', {}),
      )
      .mockResolvedValueOnce(mrVisitRow({ nextVisitOn: null }));
    renderMedicalDrawer(<MrVisitDrawer open onClose={onClose} mr={mrRow()} />);
    const drawer = await screen.findByTestId(D);
    await user.click(within(drawer).getByTestId(`${D}-step-details-trigger`));
    await user.click(within(drawer).getByRole('button', { name: /clear/i }));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();

    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(logMrVisit).toHaveBeenLastCalledWith({
      input: expect.objectContaining({ nextVisitOn: null }),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.not.stringMatching(/reminder set/),
    );
  });

  it('shows the shell while the MR loads', async () => {
    renderMedicalDrawer(<MrVisitDrawer open onClose={vi.fn()} mr={undefined} />);
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
