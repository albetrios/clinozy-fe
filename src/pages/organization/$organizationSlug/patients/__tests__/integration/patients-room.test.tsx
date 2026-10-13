import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as ContactsApiModule from '@/shared/api/app/contacts-api.ts';
import type * as PatientsApiModule from '@/shared/api/app/patients-api.ts';
import {
  createPatient,
  deletePatient,
  listPatients,
  restorePatient,
} from '@/shared/api/app/patients-api.ts';
import type { PatientListParams } from '@/shared/api/app/patients-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import { PatientsPage } from '../../PatientsPage.tsx';
import {
  DHARTI,
  NOW,
  type PatientsWorld,
  seededPatientsWorld,
} from './patients-test-data.ts';
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

const world = vi.hoisted(() => ({}) as PatientsWorld);
vi.mock('@/shared/api/app/patients-api.ts', async (importOriginal) => {
  const { patientsApiDouble } = await import('./patients-test-data.ts');
  return {
    ...(await importOriginal<typeof PatientsApiModule>()),
    ...patientsApiDouble(world),
  };
});
vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => {
  const { contactsApiDouble } = await import('./patients-test-data.ts');
  return {
    ...(await importOriginal<typeof ContactsApiModule>()),
    ...contactsApiDouble(world),
  };
});

const PATIENTS = '/organization/acme/patients';

