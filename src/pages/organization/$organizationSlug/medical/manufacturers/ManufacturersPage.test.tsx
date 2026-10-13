import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listManufacturers: vi.fn(),
  fetchManufacturer: vi.fn(),
  medicalListSummary: vi.fn(),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteManufacturer: vi.fn(),
  restoreManufacturer: vi.fn(),
}));
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  manufacturerRow,
  medicalPage,
  mrRow,
  supplierRow,
  TEST_MAKER_ID,
  TEST_MR_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
  fetchManufacturer,
  listManufacturers,
  medicalListSummary,
} from '../shared/medical-api.ts';
import type { ManufacturerRow } from '../shared/medical-contracts.ts';
import { deleteManufacturer } from '../shared/medical-records-api.ts';
import { ManufacturersPage } from './ManufacturersPage.tsx';

// The footer (its count) shows from `md`; a phone hides it.
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => 'desktop',
  readViewportTier: () => 'desktop',
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

const MAKERS_URL = '/organization/acme/medical/manufacturers';
const ZEN_ID = 'mfr_zen000000000000000000';

/** SUN PHARMA with 14 medicines, its supplier and MR; ZEN, quick-added, no medicines yet. */
const ROWS: ManufacturerRow[] = [
  manufacturerRow(),
  manufacturerRow({
    id: ZEN_ID,
    name: 'ZEN',
    tone: 'mint',
    isQuick: true,
    medicineCount: 0,
    suppliers: [],
    mrs: [],
  }),
];

/** The Manufacturers tab at `url`, once its rows are listed. */
async function openMakers(
  url = MAKERS_URL,
  member: Parameters<typeof renderMedicalRoutes>[2] = {},
) {
  const view = renderMedicalRoutes(url, { manufacturers: ManufacturersPage }, member);
  await waitFor(() =>
    expect(screen.getAllByTestId('medical-manufacturers-table-row')).toHaveLength(
      ROWS.length,
    ),
  );
  return view;
}

/** One row of the table, by its maker's name. */
function rowNamed(name: string) {
  const row = screen
    .getAllByTestId('medical-manufacturers-table-row')
    .find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return within(row);
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(listManufacturers).mockResolvedValue(medicalPage(ROWS));
  vi.mocked(medicalListSummary).mockResolvedValue({ total: 2, payable: 0 });
  vi.mocked(fetchManufacturer).mockResolvedValue(manufacturerRow());
  vi.mocked(fetchAllManufacturers).mockResolvedValue(ROWS);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([
    supplierRow(),
    supplierRow({ id: 'sup_nhpharma00000000000000', name: 'NH Pharma' }),
  ]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([
    mrRow(),
    mrRow({ id: 'mrep_ravi00000000000000000', name: 'Ravi' }),
  ]);
});
afterEach(() => {
  resetMedicalRoutes();
  useOrganizationStore.getState().clearOrganization();
});

describe('ManufacturersPage (medical.md:89–103)', () => {
  it('lists the makers with their medicines, suppliers and MRs, the footer and the end line', async () => {
    const { container } = await openMakers();
    expect(listManufacturers).toHaveBeenCalledWith({}, undefined);
    expect(medicalListSummary).toHaveBeenCalledWith('manufacturers', {});
    expect(rowNamed('SUN PHARMA').getByText('14 medicines')).toBeInTheDocument();
    expect(rowNamed('SUN PHARMA').getByText('Ankur Pharma')).toBeInTheDocument();
    expect(rowNamed('SUN PHARMA').getByText('Rahul Mehta')).toBeInTheDocument();
    expect(rowNamed('ZEN').getByText('None yet')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('medical-manufacturers-table-footer')).toHaveTextContent(
        '2 manufacturers',
      ),
    );
    expect(screen.getByTestId('medical-manufacturers-table-end')).toHaveTextContent(
      'All manufacturers loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-manufacturers-tab-manufacturers',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('reads one supplier and one MR from the URL — the API filters by one of each', async () => {
    await openMakers(`${MAKERS_URL}?suppliers=${TEST_SUPPLIER_ID}&mrs=${TEST_MR_ID}`);
    const filters = { supplier: TEST_SUPPLIER_ID, mr: TEST_MR_ID };
    expect(listManufacturers).toHaveBeenCalledWith(filters, undefined);
    expect(medicalListSummary).toHaveBeenCalledWith('manufacturers', filters);
  });

  it('opens Edit manufacturer from a row, read through its own route', async () => {
    const user = setup();
    const { router } = await openMakers();
    await user.click(rowNamed('SUN PHARMA').getByText('14 medicines'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${MAKERS_URL}/${TEST_MAKER_ID}/edit`),
    );
    expect(await screen.findByTestId('manufacturer-drawer')).toBeInTheDocument();
    expect(fetchManufacturer).toHaveBeenCalledWith(TEST_MAKER_ID);
  });

  it('Delete only while no medicine names it; asks for a reason', async () => {
    const user = setup();
    vi.mocked(deleteManufacturer).mockResolvedValue(undefined);
    await openMakers();
    expect(
      rowNamed('SUN PHARMA').queryByTestId('medical-manufacturers-row-action-delete'),
    ).not.toBeInTheDocument();

    await user.click(
      rowNamed('ZEN').getByTestId('medical-manufacturers-row-action-delete'),
    );
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this manufacturer?');
    await user.click(within(confirm).getByRole('radio', { name: 'Created by mistake' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(deleteManufacturer).toHaveBeenCalledWith(ZEN_ID, 'mistake', null),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith('ZEN deleted', expect.anything());
  });

  it('a Pharmacist (create, update) edits but deletes nothing', async () => {
    await openMakers(MAKERS_URL, { role: 'pharmacist' });
    await waitFor(() =>
      expect(
        rowNamed('ZEN').getByTestId('medical-manufacturers-row-action-edit'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId('medical-manufacturers-row-action-delete'),
    ).not.toBeInTheDocument();
  });

  it('shows a first read that fails in place, with Retry', async () => {
    const user = setup();
    vi.mocked(listManufacturers).mockRejectedValueOnce(
      new HttpError('down', 503, '/app/manufacturers', 'GET', {}),
    );
    renderMedicalRoutes(MAKERS_URL, { manufacturers: ManufacturersPage });
    expect(await screen.findByTestId('retry-error')).toBeInTheDocument();
    await user.click(screen.getByTestId('retry-button'));
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-manufacturers-table-row')).toHaveLength(
        ROWS.length,
      ),
    );
  });
});
