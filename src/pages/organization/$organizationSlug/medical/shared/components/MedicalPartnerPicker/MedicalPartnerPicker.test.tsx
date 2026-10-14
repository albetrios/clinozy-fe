import { screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../../medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('../../medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  quickCreateManufacturer: vi.fn(),
  quickCreateSupplier: vi.fn(),
  quickCreateMedicalRep: vi.fn(),
}));
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  manufacturerRow,
  mrRow,
  supplierRow,
  TEST_MAKER_ID,
  TEST_MR_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalDrawer,
  resetMedicalRoutes,
} from '../../../__tests__/integration/medical-test-router.tsx';
import { useMedicalPickers } from '../../hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../hooks/useMedicalStack/index.ts';
import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
} from '../../medical-api.ts';
import {
  quickCreateManufacturer,
  quickCreateMedicalRep,
  quickCreateSupplier,
} from '../../medical-records-api.ts';
import {
  type MedicalPartnerKind,
  MedicalPartnerPicker,
} from './MedicalPartnerPicker.tsx';

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

const ALVI_ID = 'mfr_alvi00000000000000000';
const ACME_ID = 'mfr_acme00000000000000000';
const OM_ID = 'sup_ompharma00000000000000';
const RAVI_ID = 'mrep_ravi00000000000000000';

/** A one-pick field over `kind`, its pick shown beside it. */
function Single({
  kind,
  openChild,
  makerId,
}: {
  kind: MedicalPartnerKind;
  openChild?: OpenMedicalChild;
  makerId?: string;
}) {
  const pickers = useMedicalPickers();
  const [value, setValue] = useState<string | null>(null);
  return (
    <>
      <MedicalPartnerPicker
        kind={kind}
        label="Partner"
        value={value}
        onChange={setValue}
        pickers={pickers}
        openChild={openChild}
        makerId={makerId}
        testId="partner"
      />
      <output data-testid="picked">{value ?? ''}</output>
    </>
  );
}

/** A pick-any field over `kind`. */
function Multiple({ kind }: { kind: MedicalPartnerKind }) {
  const pickers = useMedicalPickers();
  const [value, setValue] = useState<string[]>([]);
  return (
    <>
      <MedicalPartnerPicker
        kind={kind}
        multiple
        label="Partners"
        value={value}
        onChange={setValue}
        pickers={pickers}
        testId="partners"
      />
      <output data-testid="picked">{value.join(',')}</output>
    </>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  // SUN PHARMA (14 medicines) and ALVI (one); Ankur Pharma distributes SUN PHARMA, NH Pharma nothing.
  vi.mocked(fetchAllManufacturers).mockResolvedValue([
    manufacturerRow(),
    manufacturerRow({ id: ALVI_ID, name: 'ALVI', tone: 'lav', medicineCount: 1 }),
  ]);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([
    supplierRow(),
    supplierRow({
      id: 'sup_nhpharma00000000000000',
      name: 'NH Pharma',
      manufacturers: [],
      manufacturerIds: [],
    }),
  ]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([
    mrRow(),
    mrRow({ id: 'mrep_rakesh000000000000000', name: 'Alvio Pharma · Rakesh' }),
  ]);
});
afterEach(() => {
  resetMedicalRoutes();
  useOrganizationStore.getState().clearOrganization();
});

describe('MedicalPartnerPicker (medical.md:311–325)', () => {
  it('lists the makers with their counts and picks one', async () => {
    const user = setup();
    const { container } = renderMedicalDrawer(<Single kind="manufacturer" />);
    await user.click(await screen.findByTestId('partner'));
    expect(await screen.findByRole('option', { name: /ALVI/ })).toHaveTextContent(
      '1 medicine',
    );
    await user.click(screen.getByRole('option', { name: /SUN PHARMA/ }));
    expect(screen.getByTestId('picked')).toHaveTextContent(TEST_MAKER_ID);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('quick-adds a maker from the create row: toasted, listed and picked', async () => {
    const user = setup();
    vi.mocked(quickCreateManufacturer).mockResolvedValue(
      manufacturerRow({ id: ACME_ID, name: 'ACME', isQuick: true, medicineCount: 0 }),
    );
    renderMedicalDrawer(<Single kind="manufacturer" />);
    await user.click(await screen.findByTestId('partner'));
    await user.type(await screen.findByRole('combobox'), 'acme');
    await user.click(
      await screen.findByRole('option', { name: /Add manufacturer “acme”/ }),
    );
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Manufacturer ACME added'),
    );
    expect(quickCreateManufacturer).toHaveBeenCalledWith({
      name: 'acme',
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => expect(screen.getByTestId('picked')).toHaveTextContent(ACME_ID));
  });

  it('groups suppliers by the maker they distribute and quick-adds one linked to it', async () => {
    const user = setup();
    vi.mocked(quickCreateSupplier).mockResolvedValue(
      supplierRow({ id: OM_ID, name: 'Om Pharma', phone: null, isQuick: true }),
    );
    renderMedicalDrawer(<Single kind="supplier" makerId={TEST_MAKER_ID} />);
    await user.click(await screen.findByTestId('partner'));
    expect(await screen.findByText('Distributes SUN PHARMA')).toBeInTheDocument();
    expect(screen.getByText('Other suppliers')).toBeInTheDocument();
    await user.type(screen.getByRole('combobox'), 'Om Pharma');
    await user.click(
      await screen.findByRole('option', { name: /Add supplier “Om Pharma”/ }),
    );
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Supplier Om Pharma added · add phone and GST later',
      ),
    );
    expect(quickCreateSupplier).toHaveBeenCalledWith({
      name: 'Om Pharma',
      manufacturerIds: [TEST_MAKER_ID],
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => expect(screen.getByTestId('picked')).toHaveTextContent(OM_ID));
  });

  it('opens the record in full on top, and picks what it saves', async () => {
    const user = setup();
    const openChild = vi.fn<OpenMedicalChild>();
    renderMedicalDrawer(<Single kind="mr" openChild={openChild} />);
    await user.click(await screen.findByTestId('partner'));
    await user.type(await screen.findByRole('combobox'), 'Ravi');
    await user.click(await screen.findByTestId('partner-create-full'));
    expect(openChild).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'mr', query: 'Ravi' }),
    );
    const [request] = openChild.mock.calls[0] ?? [];
    if (request?.kind !== 'mr') throw new Error('expected an MR request');
    request.onCreated(mrRow({ id: RAVI_ID, name: 'Ravi', manufacturers: [] }));
    await waitFor(() => expect(screen.getByTestId('picked')).toHaveTextContent(RAVI_ID));
  });

  it('adds picks to a pick-any field, a quick MR among them', async () => {
    const user = setup();
    vi.mocked(quickCreateMedicalRep).mockResolvedValue(
      mrRow({ id: RAVI_ID, name: 'Ravi', phone: null, manufacturers: [] }),
    );
    renderMedicalDrawer(<Multiple kind="mr" />);
    await user.click(await screen.findByTestId('partners'));
    await user.click(await screen.findByRole('option', { name: /Rahul Mehta/ }));
    await user.type(screen.getByRole('combobox'), 'Ravi');
    await user.click(await screen.findByRole('option', { name: /Add MR “Ravi”/ }));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalledWith('MR Ravi added'));
    expect(quickCreateMedicalRep).toHaveBeenCalledWith({
      name: 'Ravi',
      idempotencyKey: expect.any(String),
    });
    await waitFor(() =>
      expect(screen.getByTestId('picked')).toHaveTextContent(`${TEST_MR_ID},${RAVI_ID}`),
    );
  });
});
