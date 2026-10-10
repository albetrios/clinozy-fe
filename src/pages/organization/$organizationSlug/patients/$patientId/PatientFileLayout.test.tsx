import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { fetchPersonAppointments } from '@/shared/api/clinic/appointments-api.ts';
import { fetchContactThread } from '@/shared/api/clinic/contact-activities-api.ts';
import { fetchTeamDirectory } from '@/shared/api/clinic/directory-api.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { findMyMembershipId } from '@/shared/tenancy/my-membership.ts';
import { DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from './__tests__/integration/patient-file-test-router.tsx';

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
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notify: notifyMock,
}));

// The file's read, and what its bar, rail, Activity and Visits read beside it.
vi.mock('@/shared/api/clinic/patient-file-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatientFile: vi.fn(),
}));
// What she owes, over all her invoices — nothing (the rail's "All paid", Payment's "Nothing due").
vi.mock('@/shared/api/clinic/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchInvoiceTotals: vi.fn(async () => ({ due: 0, paid: 0, count: 0 })),
  listInvoices: vi.fn(async () => ({ rows: [], next: null, total: 0, totals: null })),
}));
vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPersonAppointments: vi.fn(),
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
// The Activity chat names offerings from the one catalogue: none here.
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllOfferings: vi.fn(async () => []),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(),
}));
vi.mock('@/shared/api/clinic/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchContactThread: vi.fn(),
  fetchContactMessagingStatus: vi.fn(async () => ({ whatsappDown: false })),
  fetchContactTemplateValues: vi.fn(async () => ({
    clinicName: 'Cresence Skin',
    address: '',
    mapsLink: '',
    reviewLink: '',
    freeSlots: [],
  })),
}));
// Start visit / Resume over an in-memory open visit (today's checked-in booking) — its own read
// is `useVisits`' to test.
const visits = vi.hoisted(() => ({ open: null as { appointmentId: string } | null }));
vi.mock('@/shared/hooks/useVisits/index.ts', async (importOriginal) => {
  const { useQuery } = await import('@tanstack/react-query');
  return {
    ...(await importOriginal<object>()),
    useOpenVisit: (patientId: string) =>
      useQuery({
        queryKey: ['test', 'open-visit', patientId],
        queryFn: async () => visits.open,
        enabled: patientId !== '',
      }),
  };
});

const LIST = '/organization/acme/patients';
const at = (rest = '') => patientFileUrl(TEST_PATIENT_ID, rest);

/** The file clinozy-be answers for Priya — a visit booked, nothing else yet. */
let served: PatientFile;

const layout = () => screen.getByTestId('patient-file-layout');
const tabs = () =>
  within(screen.getByRole('tablist', { name: 'Patient sections' }))
    .getAllByRole('tab')
    .map((tab) => tab.textContent);

/** End View-as: the member signed in, holding exactly these codes. */
function signedInWith(codes: OrganizationPermission[]) {
  act(() => {
    useUIStore.setState({ previewRole: null });
    useOrganizationStore.getState().setPermissions(['organization:read', ...codes]);
  });
}

beforeEach(() => {
  viewport.tier = 'desktop';
  visits.open = null;
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  served = patientFile({
    nextVisit: {
      appointmentId: 'appt_next00000000000000000',
      date: '2026-10-10',
      startTime: '11:00',
      serviceLabel: 'Hydrafacial',
    },
  });
  vi.mocked(fetchPatientFile).mockReset();
  vi.mocked(fetchPatientFile).mockImplementation(async (patientId) => {
    if (patientId !== TEST_PATIENT_ID) {
      throw new HttpError('Not Found', 404, `/app/patients/${patientId}`, 'GET');
    }
    return served;
  });
  vi.mocked(fetchPersonAppointments).mockResolvedValue([]);
  vi.mocked(fetchTeamDirectory).mockResolvedValue([DOCTOR_NISHA]);
  vi.mocked(findMyMembershipId).mockResolvedValue(DOCTOR_NISHA.id);
  vi.mocked(fetchContactThread).mockResolvedValue({
    thread: null,
    messages: [],
    authors: {},
  });
});
afterEach(() => {
  resetPatientFile();
});