const rows = () => screen.getAllByTestId('patients-table-row');
const rowOf = (name: string) => {
  const row = rows().find((candidate) => candidate.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

/** The params of the last list read. */
const lastListParams = (): PatientListParams => {
  const params = vi.mocked(listPatients).mock.lastCall?.[0];
  if (!params) throw new Error('the list was never read');
  return params;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  Object.assign(world, seededPatientsWorld());
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  csv.downloadCsv.mockReset();
  vi.mocked(listPatients).mockClear();
  vi.mocked(createPatient).mockClear();
  vi.mocked(deletePatient).mockClear();
  vi.mocked(restorePatient).mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  resetPatientsRoutes();
});

describe('the Patients room (KICKOFF §6.5)', () => {
  it('lists the roster under the toolbar, ending with "All patients loaded"', async () => {
    const { container } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Patients' }),
    ).toBeInTheDocument();
    const tabs = within(screen.getByTestId('patients-tabs'));
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'All',
      'Follow-up due',
      'Recall',
    ]);
    // Newest first, without a sort; the All view reads everyone.
    expect(lastListParams()).toMatchObject({ view: 'all', sort: undefined });
    expect(rows()[0]).toHaveTextContent('Dharti Galani');
    expect(rows()[0]).toHaveTextContent('+91 82006 03212');
    expect(screen.getByTestId('patients-table-end')).toHaveTextContent(
      'All patients loaded',
    );
    expect(await screen.findByTestId('patients-new')).toHaveTextContent('New patient');
    // The recommended set hides Gender, Conversion and Age; there is no Due column.
    expect(screen.getByTestId('patients-columns-trigger')).toHaveAttribute(
      'title',
      'Columns · 5 of 8 shown',
    );
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent?.trim()),
    ).toEqual(expect.arrayContaining(['ID', 'Patient', 'Type', 'Status', 'Follow-up']));
    expect(screen.queryByRole('columnheader', { name: /Due/ })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: /Gender/ })).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('switches views through the URL; the list read follows', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(screen.getByTestId('patients-tab-follow'));
    await user.keyboard('{Enter}');
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ view: 'follow' }),
    );
    // Follow-up due: today's and the overdue ones.
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(lastListParams()).toMatchObject({ view: 'follow' });
    expect(rowOf('Dharti Galani')).toBeInTheDocument();
    expect(rowOf('Kiran Desai')).toBeInTheDocument();

    await user.click(screen.getByTestId('patients-tab-recall'));
    await user.keyboard('{Enter}');
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(lastListParams()).toMatchObject({ view: 'recall' });
    expect(rows()[0]).toHaveTextContent('Kiran Desai');
  });

  it('sorts on the server from the ID and Follow-up headers: ascending, descending, off', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
    // Only ID and Follow-up sort — the two the API sorts by.
    expect(screen.queryByRole('button', { name: /^Patient/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Updated/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: /^ID/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'seq:asc' }),
    );
    await waitFor(() => expect(rows()[0]).toHaveTextContent('#198'));
    expect(lastListParams()).toMatchObject({ sort: 'seq', order: 'asc' });
    await user.click(screen.getByRole('button', { name: /^ID/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'seq:desc' }),
    );
    await waitFor(() => expect(rows()[0]).toHaveTextContent('#3508'));
    await user.click(screen.getByRole('button', { name: /^ID/ }));
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('sort'));

    await user.click(screen.getByRole('button', { name: /^Follow-up/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ sort: 'followUp:asc' }),
    );
    await waitFor(() => expect(rows()[0]).toHaveTextContent('Kiran Desai'));
    expect(lastListParams()).toMatchObject({ sort: 'followUp', order: 'asc' });
  });

  it('opens the patient file on a row click, Activity open from md', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(within(rowOf('Dharti Galani')).getByText('#3508'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${PATIENTS}/${DHARTI.id}`),
    );
    expect(router.state.location.search).toMatchObject({ activity: 'open' });
  });

  it('offers New invoice, Edit and Delete on a row — no Collect without its dues — and opens Edit over the file', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
    const dharti = within(rowOf('Dharti Galani'));
    expect(dharti.getByTestId('patients-row-action-new-invoice')).toBeInTheDocument();
    expect(dharti.getByTestId('patients-row-action-edit')).toBeInTheDocument();
    expect(dharti.getByTestId('patients-row-action-delete')).toBeInTheDocument();
    expect(dharti.queryByTestId('patients-row-action-collect')).toBeNull();
    await user.click(dharti.getByTestId('patients-row-action-edit'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${PATIENTS}/${DHARTI.id}/edit`),
    );
  });

  it('bills a patient from the row: the Invoice drawer over the list, by her public id', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.click(
      within(rowOf('Dharti Galani')).getByTestId('patients-row-action-new-invoice'),
    );
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/invoices/create'),
    );
    expect(shownLocation(router).search).toEqual({
      type: 'clinic',
      patient: DHARTI.id,
      from: 'patients',
    });
  });

  it('books the person from the contact card: New appointment over the list with who=<contact>', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
    await user.hover(
      within(rowOf('Dharti Galani')).getByRole('button', { name: /Dharti Galani/ }),
    );
    await user.click(await screen.findByTestId('contact-card-new-appointment'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    expect(shownLocation(router).search).toEqual({
      who: DHARTI.contactId,
      from: 'patients',
    });
    // The list stays behind the drawer.
    expect(router.state.location.pathname).toBe(PATIENTS);
  });

  it('opens New patient over the list, its filters kept', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(`${PATIENTS}?view=follow`, PatientsPage);
    await waitFor(() => expect(rows().length).toBeGreaterThan(0));
    await user.click(screen.getByTestId('patients-new'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${PATIENTS}/create`),
    );
    expect(router.state.location.search).toMatchObject({ view: 'follow' });
    const drawer = await screen.findByTestId('patient-drawer');
    expect(within(drawer).getByTestId('patient-drawer-title')).toHaveTextContent(
      'New patient',
    );
    // Cancel closes it back onto the same list.
    await user.click(within(drawer).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(PATIENTS));
    expect(router.state.location.search).toEqual({ view: 'follow' });
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
    await waitFor(() => expect(rows()).toHaveLength(4));
    const reads = vi.mocked(listPatients).mock.calls.length;
    await user.click(within(drawer).getByTestId('patient-drawer-save'));

    await waitFor(() => expect(router.state.location.pathname).toBe(PATIENTS));
    // The prefill's name and mobile leave the URL with the drawer.
    expect(router.state.location.search).toEqual({});
    expect(createPatient).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({ firstName: 'Priya', phone: '+919876500009' }),
        person: 'new',
      }),
    );
    await waitFor(() => expect(rowOf('Priya Shah')).toHaveTextContent('+91 98765 00009'));
    expect(vi.mocked(listPatients).mock.calls.length).toBeGreaterThan(reads);
    expect(rows()).toHaveLength(5);
    expect(screen.queryByTestId('patient-drawer')).not.toBeInTheDocument();
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/^Patient #3509 created/),
      { action: { label: 'Open file', onClick: expect.any(Function) } },
    );

    // The toast's "Open file" goes to the new patient's file.
    const [, options] = notifyMock.success.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    const created = await vi.mocked(createPatient).mock.results[0]?.value;
    options.action.onClick();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${PATIENTS}/${created?.id}`),
    );
  });

  it('sends a create link without Create back to the list with the permission toast', async () => {
    const { router } = renderPatientsRoutes(
      `${PATIENTS}/create?view=recall`,
      PatientsPage,
      { role: 'marketing' },
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(PATIENTS));
    expect(router.state.location.search).toEqual({ view: 'recall' });
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    expect(screen.queryByTestId('patient-drawer')).not.toBeInTheDocument();
  });

  it('removes a patient through the reason confirm, with Undo (D32)', async () => {
    const user = userEvent.setup();
    renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
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
    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(deletePatient).toHaveBeenCalledWith({
      patientId: DHARTI.id,
      reason: 'duplicate',
      note: null,
    });
    expect(notifyMock.undo).toHaveBeenCalledWith('Dharti Galani removed', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(restorePatient).toHaveBeenCalledWith(DHARTI.id, expect.any(String));
  });

  it('exports the selected rows as CSV (Q-P8)', async () => {
    renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
    fireEvent.click(within(rowOf('Dharti Galani')).getByRole('checkbox'));
    fireEvent.click(within(rowOf('Raam Shah')).getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('patients-table-bulk-export'));
    expect(csv.downloadCsv).toHaveBeenCalledTimes(1);
    const [fileName, content] = csv.downloadCsv.mock.calls[0] as [string, string];
    expect(fileName).toBe('patients.csv');
    const [header, ...lines] = content.split('\n');
    expect(header).toBe('ID,Patient,Type,Status,Follow-up,Updated');
    expect(lines).toHaveLength(2);
    expect(lines.join('\n')).toContain('Dharti Galani · +91 82006 03212');
    expect(lines.join('\n')).toContain('Raam Shah · +91 98795 21034');
    expect(notifyMock.success).toHaveBeenCalledWith('2 rows exported as CSV');
  });

  it('answers a search with nothing and filters with nothing differently', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPatientsRoutes(`${PATIENTS}?q=nobody-at-all`, PatientsPage);
    expect(await screen.findByText('No patient matches')).toBeInTheDocument();
    expect(
      screen.getByText('Nothing here yet. Try another tab or search.'),
    ).toBeInTheDocument();
    expect(lastListParams()).toMatchObject({ q: 'nobody-at-all' });
    unmount();

    const { router } = renderPatientsRoutes(
      `${PATIENTS}?status=inactive&types=dental`,
      PatientsPage,
    );
    expect(await screen.findByText('No matches')).toBeInTheDocument();
    // One status, as the API filters it.
    expect(lastListParams()).toMatchObject({ status: 'inactive', types: ['dental'] });
    await user.click(screen.getByTestId('empty-state-clear-filters'));
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(router.state.location.search).not.toHaveProperty('status');
    expect(router.state.location.search).not.toHaveProperty('types');
  });

  it('keeps the last copy on a failed read and offers Retry for 9s', async () => {
    const user = userEvent.setup();
    renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
    world.listFails = true;
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
    expect(rows()).toHaveLength(4);

    world.listFails = false;
    const [, options] = notifyMock.error.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(rows()[0]).toHaveTextContent('Kiran Desai');
  });
});

