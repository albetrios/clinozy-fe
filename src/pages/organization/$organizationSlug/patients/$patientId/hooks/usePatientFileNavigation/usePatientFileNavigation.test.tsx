import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type { PatientNextVisit } from '@/shared/api/clinic/patient-file-contracts.ts';
import { viewablePatientFileSections } from '@/shared/clinic/patient-file-sections.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import {
  patientFile,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../__tests__/integration/patient-file-test-router.tsx';
import { usePatientFileNavigation } from './usePatientFileNavigation.ts';

// The open visit (today's checked-in booking) and Start visit over an in-memory booking —
// their own reads and writes are `useVisits`' to test.
const visits = vi.hoisted(() => ({
  open: null as { appointmentId: string } | null,
  start: (() => undefined) as (vars: { patientId: string }) => void,
}));
vi.mock('@/shared/hooks/useVisits/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useOpenVisit: () => ({ data: visits.open }),
  useStartVisit: () => ({
    mutate: (vars: { patientId: string }, options?: { onSuccess?: () => void }) => {
      visits.start(vars);
      visits.open = { appointmentId: 'appt_priya000000000000000' };
      options?.onSuccess?.();
    },
  }),
}));

// What she owes, for the Add menu's Payment — its own reads are `useInvoices`' to test.
vi.mock('@/shared/api/clinic/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchInvoiceTotals: vi.fn(async () => ({ due: 100, paid: 0, count: 1 })),
}));

const FILE = `/organization/acme/patients/${TEST_PATIENT_ID}`;
const NEXT: PatientNextVisit = {
  appointmentId: 'appt_next00000000000000000',
  date: '2026-10-10',
  startTime: '11:00',
  serviceLabel: 'Hydrafacial',
};

/** Each link as a button; a hidden one is left out. */
function NavigationProbe() {
  const navigation = usePatientFileNavigation();
  const links: Record<string, (() => void) | undefined> = {
    reports: () => navigation.openSection('reports'),
    list: navigation.backToList,
    startVisit: navigation.startVisit,
    resumeVisit: navigation.resumeVisit,
    editContact: navigation.editContact,
    book: navigation.railActions.onBook && (() => navigation.railActions.onBook?.(null)),
    reschedule:
      navigation.railActions.onBook && (() => navigation.railActions.onBook?.(NEXT)),
    feedback: navigation.railActions.onFeedback,
    collect: navigation.railActions.onCollect,
    historySection: () =>
      navigation.openHistory({
        kind: 'patientFile',
        patientId: TEST_PATIENT_ID,
        section: 'invoices',
      }),
    historyVisit: () =>
      navigation.openHistory({
        kind: 'appointment',
        appointmentId: 'appt_old000000000000000000',
      }),
    bookAppointment: navigation.bookAppointment,
  };
  return (
    <div>
      {Object.entries(links).map(([name, run]) =>
        run ? (
          <button key={name} type="button" onClick={run}>
            {name}
          </button>
        ) : null,
      )}
    </div>
  );
}

/** Click a link, then return where it went (the probe unmounts). */
async function follow(
  name: string,
  options: Parameters<typeof renderInPatientFile>[1] = {},
) {
  const user = userEvent.setup();
  const { router, unmount } = renderInPatientFile(<NavigationProbe />, {
    file: patientFile(),
    ...options,
  });
  const start = shownLocation(router).href;
  await user.click(await screen.findByRole('button', { name }));
  await waitFor(() => expect(shownLocation(router).href).not.toBe(start));
  // Where it went as the URL bar shows it; `page` is the router's page behind.
  const { pathname, search } = shownLocation(router);
  const page = router.state.location.pathname;
  unmount();
  return { pathname, search, page };
}

/** End View-as: the member signed in, holding exactly these codes. */
function signedInWith(codes: OrganizationPermission[]) {
  act(() => {
    useUIStore.setState({ previewRole: null });
    useOrganizationStore.getState().setPermissions(['organization:read', ...codes]);
  });
}

beforeEach(() => {
  visits.open = null;
  visits.start = vi.fn();
});
afterEach(() => {
  resetPatientFile();
});