describe('the patient file layout (KICKOFF §6.6)', () => {
  it('lands on the Overview, keeping the list’s `activity`', async () => {
    const { router } = renderPatientFile(`${at()}?activity=open`);
    await waitFor(() => expect(router.state.location.pathname).toBe(at('/timeline')));
    expect(router.state.location.search).toMatchObject({ activity: 'open' });
    expect(await screen.findByTestId('patient-section-timeline')).toBeInTheDocument();
    expect(fetchPatientFile).toHaveBeenCalledWith(TEST_PATIENT_ID);
  });

  it('sends an unknown section to the Overview (S:33)', async () => {
    const { router } = renderPatientFile(at('/secret'));
    await waitFor(() => expect(router.state.location.pathname).toBe(at('/timeline')));
  });

  it('shows the skeleton while the file opens', async () => {
    vi.mocked(fetchPatientFile).mockReturnValue(new Promise(() => undefined));
    renderPatientFile(at('/visits'));
    expect(await screen.findByTestId('skeleton-rows')).toHaveTextContent(
      'Opening the patient file',
    );
    expect(screen.queryByTestId('patient-file-back')).not.toBeInTheDocument();
  });

  it('draws the file bar: Back, the breadcrumb, the pinned tabs and the open one', async () => {
    const { container } = renderPatientFile(at('/timeline'));
    await screen.findByTestId('patient-section-timeline');
    expect(screen.getByTestId('patient-file-back')).toHaveAccessibleName(
      'Back to patients',
    );
    expect(
      screen.getAllByRole('heading', { level: 1, name: 'Priya Shah' }),
    ).not.toHaveLength(0);
    // The default pins (D26), then the open Overview, unpinned (its dot) — once access answers.
    await waitFor(() => expect(tabs()).toHaveLength(5));
    expect(tabs()).toEqual([
      'Clinical notes',
      'Visits',
      'Prescriptions',
      'Invoices',
      'OverviewNot pinned · shown while open',
    ]);
    expect(screen.getByTestId('patient-file-tab-timeline')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The identity line is always masked.
    expect(layout()).toHaveTextContent('#3508 · +91 ••••• •3210');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('moves between the tabs with ← / →, opening each', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(at('/visits'));
    await screen.findByTestId('patient-section-visits');
    (await screen.findByTestId('patient-file-tab-visits')).focus();
    await user.keyboard('{ArrowRight}');
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(at('/prescriptions')),
    );
    await waitFor(() =>
      expect(screen.getByTestId('patient-file-tab-prescriptions')).toHaveFocus(),
    );
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    await waitFor(() => expect(router.state.location.pathname).toBe(at('/overview')));
  });

  it('opens Activity from a link, then keeps the session’s choice', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(`${at('/visits')}?activity=open`);
    await screen.findByTestId('patient-file-activity-column');
    const toggle = screen.getByTestId('patient-file-activity');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(toggle).toHaveAccessibleName('Hide messages & activity');
    expect(layout()).toHaveAttribute('data-activity', 'open');

    await user.click(toggle);
    await waitFor(() =>
      expect(
        screen.queryByTestId('patient-file-activity-column'),
      ).not.toBeInTheDocument(),
    );
    expect(router.state.location.search).not.toHaveProperty('activity');
    expect(useUIStore.getState().fileActivityOpen).toBe(false);
    expect(screen.getByTestId('patient-file-activity')).toHaveAccessibleName(
      'Show messages & activity',
    );
    // Another section, no `activity`: the column stays as it was left.
    await user.click(await screen.findByTestId('patient-file-tab-prescriptions'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(at('/prescriptions')),
    );
    expect(layout()).toHaveAttribute('data-activity', 'closed');
  });

  it('starts with Activity closed on a phone and open from md (no link, no state)', async () => {
    viewport.tier = 'phone';
    const phone = renderPatientFile(at('/visits'));
    await screen.findByTestId('patient-section-visits');
    expect(layout()).toHaveAttribute('data-activity', 'closed');
    phone.unmount();

    viewport.tier = 'tablet';
    renderPatientFile(at('/visits'));
    await screen.findByTestId('patient-file-activity-column');
    expect(layout()).toHaveAttribute('data-activity', 'open');
  });

  it('dots Activity while the patient waits for a reply and it is closed', async () => {
    served = patientFile({ awaitingReply: true });
    viewport.tier = 'phone';
    renderPatientFile(at('/visits'));
    const toggle = await screen.findByTestId('patient-file-activity');
    expect(
      within(toggle).getByTestId('patient-file-activity-awaiting'),
    ).toBeInTheDocument();
  });

  it('shows the rail from lg while Activity is closed and from xl while open (D23)', async () => {
    renderPatientFile(at('/visits'));
    const rail = await screen.findByTestId('patient-rail');
    expect(rail).toHaveClass(
      'hidden',
      'lg:group-data-[activity=closed]/file:flex',
      'xl:flex',
    );
    expect(layout()).toHaveClass('group/file');
  });

  it('fills the rail from the file: the next visit, and what she owes from the server', async () => {
    renderPatientFile(at('/visits'));
    const upNext = await screen.findByRole('region', { name: 'Up next' });
    expect(upNext).toHaveTextContent('Hydrafacial');
    expect(screen.getByTestId('patient-rail-book')).toHaveTextContent('Reschedule');
    // `meta.due_total` is 0 here: "All paid", no due card.
    expect(
      await within(upNext).findByTestId('patient-rail-all-paid'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('patient-rail-due')).not.toBeInTheDocument();
  });

  it('opens a section from the sections popover and pins one to the bar', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(at('/visits'));
    await screen.findByTestId('patient-section-visits');
    await user.click(screen.getByTestId('patient-file-sections'));
    const panel = await screen.findByTestId('patient-file-sections-panel');
    expect(panel).toHaveAccessibleName('Patient file sections');
    expect(within(panel).getByRole('group', { name: 'Billing' })).toBeInTheDocument();
    expect(
      within(panel).getByTestId('patient-file-sections-tile-visits'),
    ).toHaveTextContent('Open now');
    expect(panel).not.toHaveTextContent(/Empty|Has records/);

    await user.click(within(panel).getByTestId('patient-file-sections-pin-images'));
    // The bar behind the (modal) popover gains the pin at once.
    await waitFor(() =>
      expect(screen.getByTestId('patient-file-tab-images')).toHaveTextContent('Photos'),
    );
    await user.click(within(panel).getByTestId('patient-file-sections-tile-reports'));
    await waitFor(() => expect(router.state.location.pathname).toBe(at('/reports')));
    expect(screen.queryByTestId('patient-file-sections-panel')).not.toBeInTheDocument();
  });

  it('offers each Add-to-record item the member may use', async () => {
    const user = userEvent.setup();
    renderPatientFile(at('/visits'), { role: 'front_desk' });
    await screen.findByTestId('patient-section-visits');
    await user.click(screen.getByTestId('patient-file-add'));
    const menu = await screen.findByTestId('patient-file-add-menu');
    expect(within(menu).getByText('Add for Priya')).toBeInTheDocument();
    // Front desk: no Rx or treatment (the role-named gates, S:35, 38); Invoice and Payment.
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.dataset.testid),
    ).toEqual(
      ['invoice', 'payment', 'photo', 'appointment', 'report', 'note'].map(
        (id) => `patient-file-add-menu-${id}`,
      ),
    );
  });

  it('shows a Therapist the treatment gate but no Rx and no billing in the Add menu', async () => {
    const user = userEvent.setup();
    renderPatientFile(at('/visits'), { role: 'therapist' });
    await screen.findByTestId('patient-section-visits');
    await user.click(screen.getByTestId('patient-file-add'));
    const menu = await screen.findByTestId('patient-file-add-menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.dataset.testid),
    ).toEqual(
      ['treatment', 'photo', 'appointment', 'report', 'note'].map(
        (id) => `patient-file-add-menu-${id}`,
      ),
    );
  });

  it('sends a member with Payments but no Patients view to Invoices and shows the billing sections alone (Q-F1)', async () => {
    const { router } = renderPatientFile(at('/timeline'), {
      codes: ['organization:read', 'payment:read', 'payment:create'],
    });
    await waitFor(() => expect(router.state.location.pathname).toBe(at('/invoices')));
    await screen.findByTestId('patient-section-invoices');
    await waitFor(() => expect(tabs()).toEqual(['Invoices']));
  });

  it('sends a signed-in member without the clinical record code from Clinical notes to the Overview', async () => {
    const { router } = renderPatientFile(at('/visits'));
    await screen.findByTestId('patient-section-visits');
    signedInWith(['patient:read']);
    await waitFor(() => expect(tabs()).not.toContain('Clinical notes'));
    expect(tabs()).toContain('Visits');

    await act(() => router.navigate({ href: at('/overview') }));
    await waitFor(() => expect(router.state.location.pathname).toBe(at('/timeline')));
  });

  it('shows a signed-in member Clinical notes and Prescriptions with their read codes', async () => {
    renderPatientFile(at('/visits'));
    await screen.findByTestId('patient-section-visits');
    signedInWith([
      'patient:read',
      'patient:clinical_record:read',
      'patient_prescription:read',
    ] as OrganizationPermission[]);
    await waitFor(() =>
      expect(tabs()).toEqual(['Clinical notes', 'Visits', 'Prescriptions']),
    );
  });

  it('goes back to the list on an Esc nothing else takes', async () => {
    const { router } = renderPatientFile(at('/visits'));
    await screen.findByTestId('patient-section-visits');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
  });

  it('keeps the file on an Esc typed into a field', async () => {
    const { router } = renderPatientFile(`${at('/visits')}?activity=open`);
    const column = await screen.findByTestId('patient-file-activity-column');
    const box = await within(column).findByRole('textbox');
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(router.state.location.pathname).toBe(at('/visits'));
  });

  it('says "Patient not found" and goes back to the list for a deleted patient', async () => {
    const { router } = renderPatientFile(
      patientFileUrl('pat_gone00000000000000000', '/visits'),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(LIST));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Patient not found · it may have been deleted',
    );
  });

  it('keeps the file where it is and offers Retry when the read fails otherwise', async () => {
    vi.mocked(fetchPatientFile).mockRejectedValue(new TypeError('Failed to fetch'));
    const { router } = renderPatientFile(at('/visits'));
    await waitFor(
      () =>
        expect(notifyMock.error).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            id: `list-error:patient-file:${TEST_PATIENT_ID}`,
            action: expect.objectContaining({ label: 'Retry' }),
          }),
        ),
      { timeout: 8000 },
    );
    expect(router.state.location.pathname).toBe(at('/visits'));
    expect(notifyMock.info).not.toHaveBeenCalled();
  }, 12_000);

  it('opens Edit patient over the section it came from, and closes back to it', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(at('/visits'));
    await screen.findByTestId('patient-section-visits');
    await user.click(screen.getByTestId('patient-rail-edit'));
    await waitFor(() => expect(router.state.location.pathname).toBe(at('/edit')));
    expect(router.state.location.search).toMatchObject({ from: 'visits' });
    expect(await screen.findByTestId('patient-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('patient-section-visits')).toBeInTheDocument();

    await user.click(screen.getByTestId('patient-drawer-close'));
    await waitFor(() => expect(router.state.location.pathname).toBe(at('/visits')));
  });

  it('offers Start visit with no visit open, and Resume while one is', async () => {
    const plain = renderPatientFile(at('/visits'));
    expect(await screen.findByTestId('patient-file-start-visit')).toBeInTheDocument();
    expect(screen.queryByText('Visit in progress · Resume')).not.toBeInTheDocument();
    plain.unmount();

    visits.open = { appointmentId: 'appt_priya000000000000000' };
    renderPatientFile(at('/visits'));
    expect(await screen.findByText('Visit in progress · Resume')).toBeInTheDocument();
    expect(screen.queryByTestId('patient-file-start-visit')).not.toBeInTheDocument();
  });
});
