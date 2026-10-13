import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('../../medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createManufacturer: vi.fn(),
}));
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { manufacturerRow } from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { useMedicalStack } from '../../hooks/useMedicalStack/index.ts';
import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
} from '../../medical-api.ts';
import { createManufacturer } from '../../medical-records-api.ts';
import { SupplierDrawer } from '../SupplierDrawer/index.ts';
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

const ZEN_ID = 'mfr_zen000000000000000000';

/** New supplier with its stacked children, as a tab page hosts them. */
function Host({ onClose }: { onClose: () => void }) {
  const stack = useMedicalStack();
  return (
    <>
      <SupplierDrawer mode="create" open onClose={onClose} openChild={stack.open} />
      <MedicalStackHost stack={stack} />
    </>
  );
}

/** Open the supplier's makers picker, type `query` and ask for the full record. */
async function stackManufacturer(user: ReturnType<typeof setup>, query: string) {
  const parent = await screen.findByTestId('supplier-drawer');
  await user.click(
    within(parent).getByTestId('supplier-drawer-step-distributes-trigger'),
  );
  await user.click(within(parent).getByTestId('supplier-drawer-manufacturers'));
  await user.type(await screen.findByRole('combobox'), query);
  await user.click(
    await screen.findByTestId('supplier-drawer-manufacturers-create-full'),
  );
  return parent;
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(fetchAllManufacturers).mockResolvedValue([manufacturerRow()]);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([]);
});
afterEach(() => {
  resetMedicalRoutes();
  useOrganizationStore.getState().clearOrganization();
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
    expect(screen.getByTestId('supplier-drawer')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a child’s save picks the new record in the field that asked', async () => {
    const user = setup();
    vi.mocked(createManufacturer).mockResolvedValue(
      manufacturerRow({ id: ZEN_ID, name: 'ZEN', tone: 'lav', medicineCount: 0 }),
    );
    renderMedicalDrawer(<Host onClose={vi.fn()} />);
    const parent = await stackManufacturer(user, 'zen');
    const child = await screen.findByTestId('manufacturer-drawer-stacked');
    await user.click(within(child).getByTestId('manufacturer-drawer-stacked-save'));

    await waitFor(() =>
      expect(screen.queryByTestId('manufacturer-drawer-stacked')).not.toBeInTheDocument(),
    );
    expect(createManufacturer).toHaveBeenCalledWith({
      input: expect.objectContaining({ name: 'ZEN' }),
      idempotencyKey: expect.any(String),
    });
    await waitFor(() =>
      expect(
        within(parent).getByTestId('supplier-drawer-manufacturers'),
      ).toHaveTextContent('ZEN'),
    );
  });
});
