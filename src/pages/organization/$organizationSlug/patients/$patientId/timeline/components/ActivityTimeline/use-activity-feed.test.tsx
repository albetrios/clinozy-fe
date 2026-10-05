import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/clinic/patient-file-sections.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { ActivityTimeline } from './ActivityTimeline.tsx';

const DHARTI = patientRef('Dharti Galani');
const FILE = `/organization/acme/patients/${DHARTI}`;
let file: PatientFile;

/** The row whose text starts with `start`. */
const row = (start: RegExp) => screen.findByRole('button', { name: start });

beforeEach(async () => {
  resetClinicFixtures();
  file = await fetchPatientFile(DHARTI);
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('useActivityFeed (KICKOFF §6.6 Activity timeline, H:4840–4864)', () => {
  it('merges the patient’s records in the viewer’s words, money masked with the file', async () => {
    renderInPatientFile(<ActivityTimeline />, { file, section: 'timeline' });
    expect(await row(/^Rx #497 · Sunscreen SPF 50/)).toHaveTextContent('Avoid sun 48h');
    expect(await row(/^LHR Full Face · session 1/)).toHaveTextContent('Skin · laser');
    expect(await row(/^Received ₹ •••• · UPI/)).toHaveTextContent('Against #782');
    expect(await row(/^Medical invoice #788/)).toHaveTextContent('₹ •••• due');
    expect(await row(/^ConsultationCompleted/)).toBeInTheDocument();
    expect(await row(/^3 photos/)).toBeInTheDocument();
    expect(await row(/^Clinic visited/)).toBeInTheDocument();
    for (const chip of ['Visits · 3', 'Invoices · 4', 'Payments · 1', 'Notes · 2']) {
      expect(screen.getByRole('tab', { name: chip })).toBeInTheDocument();
    }
  });

  it('shows the amounts when the file shows them', async () => {
    renderInPatientFile(<ActivityTimeline />, {
      file,
      section: 'timeline',
      masked: false,
    });
    expect(await row(/^Received ₹[\d,]+ · UPI/)).toBeInTheDocument();
  });

  it('leaves billing out for a member without billing view', async () => {
    renderInPatientFile(<ActivityTimeline />, {
      file,
      section: 'timeline',
      role: 'doctor',
      viewable: PATIENT_FILE_SECTIONS.filter(
        (section) => section !== 'invoices' && section !== 'payments',
      ),
    });
    expect(await row(/^Rx #497/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Invoices/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Received/ })).not.toBeInTheDocument();
  });

  it.each([
    [/^Rx #497/, new RegExp(`^${FILE}/prescriptions/[^/]+/edit$`), {}],
    [/^LHR Full Face · session 1/, new RegExp(`^${FILE}/treatments/[^/]+/edit$`), {}],
    [
      /^Medical invoice #788/,
      /^\/organization\/acme\/invoices\/[^/]+\/edit$/,
      { from: `patients/${DHARTI}/timeline` },
    ],
    [/^Received/, new RegExp(`^${FILE}/payments$`), {}],
    [/^3 photos/, new RegExp(`^${FILE}/images$`), { album: 'lhr' }],
    [/^Clinic visited/, new RegExp(`^${FILE}/notes$`), {}],
    [/^ConsultationCompleted/, new RegExp(`^${FILE}/visits$`), {}],
  ])('opens %s where it lives', async (name, path, search) => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActivityTimeline />, {
      file,
      section: 'timeline',
    });
    await user.click(await row(name));
    await waitFor(() => expect(shownLocation(router).pathname).toMatch(path));
    expect(shownLocation(router).search).toMatchObject(search);
  });

  it('says so for a patient with no records', async () => {
    const kavya = await fetchPatientFile(patientRef('Kavya Joshi'));
    renderInPatientFile(<ActivityTimeline />, { file: kavya, section: 'timeline' });
    expect(await screen.findByText('No activity yet')).toBeInTheDocument();
  });
});