describe('usePatientFileNavigation', () => {
  it('opens a section and goes back to the list', async () => {
    expect((await follow('reports')).pathname).toBe(`${FILE}/reports`);
    expect((await follow('list')).pathname).toBe('/organization/acme/patients');
  });

  it('starts a visit and opens its flow on the Overview (D18)', async () => {
    const started = await follow('startVisit');
    expect(visits.start).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: TEST_PATIENT_ID }),
    );
    expect(started.pathname).toBe(`${FILE}/timeline`);
    expect(started.search).toEqual({ visit: 'open' });
  });

  it('offers Resume instead of Start visit while a visit is open', async () => {
    visits.open = { appointmentId: 'appt_priya000000000000000' };
    const { unmount } = renderInPatientFile(<NavigationProbe />, {
      file: patientFile(),
      section: 'visits',
    });
    expect(
      await screen.findByRole('button', { name: 'resumeVisit' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'startVisit' })).not.toBeInTheDocument();
    unmount();

    const resumed = await follow('resumeVisit', { section: 'invoices' });
    expect(resumed).toMatchObject({
      pathname: `${FILE}/timeline`,
      search: { visit: 'open' },
    });
  });

  it('offers no Start visit to a member who can’t open the Overview', async () => {
    renderInPatientFile(<NavigationProbe />, {
      file: patientFile(),
      section: 'visits',
      viewable: ['visits', 'invoices'],
    });
    await screen.findByRole('button', { name: 'list' });
    expect(screen.queryByRole('button', { name: 'startVisit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'feedback' })).not.toBeInTheDocument();
  });

  it('opens Edit patient over the open section (A-F1)', async () => {
    const location = await follow('editContact', { section: 'prescriptions' });
    expect(location.pathname).toBe(`${FILE}/edit`);
    expect(location.search).toEqual({ from: 'prescriptions' });
  });

  it('books a new visit for the patient’s person, or reschedules the next one, keeping the file', async () => {
    const book = await follow('book');
    expect(book.pathname).toBe('/organization/acme/appointments/create');
    // The booking is the person's: `who=` their contact id.
    expect(book.search).toEqual({
      who: TEST_CONTACT_ID,
      from: `patients/${TEST_PATIENT_ID}/visits`,
    });

    const reschedule = await follow('reschedule');
    expect(reschedule.pathname).toBe(
      '/organization/acme/appointments/appt_next00000000000000000',
    );
    expect(reschedule.search).toEqual({
      mode: 'reschedule',
      from: `patients/${TEST_PATIENT_ID}/visits`,
    });
  });

  it('keeps the file behind the booking and the reschedule (A-P1)', async () => {
    // The file's `from` (`patients/pat_…/visits`) names the page the drawer opens over.
    expect((await follow('book')).page).toBe(`${FILE}/visits`);
    expect((await follow('reschedule')).page).toBe(`${FILE}/visits`);
  });

  it('books from the Activity column for the person too', async () => {
    const book = await follow('bookAppointment', { section: 'overview' });
    expect(book.pathname).toBe('/organization/acme/appointments/create');
    expect(book.search).toEqual({
      who: TEST_CONTACT_ID,
      from: `patients/${TEST_PATIENT_ID}/overview`,
    });
  });

  it('books with no person while the file is still loading', async () => {
    const book = await follow('book', { file: undefined });
    expect(book.pathname).toBe('/organization/acme/appointments/create');
    expect(book.search).not.toHaveProperty('who');
  });

  it('opens Feedback on Clinical notes', async () => {
    expect((await follow('feedback')).pathname).toBe(`${FILE}/overview`);
  });

  it('collects from her in Receive payment over the open section (A-P1)', async () => {
    const collect = await follow('collect', { section: 'invoices' });
    expect(collect.pathname).toBe('/organization/acme/payments/receive');
    expect(collect.search).toEqual({
      patient: TEST_PATIENT_ID,
      from: `patients/${TEST_PATIENT_ID}/invoices`,
    });
    expect(collect.page).toBe(`${FILE}/invoices`);
  });

  it('follows a history chip to the section or the appointment', async () => {
    expect((await follow('historySection')).pathname).toBe(`${FILE}/invoices`);
    const visit = await follow('historyVisit');
    expect(visit.pathname).toBe(
      '/organization/acme/appointments/appt_old000000000000000000',
    );
    expect(visit.search).toEqual({ from: `patients/${TEST_PATIENT_ID}/visits` });
  });

  it('leaves out what an Accountant can’t do (Q-F1, A-F14)', async () => {
    renderInPatientFile(<NavigationProbe />, {
      file: patientFile(),
      role: 'accountant',
      section: 'invoices',
      viewable: viewablePatientFileSections({ patients: false, billing: true }),
    });
    await screen.findByRole('button', { name: 'historySection' });
    for (const hidden of ['startVisit', 'editContact', 'book', 'feedback']) {
      expect(screen.queryByRole('button', { name: hidden })).not.toBeInTheDocument();
    }
  });

  it('asks a signed-in member’s own codes for Edit contact and Book', async () => {
    renderInPatientFile(<NavigationProbe />, { file: patientFile() });
    await screen.findByRole('button', { name: 'editContact' });

    signedInWith(['patient:read']);
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'editContact' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'book' })).not.toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'collect' })).not.toBeInTheDocument();

    signedInWith(['patient:read', 'patient:update', 'appointment:create']);
    expect(
      await screen.findByRole('button', { name: 'editContact' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'book' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'bookAppointment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'collect' })).not.toBeInTheDocument();

    signedInWith(['patient:read', 'payment:create']);
    expect(await screen.findByRole('button', { name: 'collect' })).toBeInTheDocument();
  });
});
