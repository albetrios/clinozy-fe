import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  appFixtures,
  resetAppFixtures,
} from '@/shared/api/app/fixtures/world.fixtures.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { useMedicalStack } from '../../hooks/useMedicalStack/index.ts';
import { MedicineDrawer } from '../MedicineDrawer/index.ts';
import { MedicalStackHost } from './MedicalStackHost.tsx';

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

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

/** New medicine with its stacked children, as a tab page hosts them. */
function Host({ onClose }: { onClose: () => void }) {
  const stack = useMedicalStack();
  return (
    <>
      <MedicineDrawer mode="create" open onClose={onClose} openChild={stack.open} />
      <MedicalStackHost stack={stack} />
    </>
  );
}

/** Open the medicine's maker picker, type `query` and ask for the full record. */
async function stackManufacturer(user: ReturnType<typeof setup>, query: string) {
  const parent = await screen.findByTestId('medicine-drawer');
  await waitFor(() =>
    expect(within(parent).getByTestId('medicine-drawer-manufacturer')).toHaveTextContent(
      'ALVI',
    ),
  );
  await user.click(within(parent).getByTestId('medicine-drawer-manufacturer'));
  await user.type(await screen.findByRole('combobox'), query);
  await user.click(await screen.findByTestId('medicine-drawer-manufacturer-create-full'));
  return parent;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetAppFixtures();
});
afterEach(() => {
  resetMedicalRoutes();
  resetAppFixtures();
});

describe('MedicalStackHost (medical.md:343–355)', () => {
  it('stacks the record on top, named from the picker; Esc closes the child first', async () => {
    const user = setup();
    const onClose = vi.fn();
    renderMedicalDrawer(<Host onClose={onClose} />);
    await stackManufacturer(user, 'acme');

    const child = await screen.findByTestId('manufacturer-drawer-stacked');
    expect(within(child).getByTestId('manufacturer-drawer-stacked-name')).toHaveValue(
      'ACME',
    );
    expect(
      within(child).getByTestId('manufacturer-drawer-stacked-dismiss'),
    ).toHaveTextContent('Back');

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByTestId('manufacturer-drawer-stacked')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('medicine-drawer')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a child’s save picks the new record in the field that asked', async () => {
    const user = setup();
    renderMedicalDrawer(<Host onClose={vi.fn()} />);
    const parent = await stackManufacturer(user, 'zen');
    const child = await screen.findByTestId('manufacturer-drawer-stacked');
    await user.click(within(child).getByTestId('manufacturer-drawer-stacked-save'));

    await waitFor(() =>
      expect(screen.queryByTestId('manufacturer-drawer-stacked')).not.toBeInTheDocument(),
    );
    expect(appFixtures.manufacturers.snapshot((row) => row.name === 'ZEN')).toHaveLength(
      1,
    );
    await waitFor(() =>
      expect(
        within(parent).getByTestId('medicine-drawer-manufacturer'),
      ).toHaveTextContent('ZEN'),
    );
  });
});
