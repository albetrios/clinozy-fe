import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import {
  appFixtures,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { fetchMedicalRep } from '../../medical-api.ts';
import { MrDrawer } from './MrDrawer.tsx';

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

const D = 'rep-drawer';
const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

describe('MrDrawer (medical.md:224–237)', () => {
  it('adds an MR: "Add a name" when empty, then "MR saved"', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(<MrDrawer mode="create" open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('New MR');
    expect(drawer).toHaveTextContent('Medical representative');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a name');

    await user.type(within(drawer).getByTestId(`${D}-name`), 'Ravi');
    await user.type(within(drawer).getByTestId(`${D}-phone`), '9876543210');
    expect(await axeForDialog(drawer)).toHaveNoViolations();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notifyMock.success).toHaveBeenCalledWith('MR saved');
    expect(
      appFixtures.medicalReps.snapshot((rep) => rep.name === 'Ravi')[0],
    ).toMatchObject({ phone: '+919876543210', nextVisitOn: null });
  });

  it('edits an MR and offers Delete to an admin', async () => {
    const user = setup();
    const onClose = vi.fn();
    const mr = await fetchMedicalRep(ref.medicalRep(1));
    renderMedicalDrawer(<MrDrawer mode="edit" mr={mr} open onClose={onClose} />);
    const drawer = await screen.findByTestId(D);
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Edit MR');
    expect(within(drawer).getByTestId(`${D}-delete`)).toBeInTheDocument();
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Save changes');

    const name = within(drawer).getByTestId(`${D}-name`);
    await user.clear(name);
    await user.click(name);
    await user.paste('Alvio Pharma · Rakesh S');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect((await appFixtures.medicalReps.get(mr.id)).name).toBe(
      'Alvio Pharma · Rakesh S',
    );
  });

  it('stacked: "Back" · "Add MR", the new MR handed back', async () => {
    const user = setup();
    const onSaved = vi.fn();
    renderMedicalDrawer(
      <MrDrawer
        mode="create"
        prefill={{ name: 'Ravi' }}
        open
        onClose={vi.fn()}
        stacked
        onSaved={onSaved}
        testId={`${D}-stacked`}
      />,
    );
    const drawer = await screen.findByTestId(`${D}-stacked`);
    expect(within(drawer).getByTestId(`${D}-stacked-dismiss`)).toHaveTextContent('Back');
    await user.click(within(drawer).getByTestId(`${D}-stacked-save`));
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ravi' })),
    );
  });

  it('shows the shell while a deep-linked MR loads', async () => {
    renderMedicalDrawer(<MrDrawer mode="edit" mr={undefined} open onClose={vi.fn()} />);
    expect(await screen.findByTestId(`${D}-skeleton`)).toBeInTheDocument();
  });
});
