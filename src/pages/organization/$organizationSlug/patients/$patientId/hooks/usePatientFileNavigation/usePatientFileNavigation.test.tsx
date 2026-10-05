import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import type {
  PatientFile,
  PatientNextVisit,
} from '@/shared/api/clinic/patient-file-contracts.ts';
import { fetchOpenVisit, startVisit } from '@/shared/api/clinic/visits-api.ts';
import { viewablePatientFileSections } from '@/shared/clinic/patient-file-sections.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../__tests__/integration/patient-file-test-router.tsx';
import { usePatientFileNavigation } from './usePatientFileNavigation.ts';

const DHARTI = patientRef('Dharti Galani');
const FILE = `/organization/acme/patients/${DHARTI}`;
const NEXT: PatientNextVisit = {
  appointmentId: 'appointment-next',
  date: '2026-10-10',
  startTime: '11:00',
  serviceLabel: 'Hydrafacial',
  durationMin: 45,
};
let file: PatientFile;

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
    collect: navigation.railActions.onCollect,
    feedback: navigation.railActions.onFeedback,
    historySection: () =>
      navigation.openHistory({
        kind: 'patientFile',
        patientId: DHARTI,
        section: 'invoices',
      }),
    historyVisit: () =>
      navigation.openHistory({ kind: 'appointment', appointmentId: 'appointment-old' }),
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
    file,
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

beforeEach(async () => {
  resetClinicFixtures();
  file = await fetchPatientFile(DHARTI);
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('usePatientFileNavigation', () => {
  it('opens a section and goes back to the list', async () => {
    expect((await follow('reports')).pathname).toBe(`${FILE}/reports`);
    expect((await follow('list')).pathname).toBe('/organization/acme/patients');
  });

  it('starts a visit and opens its flow on the Overview (D18)', async () => {
    expect(await fetchOpenVisit(DHARTI)).toBeNull();
    const started = await follow('startVisit');
    expect(started.pathname).toBe(`${FILE}/timeline`);
    expect(started.search).toEqual({ visit: 'open' });
    expect(await fetchOpenVisit(DHARTI)).not.toBeNull();
  });

  it('offers Resume instead of Start visit while a visit is open', async () => {
    await startVisit({ patientId: DHARTI });
    const { unmount } = renderInPatientFile(<NavigationProbe />, {
      file,
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

  it('opens Edit patient over the open section (A-F1)', async () => {
    const location = await follow('editContact', { section: 'prescriptions' });
    expect(location.pathname).toBe(`${FILE}/edit`);
    expect(location.search).toEqual({ from: 'prescriptions' });
  });

  it('books a new visit for this patient, or reschedules the next one, keeping the file', async () => {
    const book = await follow('book');
    expect(book.pathname).toBe('/organization/acme/appointments/create');
    // The file stays behind the booking (A-P1).
    expect(book.page).toBe(`${FILE}/visits`);
    expect(book.search).toEqual({ who: DHARTI, from: `patients/${DHARTI}/visits` });

    const reschedule = await follow('reschedule');
    expect(reschedule.pathname).toBe('/organization/acme/appointments/appointment-next');
    expect(reschedule.search).toEqual({
      mode: 'reschedule',
      from: `patients/${DHARTI}/visits`,
    });
  });

  it('collects a payment and opens Feedback on Clinical notes', async () => {
    const collect = await follow('collect');
    expect(collect.pathname).toBe('/organization/acme/payments/receive');
    expect(collect.search).toEqual({
      patient: DHARTI,
      from: `patients/${DHARTI}/visits`,
    });

    expect((await follow('feedback')).pathname).toBe(`${FILE}/overview`);
  });

  it('follows a history chip to the section or the appointment', async () => {
    expect((await follow('historySection')).pathname).toBe(`${FILE}/invoices`);
    const visit = await follow('historyVisit');
    expect(visit.pathname).toBe('/organization/acme/appointments/appointment-old');
    expect(visit.search).toEqual({ from: `patients/${DHARTI}/visits` });
  });

  it('leaves out what an Accountant can’t do (Q-F1, A-F14)', async () => {
    renderInPatientFile(<NavigationProbe />, {
      file,
      role: 'accountant',
      section: 'invoices',
      viewable: viewablePatientFileSections({ patients: false, billing: true }),
    });
    await screen.findByRole('button', { name: 'collect' });
    for (const hidden of ['startVisit', 'editContact', 'book', 'feedback']) {
      expect(screen.queryByRole('button', { name: hidden })).not.toBeInTheDocument();
    }
  });
});
