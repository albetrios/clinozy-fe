import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addCivilDays,
  addCivilMonths,
  clinicToday,
} from '@/shared/api/clinic/clinic-time.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchMedicalRep } from '../../../shared/medical-api.ts';
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

const D = 'mr-visit-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetClinicFixtures();
});

describe('MrVisitDrawer (medical.md:239–252)', () => {
  it('logs today’s visit with the next one two weeks on, and sets it on the MR', async () => {
    const user = setup();
    const onClose = vi.fn();
    const mr = await fetchMedicalRep(ref.medicalRep(1));
    renderMedicalDrawer(<MrVisitDrawer open onClose={onClose} mr={mr} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Log MR visit');
    expect(drawer).toHaveTextContent('Alvio Pharma · Rakesh');
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
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/^Visit logged · reminder set for /),
    );
    const today = clinicToday();
    expect((await clinicFixtures.medicalReps.get(mr.id)).nextVisitOn).toBe(
      addCivilMonths(today, 1),
    );
    const visits = clinicFixtures.mrVisits.snapshot(
      (visit) => visit.mrId === mr.id && visit.date === today,
    );
    expect(visits.at(-1)).toMatchObject({ samples: '4 tubes Azelan', notes: null });
    expect(addCivilDays(today, 14)).not.toBe(addCivilMonths(today, 1));
  });

  it('shows the shell while the MR loads', async () => {
    renderMedicalDrawer(<MrVisitDrawer open onClose={vi.fn()} mr={undefined} />);
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