describe('access (§6.5 Access, D9)', () => {
  it('Marketing views only: no New patient, no row actions', async () => {
    renderPatientsRoutes(PATIENTS, PatientsPage, { role: 'marketing' });
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(screen.queryByTestId('patients-new')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patients-row-action-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patients-row-action-delete')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('patients-row-action-new-invoice'),
    ).not.toBeInTheDocument();
  });

  it('a Front desk member edits but never deletes', async () => {
    renderPatientsRoutes(PATIENTS, PatientsPage, { role: 'front_desk' });
    await waitFor(() => expect(rows()).toHaveLength(4));
    const dharti = within(rowOf('Dharti Galani'));
    expect(dharti.getByTestId('patients-row-action-edit')).toBeInTheDocument();
    expect(dharti.queryByTestId('patients-row-action-delete')).not.toBeInTheDocument();
  });
});

describe('on a phone (below md)', () => {
  beforeEach(() => {
    viewport.tier = 'phone';
  });

  it('shows rows with Type as the key column, the floating "New patient" and Activity closed', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientsRoutes(PATIENTS, PatientsPage);
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    const cells = within(rowOf('Dharti Galani')).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent('Dharti Galani');
    // No Due: the Type is the key column now, and the rest folds into the meta line.
    expect(cells[1]).toHaveTextContent('Aesthetic');
    expect(rowOf('Dharti Galani')).not.toHaveTextContent('₹');
    expect(
      rowOf('Dharti Galani').querySelector('[data-slot="data-table-meta"]'),
    ).toHaveTextContent(/^Status Regular Follow-up .+ #3508$/);
    expect(screen.getByTestId('patients-fab')).toContainElement(
      await screen.findByTestId('patients-new'),
    );
    await user.click(within(rowOf('Dharti Galani')).getByText('Dharti Galani'));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ activity: 'closed' }),
    );
  });
});
