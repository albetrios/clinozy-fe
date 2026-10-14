import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

vi.mock('../shared/medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMedicalReps: vi.fn(),
  fetchMedicalRep: vi.fn(),
  medicalListSummary: vi.fn(),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('../shared/medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  deleteMedicalRep: vi.fn(),
  restoreMedicalRep: vi.fn(),
  logMrVisit: vi.fn(),
}));
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  medicalPage,
  mrRow,
  mrVisitRow,
  TEST_MR_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  renderMedicalRoutes,
  resetMedicalRoutes,
} from '../__tests__/integration/medical-test-router.tsx';
import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
  fetchMedicalRep,
  listMedicalReps,
  medicalListSummary,
} from '../shared/medical-api.ts';
import type { MrRow } from '../shared/medical-contracts.ts';
import { deleteMedicalRep, logMrVisit } from '../shared/medical-records-api.ts';
import { MrsPage } from './MrsPage.tsx';

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

const MRS_URL = '/organization/acme/medical/mrs';
const RAVI_ID = 'mrep_ravi00000000000000000';

/** Rahul Mehta for SUN PHARMA; Alvio Pharma · Rakesh, his next visit overdue, no phone. */
const ROWS: MrRow[] = [
  mrRow(),
  mrRow({
    id: RAVI_ID,
    name: 'Alvio Pharma · Rakesh',
    phone: null,
    nextVisitOn: '2026-09-01',
    visitOverdue: true,
    manufacturers: [],
    manufacturerIds: [],
  }),
];

/** The MRs tab at `url` for `member`, once its rows are listed. */
async function openMrs(
  url = MRS_URL,
  member: Parameters<typeof renderMedicalRoutes>[2] = {},
) {
  const view = renderMedicalRoutes(url, { mrs: MrsPage }, member);
  await waitFor(() =>
    expect(screen.getAllByTestId('medical-mrs-table-row')).toHaveLength(ROWS.length),
  );
  return view;
}

/** One row of the table, by its MR's name. */
function rowNamed(name: string) {
  const row = screen
    .getAllByTestId('medical-mrs-table-row')
    .find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return within(row);
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  vi.mocked(listMedicalReps).mockResolvedValue(medicalPage(ROWS));
  vi.mocked(medicalListSummary).mockResolvedValue({ total: 2, payable: 0 });
  vi.mocked(fetchMedicalRep).mockResolvedValue(mrRow());
  vi.mocked(fetchAllManufacturers).mockResolvedValue([]);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([]);
});
afterEach(() => {
  resetMedicalRoutes();
  useOrganizationStore.getState().clearOrganization();
});

describe('MrsPage (medical.md:105–119)', () => {
  it('lists the MRs with the makers they represent, the footer and the end line', async () => {
    const { container } = await openMrs();
    expect(listMedicalReps).toHaveBeenCalledWith({}, undefined);
    expect(medicalListSummary).toHaveBeenCalledWith('mrs', {});
    expect(rowNamed('Rahul Mehta').getByText('SUN PHARMA')).toBeInTheDocument();
    expect(rowNamed('Rakesh').getByText('Add phone')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId('medical-mrs-table-footer')).toHaveTextContent('2 MRs'),
    );
    expect(screen.getByTestId('medical-mrs-table-end')).toHaveTextContent(
      'All MRs loaded',
    );
    expect(screen.getByRole('link', { current: 'page' })).toHaveAttribute(
      'data-testid',
      'medical-mrs-tab-mrs',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('"Log visit" opens Log MR visit over the list and writes the visit', async () => {
    const user = setup();
    vi.mocked(logMrVisit).mockResolvedValue(mrVisitRow());
    const { router } = await openMrs();
    await user.click(
      rowNamed('Rahul Mehta').getByTestId('medical-mrs-row-action-log-visit'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `${MRS_URL}/${TEST_MR_ID}/visits/create`,
      ),
    );
    const drawer = await screen.findByTestId('rep-visit-drawer');
    expect(drawer).toHaveTextContent('Rahul Mehta');
    expect(fetchMedicalRep).toHaveBeenCalledWith(TEST_MR_ID);
    await user.click(within(drawer).getByTestId('rep-visit-drawer-save'));
    await waitFor(() =>
      expect(logMrVisit).toHaveBeenCalledWith({
        input: expect.objectContaining({ mrId: TEST_MR_ID }),
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(MRS_URL));
  });

  it('Delete asks for a reason and removes the MR', async () => {
    const user = setup();
    vi.mocked(deleteMedicalRep).mockResolvedValue(undefined);
    await openMrs();
    await user.click(rowNamed('Rakesh').getByTestId('medical-mrs-row-action-delete'));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('Delete this MR?');
    await user.click(within(confirm).getByRole('radio', { name: 'Created by mistake' }));
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(deleteMedicalRep).toHaveBeenCalledWith(RAVI_ID, 'mistake', null),
    );
  });

  it('a Doctor (view) opens an MR but logs no visit and deletes nobody', async () => {
    await openMrs(MRS_URL, { role: 'doctor' });
    await waitFor(() =>
      expect(
        rowNamed('Rahul Mehta').getByTestId('medical-mrs-row-action-edit'),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId('medical-mrs-row-action-log-visit'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('medical-mrs-row-action-delete')).not.toBeInTheDocument();
  });

  it('shows a first read that fails in place, with Retry', async () => {
    const user = setup();
    vi.mocked(listMedicalReps).mockRejectedValueOnce(
      new HttpError('down', 503, '/app/medical-reps', 'GET', {}),
    );
    renderMedicalRoutes(MRS_URL, { mrs: MrsPage });
    expect(await screen.findByTestId('retry-error')).toBeInTheDocument();
    await user.click(screen.getByTestId('retry-button'));
    await waitFor(() =>
      expect(screen.getAllByTestId('medical-mrs-table-row')).toHaveLength(ROWS.length),
    );
  });
});
