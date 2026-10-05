import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as PatientsApiModule from '@/shared/api/clinic/patients-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import { PatientsPage } from '../../PatientsPage.tsx';
import { renderPatientsRoutes, resetPatientsRoutes } from './patients-test-router.tsx';

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
  TOAST_DURATION_MS: { default: 5_200, error: 9_000 },
}));

const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }));
vi.mock('@/lib/csv.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  downloadCsv: csv.downloadCsv,
}));

/** Fails the list read while `failing` is set — the room's list error. */
const listGate = vi.hoisted(() => ({ failing: false }));
vi.mock('@/shared/api/clinic/patients-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof PatientsApiModule>();
  return {
    ...actual,
    listPatients: async (...args: Parameters<typeof actual.listPatients>) => {
      if (listGate.failing) throw new Error('connection dropped');
      return actual.listPatients(...args);
    },
  };
});

const PATIENTS = '/organization/acme/patients';
const DHARTI = patientRef('Dharti Galani');

const rows = () => screen.getAllByTestId('patients-table-row');
const rowOf = (name: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

beforeEach(() => {
  viewport.tier = 'desktop';
  listGate.failing = false;
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  csv.downloadCsv.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientsRoutes();
  resetClinicFixtures();
});

describe('the Patients room (KICKOFF §6.5)', () => {
  it('lists the roster under the toolbar, ending with "All patients loaded"', async () => {
    const { container } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(30));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Patients' }),
    ).toBeInTheDocument();
    const tabs = within(screen.getByTestId('patients-tabs'));
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'All',
      'In clinic today',
      'With dues',
      'Follow-up due',
      'Recall',
    ]);
    expect(screen.getByTestId('patients-table-end')).toHaveTextContent(
      'All patients loaded',
    );
    expect(screen.getByTestId('patients-new')).toHaveTextContent('New patient');
    // The recommended set hides Gender, Conversion and Age: 6 of 9 shown.
    expect(screen.getByTestId('patients-columns-trigger')).toHaveAttribute(
      'title',
      'Columns · 6 of 9 shown',
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('switches views through the URL; the list follows', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(30));
    await user.click(screen.getByTestId('patients-tab-dues'));
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: 'dues' }),
    );
    await waitFor(() => expect(rows().length).toBeLessThan(30));
    for (const row of rows()) expect(row).not.toHaveTextContent(/—\s*$/);
  });

  it('sorts on the server from the header: ascending, descending, off', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(30));
    const header = screen.getByRole('button', { name: /^ID/ });
    await user.click(header);
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'seq:asc' }),
    );
    await waitFor(() => expect(rows()[0]).toHaveTextContent('#198'));
    await user.click(screen.getByRole('button', { name: /^ID/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'seq:desc' }),
    );
    await user.click(screen.getByRole('button', { name: /^ID/ }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('sort'));
  });

  it('opens the patient file on a row click, Activity open from md', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(30));
    await user.click(within(rowOf('Dharti Galani')).getByText('#3508'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${PATIENTS}/${DHARTI}`),
    );
    expect(router.state.location.search).toMatchObject({ activity: 'open' });
  });

  it('opens New invoice and Collect over the list, which stays (A-P1), and Edit over it', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(30));
    const dharti = within(rowOf('Dharti Galani'));
    expect(dharti.getByTestId('patients-row-action-collect')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/^Collect ₹/),
    );
    await user.click(dharti.getByTestId('patients-row-action-new-invoice'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/invoices/create'),
    );
    expect(shownLocation(router).search).toEqual({
      type: 'clinic',
      patient: DHARTI,
      from: 'patients',
    });
    expect(router.state.location.pathname).toBe(PATIENTS);
    expect(rows()).toHaveLength(30);

    router.history.back();
    await waitFor(() => expect(rows()).toHaveLength(30));
    await user.click(
      within(rowOf('Dharti Galani')).getByTestId('patients-row-action-collect'),
    );
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/payments/receive'),
    );
    expect(shownLocation(router).search).toEqual({ patient: DHARTI, from: 'patients' });
    expect(router.state.location.pathname).toBe(PATIENTS);

    router.history.back();
    await waitFor(() => expect(rows()).toHaveLength(30));
    await user.click(
      within(rowOf('Dharti Galani')).getByTestId('patients-row-action-edit'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${PATIENTS}/${DHARTI}/edit`),
    );
  });

  it('opens New patient over the list, its filters kept', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(`${PATIENTS}?view=dues`, PatientsPage);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(screen.getByTestId('patients-new'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${PATIENTS}/create`),
    );
    expect(router.state.location.search).toMatchObject({ view: 'dues' });
    const drawer = await screen.findByTestId('patient-drawer');
    expect(within(drawer).getByTestId('patient-drawer-title')).toHaveTextContent(
      'New patient',
    );
    // Cancel closes it back onto the same list.
    await user.click(within(drawer).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PATIENTS));
    expect(router.state.location.search).toEqual({ view: 'dues' });
  });

  it('creates a patient in the drawer: the list stays and refetches with them (D28)', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(
      `${PATIENTS}/create?name=Priya%20Shah&phone=9876500009`,
      PatientsPage,
    );
    const drawer = await screen.findByTestId('patient-drawer');
    expect(within(drawer).getByTestId('patient-drawer-first-name')).toHaveValue('Priya');
    expect(within(drawer).getByTestId('patient-drawer-mobile')).toHaveValue(
      '98765 00009',
    );
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(within(drawer).getByTestId('patient-drawer-save'));

    await waitFor(() => expect(router.state.location.pathname).toBe(PATIENTS));
    // The prefill's name and mobile leave the URL with the drawer.
    expect(router.state.location.search).toEqual({});
    await waitFor(() => expect(rowOf('Priya Shah')).toHaveTextContent('+91 98765 00009'));
    expect(screen.queryByTestId('patient-drawer')).not.toBeInTheDocument();
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/^Patient #\d+ created · onboarding task added$/),
      { action: { label: 'Open file', onClick: expect.any(Function) } },
    );
  });

  it('sends a create link without Create back to the list with the permission toast', async () => {
    const { router } = renderPatientsRoutes(
      `${PATIENTS}/create?view=dues`,
      PatientsPage,
      {
        role: 'therapist',
      },
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(PATIENTS));
    expect(router.state.location.search).toEqual({ view: 'dues' });
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    expect(screen.queryByTestId('patient-drawer')).not.toBeInTheDocument();
  });

  it('removes a patient through the reason confirm, with Undo (D32)', async () => {
    const user = userEvent.setup();
    renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(30));
    await user.click(
      within(rowOf('Dharti Galani')).getByTestId('patients-row-action-delete'),
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this patient?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent(
      'Dharti Galani',
    );
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(rows()).toHaveLength(29));
    expect(notifyMock.undo).toHaveBeenCalledWith('Dharti Galani removed', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(rows()).toHaveLength(30));
  });

  it('exports the selected rows as CSV (Q-P8)', async () => {
    renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(30));
    fireEvent.click(within(rowOf('Dharti Galani')).getByRole('checkbox'));
    fireEvent.click(within(rowOf('Raam Shah')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('patients-table-bulk-export'));
    expect(csv.downloadCsv).toHaveBeenCalledTimes(1);
    const [fileName, content] = csv.downloadCsv.mock.calls[0] as [string, string];
    expect(fileName).toBe('patients.csv');
    const [header, ...lines] = content.split('\n');
    expect(header).toBe('ID,Patient,Type,Status,Follow-up,Due,Updated');
    expect(lines).toHaveLength(2);
    expect(lines.join('\n')).toContain('Dharti Galani · +91 82006 03212');
    expect(notifyMock.success).toHaveBeenCalledWith('2 rows exported as CSV');
  });

  it('answers a search with nothing and filters with nothing differently', async () => {
    const user = userEvent.setup();
    const { router, unmount } = renderPatientsRoutes(
      `${PATIENTS}?q=nobody-at-all`,
      PatientsPage,
    );
    expect(await screen.findByText('No patient matches')).toBeInTheDocument();
    expect(
      screen.getByText('Nothing here yet. Try another tab or search.'),
    ).toBeInTheDocument();
    unmount();

    renderPatientsRoutes(`${PATIENTS}?status=inactive&types=dental`, PatientsPage);
    expect(await screen.findByText('No matches')).toBeInTheDocument();
    await user.click(screen.getByTestId('empty-state-clear-filters'));
    await waitFor(() => expect(rows()).toHaveLength(30));
    expect(router.state.location.search).not.toHaveProperty('status');
  });

  it('keeps the last copy on a failed read and offers Retry for 9s', async () => {
    const user = userEvent.setup();
    renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(30));
    listGate.failing = true;
    await user.click(screen.getByTestId('patients-tab-recall'));
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        'Couldn’t load this list · connection dropped. Showing the last copy.',
        expect.objectContaining({
          duration: 9_000,
          action: expect.objectContaining({ label: 'Retry' }),
        }),
      ),
    );
    expect(rows()).toHaveLength(30);
  });
});

describe('access (§6.5 Access, D9)', () => {
  it('a Therapist views only: no New patient, no row actions', async () => {
    renderPatientsRoutes(PATIENTS, PatientsPage, { role: 'therapist' });
    await waitFor(() => expect(rows()).toHaveLength(30));
    expect(screen.queryByTestId('patients-new')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patients-row-action-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patients-row-action-delete')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('patients-row-action-new-invoice'),
    ).not.toBeInTheDocument();
  });

  it('a Front desk member bills and edits but never deletes', async () => {
    renderPatientsRoutes(PATIENTS, PatientsPage, { role: 'front_desk' });
    await waitFor(() => expect(rows()).toHaveLength(30));
    const dharti = within(rowOf('Dharti Galani'));
    expect(dharti.getByTestId('patients-row-action-new-invoice')).toBeInTheDocument();
    expect(dharti.getByTestId('patients-row-action-edit')).toBeInTheDocument();
    expect(dharti.queryByTestId('patients-row-action-delete')).not.toBeInTheDocument();
  });
});

describe('on a phone (below md)', () => {
  beforeEach(() => {
    viewport.tier = 'phone';
  });

  it('shows rows with Due as the key column, the floating "New patient" and Activity closed', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(30));
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    const cells = within(rowOf('Dharti Galani')).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Dharti Galani');
    expect(cells[1]).toHaveTextContent(/₹/);
    expect(
      rowOf('Dharti Galani').querySelector('[data-slot="data-table-meta"]'),
    ).toHaveTextContent(/^Type Aesthetic Status Regular Follow-up .+ #3508$/);
    expect(screen.getByTestId('patients-fab')).toContainElement(
      screen.getByTestId('patients-new'),
    );
    await user.click(within(rowOf('Dharti Galani')).getByText('Dharti Galani'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ activity: 'closed' }),
    );
  });
});
