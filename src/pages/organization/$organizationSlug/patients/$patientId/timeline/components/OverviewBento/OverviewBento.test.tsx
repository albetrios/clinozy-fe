import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type {
  ClinicalNote,
  ClinicalNoteKind,
} from '@/shared/api/app/clinical-notes-contracts.ts';
import type { ContactActivityEntry } from '@/shared/api/app/contact-activities-api.ts';
import type { PatientPhoto } from '@/shared/api/app/patient-images-contracts.ts';
import type { PatientPackageRow } from '@/shared/api/app/patient-packages-contracts.ts';
import type { PatientReport } from '@/shared/api/app/patient-reports-contracts.ts';
import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';
import type { TreatmentRecord } from '@/shared/api/app/treatments-contracts.ts';
import {
  PATIENT_FILE_SECTIONS,
  type PatientFileSectionSlug,
} from '@/shared/app/patient-file-sections.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import {
  APPOINTMENT_TODAY,
  appointmentRow,
  DOCTOR_NISHA,
} from '@/tests/utils/appointment-doubles.ts';
import {
  patientFile,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';
import { invoiceRecord } from '@/tests/utils/payments-doubles.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  patientFileUrl,
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import type { PatientPhotoUploads } from '../../../shared/hooks/usePatientPhotoUpload/index.ts';
import { OverviewBento } from './OverviewBento.tsx';
import type * as SmartNoteModule from './smart-note.ts';
import { loadSmartNoteReading } from './smart-note.ts';

vi.mock('./smart-note.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof SmartNoteModule>();
  return { ...actual, loadSmartNoteReading: vi.fn(actual.loadSmartNoteReading) };
});

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
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** What clinozy-be holds for Priya — each card's read answers from it. */
const server = vi.hoisted(() => ({
  clinical: [] as ClinicalNote[],
  next: 0,
  notes: [] as ContactActivityEntry[],
  failPackages: false,
}));

vi.mock('@/shared/api/app/clinical-notes-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listClinicalNotes: vi.fn(async () => structuredClone(server.clinical)),
  createClinicalNote: vi.fn(
    async ({ kind, text }: { kind: ClinicalNoteKind; text: string }) => {
      server.next += 1;
      const created = clinicalNote(`pcn_new${server.next}`, kind, text);
      server.clinical.push(created);
      return created;
    },
  ),
}));
vi.mock('@/shared/api/app/contact-activities-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listContactActivities: vi.fn(async () => ({
    rows: structuredClone(server.notes),
    next: null,
    hasMore: false,
    total: server.notes.length,
  })),
  sendContactActivity: vi.fn(async ({ body }: { body: string }) => {
    server.notes.unshift(teamNote('msg_posted', body));
    return { id: 'msg_posted' };
  }),
}));
vi.mock('@/shared/api/app/prescriptions-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientPrescriptions: vi.fn(),
  listRxMedicines: vi.fn(),
}));
vi.mock('@/shared/api/app/treatments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientTreatments: vi.fn(),
}));
vi.mock('@/shared/api/app/patient-packages-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientPackages: vi.fn(async () => {
    if (server.failPackages) throw new Error('offline');
    return [LHR, PEEL];
  }),
}));
vi.mock('@/shared/api/app/patient-images-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientPhotos: vi.fn(),
}));
vi.mock('@/shared/api/app/patient-reports-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientReports: vi.fn(),
}));
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPersonAppointments: vi.fn(),
}));
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listInvoices: vi.fn(),
  fetchInvoiceTotals: vi.fn(),
}));
vi.mock('@/shared/api/app/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(async () => [DOCTOR_NISHA]),
}));
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => DOCTOR_NISHA.id),
}));

import { fetchPersonAppointments } from '@/shared/api/app/appointments-api.ts';
import {
  createClinicalNote,
  listClinicalNotes,
} from '@/shared/api/app/clinical-notes-api.ts';
import {
  listContactActivities,
  sendContactActivity,
} from '@/shared/api/app/contact-activities-api.ts';
import { fetchInvoiceTotals, listInvoices } from '@/shared/api/app/invoices-api.ts';
import { listPatientPhotos } from '@/shared/api/app/patient-images-api.ts';
import { listPatientPackages } from '@/shared/api/app/patient-packages-api.ts';
import { listPatientReports } from '@/shared/api/app/patient-reports-api.ts';
import {
  listPatientPrescriptions,
  listRxMedicines,
} from '@/shared/api/app/prescriptions-api.ts';
import { listPatientTreatments } from '@/shared/api/app/treatments-api.ts';

const FILE = patientFileUrl(TEST_PATIENT_ID);

/** A clinical note of Priya's. */
function clinicalNote(id: string, kind: ClinicalNoteKind, text: string): ClinicalNote {
  return {
    id,
    patientId: TEST_PATIENT_ID,
    kind,
    text,
    appointmentId: null,
    diagnosisId: null,
    addedAt: '2026-10-01T05:00:00.000Z',
  };
}

/** A team note Nisha wrote. */
function teamNote(id: string, body: string): ContactActivityEntry {
  return {
    id,
    type: 'note',
    group: 'messages',
    body,
    occurredAt: '2026-10-02T10:09:00.000Z',
    authorId: DOCTOR_NISHA.id,
    link: null,
  };
}

const RX: PrescriptionRecord = {
  id: 'rx_five000000000000000000',
  seq: 500,
  patientId: TEST_PATIENT_ID,
  appointmentId: null,
  doctorId: DOCTOR_NISHA.id,
  date: '2026-09-24',
  items: ['Flubolt 400', 'Clonix-B Lotion', 'Clonix-B Lotion'].map((medicineName) => ({
    medicineId: null,
    medicineName,
    doseMorning: 1,
    doseAfternoon: 0,
    doseNight: 1,
    sos: false,
    meal: null,
    timing: null,
    timingText: null,
    bodyPart: null,
    bodyPartText: null,
    qty: 1,
    remarks: null,
  })),
  advice: 'Avoid sun 48h',
  labReport: null,
  procedureToday: null,
  followUpDate: null,
  status: 'approved',
  approvedAt: '2026-09-24T06:00:00.000Z',
  approvedById: DOCTOR_NISHA.id,
  createdAt: '2026-09-24T06:00:00.000Z',
  updatedAt: '2026-09-24T06:00:00.000Z',
};

/** A session of Priya's. */
function treatment(id: string, more: Partial<TreatmentRecord> = {}): TreatmentRecord {
  return {
    id,
    patientId: TEST_PATIENT_ID,
    appointmentId: null,
    offeringId: null,
    name: 'LHR Full Face',
    template: 'skin',
    performedAt: '2026-09-24T09:30:00.000Z',
    doctorId: DOCTOR_NISHA.id,
    therapistId: null,
    bodyParts: ['face'],
    sessionNumber: 2,
    parameters: {},
    remark: null,
    aftercareCall: 'none',
    packageId: null,
    isBilled: null,
    status: 'done',
    reversedReason: null,
    reversedAt: null,
    latestCheckIn: null,
    createdAt: '2026-09-24T09:30:00.000Z',
    updatedAt: '2026-09-24T09:30:00.000Z',
    ...more,
  };
}

const LHR: PatientPackageRow = {
  id: 'poff_lhr0000000000000000000',
  offeringId: 'off_lhr00000000000000000000',
  name: 'LHR Full Face · B4G7',
  sessionsTotal: 7,
  sessionsUsed: 1,
  sessionsLeft: 6,
  status: 'active',
  validUntil: '2027-09-24',
  invoiceId: 'invc_one0000000000000000000',
  createdAt: '2026-09-24T05:00:00.000Z',
  updatedAt: '2026-09-24T05:00:00.000Z',
};
const PEEL: PatientPackageRow = {
  ...LHR,
  id: 'poff_peel000000000000000000',
  name: 'Peel · 3',
  sessionsTotal: 3,
  sessionsUsed: 3,
  sessionsLeft: 0,
  status: 'used_up',
  validUntil: null,
};

const PHOTO: PatientPhoto = {
  id: 'pimg_one0000000000000000000',
  patientId: TEST_PATIENT_ID,
  appointmentId: null,
  patientTreatmentId: null,
  album: 'lhr',
  stage: 'before',
  fileKey: 'organization-files/org_test/one.png',
  fileName: 'one.png',
  fileUrl: 'https://uploads.test/organization-files/org_test/one.png?X-Amz-Expires=900',
  displayName: 'Face before',
  caption: null,
  bodyPart: null,
  takenOn: '2026-09-24',
  serviceLabel: null,
  createdAt: '2026-09-24T06:30:00.000Z',
  updatedAt: '2026-09-24T06:30:00.000Z',
};

const REPORT: PatientReport = {
  id: 'prep_cbc0000000000000000000',
  patientId: TEST_PATIENT_ID,
  type: 'lab',
  name: 'CBC',
  date: '2026-09-20',
  fileKeys: [],
  files: [],
  notes: null,
  createdAt: '2026-09-20T05:00:00.000Z',
  updatedAt: '2026-09-20T05:00:00.000Z',
};

/** Her invoices, newest first: #8 owes ₹100 of ₹500, #7 and #6 are paid, #5 is older. */
const INVOICES = [
  invoiceRecord({ id: 'invc_eight000000000000000', seq: 8, date: '2026-10-09' }),
  invoiceRecord({
    id: 'invc_seven000000000000000',
    seq: 7,
    type: 'clinic',
    total: 4800,
    paid: 4800,
    due: 0,
    status: 'paid',
  }),
  invoiceRecord({ id: 'invc_six00000000000000000', seq: 6, type: 'medical', due: 0 }),
  invoiceRecord(),
];

/** Says when the member's access is known — before then every gate reads "not allowed". */
function AccessProbe() {
  const access = useAppAccess();
  return access.isResolved ? <span data-testid="access-resolved" /> : null;
}

/** The bento in Priya's file — a visit booked today — for a member holding the `role` preset's codes (or exactly `codes`). */
/** A member who reads the whole file and writes nothing in it — no preset is that narrow. */
const READS_ONLY: OrganizationPermission[] = [
  'organization:read',
  'patient:read',
  'patient:clinical_record:read',
  'contact_activity:read',
  'appointment:read',
];

async function openBento({
  role,
  codes,
  viewable = PATIENT_FILE_SECTIONS,
  nextVisit = true,
  masked = true,
  toggleMasked,
  photos,
}: {
  photos?: PatientPhotoUploads;
  role?: 'admin' | 'owner' | 'doctor';
  codes?: readonly OrganizationPermission[];
  viewable?: readonly PatientFileSectionSlug[];
  nextVisit?: boolean;
  masked?: boolean;
  toggleMasked?: () => void;
} = {}) {
  const user = userEvent.setup();
  const view = renderInPatientFile(
    <>
      <OverviewBento />
      <AccessProbe />
    </>,
    {
      role,
      codes,
      viewable,
      masked,
      ...(toggleMasked ? { toggleMasked } : {}),
      ...(photos ? { photos } : {}),
      section: 'timeline',
      file: patientFile({
        nextVisit: nextVisit
          ? {
              appointmentId: 'appt_next0000000000000000',
              date: APPOINTMENT_TODAY,
              startTime: '11:00',
              serviceLabel: 'Peel',
            }
          : null,
      }),
    },
  );
  await screen.findByTestId('access-resolved');
  return { user, ...view };
}
const card = (name: string) => screen.findByTestId(`overview-card-${name}`);
const path = (router: ReturnType<typeof renderInPatientFile>['router']) =>
  shownLocation(router).pathname;

beforeEach(() => {
  vi.resetAllMocks();
  server.clinical = [clinicalNote('pcn_tan', 'complaint', 'Tanning')];
  server.next = 0;
  server.notes = [teamNote('msg_one', 'Prefers evening slots')];
  server.failPackages = false;
  vi.mocked(listPatientPrescriptions).mockResolvedValue([RX]);
  vi.mocked(listRxMedicines).mockResolvedValue([
    { id: 'med_flubolt', name: 'Flubolt 400', composition: null, stock: 12 },
  ]);
  vi.mocked(listPatientTreatments).mockResolvedValue([
    treatment('trt_reversed', { status: 'reversed', name: 'Minimal' }),
    treatment('trt_two'),
  ]);
  vi.mocked(listPatientPhotos).mockResolvedValue({
    rows: [PHOTO],
    next: null,
    hasMore: false,
    total: 9,
    albumCounts: { general: 4, lhr: 5, private: null },
  });
  vi.mocked(listPatientReports).mockResolvedValue({ reports: [REPORT], total: 4 });
  vi.mocked(listInvoices).mockResolvedValue({
    rows: INVOICES,
    next: null,
    total: INVOICES.length,
    totals: null,
  });
  vi.mocked(fetchInvoiceTotals).mockResolvedValue({ due: 100, paid: 5700.5, count: 4 });
  vi.mocked(fetchPersonAppointments).mockResolvedValue([
    appointmentRow({
      id: 'appt_done0000000000000000',
      serviceLabel: 'Hydrafacial',
      status: 'completed',
      date: '2026-09-24',
    }),
    appointmentRow({ id: 'appt_gone0000000000000000', status: 'cancelled' }),
  ]);
});
afterEach(() => {
  resetPatientFile();
  useLocaleStore.setState({ locale: 'en' });
});

describe('OverviewBento (KICKOFF §6.6 Overview, H:769–779)', () => {
  it('lays out the nine cards from their reads', async () => {
    const { container, user, router } = await openBento();
    for (const name of [
      'clinical',
      'visits',
      'photos',
      'packages',
      'prescriptions',
      'treatments',
      'billing',
      'reports',
      'notes',
    ]) {
      expect(await card(name)).toBeInTheDocument();
    }
    await within(await card('notes')).findByText('Prefers evening slots');
    await within(await card('billing')).findAllByTestId('overview-card-billing-row');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: 'Open Visits' }));
    await waitFor(() => expect(path(router)).toBe(`${FILE}/visits`));
  });

  it('reads each card for the patient and their person', async () => {
    await openBento();
    const visits = await card('visits');
    expect(await within(visits).findByText('Hydrafacial')).toBeInTheDocument();
    // The next visit is the file's: its service, no length (the read names none).
    expect(within(visits).getByText('Peel')).toBeInTheDocument();
    expect(within(visits).getAllByTestId('overview-card-visits-row')).toHaveLength(1);
    expect(fetchPersonAppointments).toHaveBeenCalledWith(TEST_CONTACT_ID);

    const prescriptions = await card('prescriptions');
    const latest = await within(prescriptions).findByTestId(
      'overview-card-prescriptions-latest',
    );
    expect(latest).toHaveTextContent('Rx #500');
    // One pill each medicine, though two lines name it.
    expect(within(latest).getAllByText('Clonix-B Lotion')).toHaveLength(1);
    expect(within(latest).getByText('Flubolt 400')).toBeInTheDocument();
    expect(latest).toHaveTextContent('Avoid sun 48h');

    // A reversed session stays in Treatments, not on the card.
    const treatments = await card('treatments');
    const rows = await within(treatments).findAllByTestId('overview-card-treatments-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Session 2');
    expect(within(treatments).queryByText('Minimal')).not.toBeInTheDocument();

    const packages = await card('packages');
    expect(await within(packages).findByText('LHR Full Face · B4G7')).toBeInTheDocument();
    expect(within(packages).getByText('1 / 7')).toBeInTheDocument();
    expect(within(packages).getByText(/^Valid till /)).toBeInTheDocument();
    expect(within(packages).getByText('All sessions done')).toBeInTheDocument();
    // "Use a session" goes — a recorded treatment spends one (§6 #20).
    expect(within(packages).queryByText('Use session')).not.toBeInTheDocument();

    // Each thumb shows its photo from its link (D86), named by the album chip it shows, then the
    // photo (WCAG 2.5.3); the server's count.
    const photos = await card('photos');
    const [thumb] = await within(photos).findAllByTestId('overview-card-photos-thumb');
    expect(thumb).toHaveAccessibleName('LHR · Face before');
    expect(thumb).toHaveAttribute('title', 'Face before');
    expect(within(photos).getByText('9')).toBeInTheDocument();
    expect(thumb?.querySelector('img')).toHaveAttribute('src', PHOTO.fileUrl);
    expect(listPatientPhotos).toHaveBeenCalledWith(
      TEST_PATIENT_ID,
      { limit: 8 },
      undefined,
    );

    const reports = await card('reports');
    expect(await within(reports).findByText('CBC')).toBeInTheDocument();
    expect(within(reports).getByText('4')).toBeInTheDocument();
    expect(listPatientReports).toHaveBeenCalledWith(TEST_PATIENT_ID, { limit: 3 });

    const notes = await card('notes');
    expect(await within(notes).findByText('Prefers evening slots')).toBeInTheDocument();
    expect(within(notes).getByText(/^Nisha S\. · /)).toBeInTheDocument();
    expect(listContactActivities).toHaveBeenCalledWith({
      contactId: TEST_CONTACT_ID,
      filter: { type: ['note'] },
      limit: 3,
      after: undefined,
    });
  });

  it('leaves out each card the member may not read, and asks nothing for it', async () => {
    await openBento({
      viewable: PATIENT_FILE_SECTIONS.filter(
        (section) =>
          !['prescriptions', 'treatments', 'images', 'reports'].includes(section),
      ),
    });
    await card('visits');
    for (const name of ['prescriptions', 'treatments', 'photos', 'reports']) {
      expect(screen.queryByTestId(`overview-card-${name}`)).not.toBeInTheDocument();
    }
    expect(listPatientTreatments).not.toHaveBeenCalled();
    expect(listPatientPhotos).not.toHaveBeenCalled();
    expect(listPatientReports).not.toHaveBeenCalled();
  });

  it('leaves the clinical writes and the composer out for a member who may not', async () => {
    await openBento({ codes: READS_ONLY });
    await card('clinical');
    expect(screen.queryByTestId('overview-smart-note')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-note-input')).not.toBeInTheDocument();
    expect(screen.queryByTestId('overview-card-visits-book')).not.toBeInTheDocument();
  });

  it('says when a card’s read failed, and Retry reads it again', async () => {
    server.failPackages = true;
    const { user } = await openBento();
    const packages = await card('packages');
    const retry = await within(packages).findByTestId('retry-button');
    server.failPackages = false;
    await user.click(retry);
    expect(await within(packages).findByText('LHR Full Face · B4G7')).toBeInTheDocument();
    expect(listPatientPackages).toHaveBeenCalledTimes(2);
  });

  it('files a smart note’s words as chips — one clinical note each', async () => {
    const { user } = await openBento();
    const clinical = await card('clinical');
    const input = await within(clinical).findByRole('textbox', { name: 'Smart note' });
    await user.type(input, 'hair fall 2 months, suggest PRP');
    await user.click(within(clinical).getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('2 items added from your note'),
    );
    expect(within(clinical).getByText('Hair fall')).toBeInTheDocument();
    expect(within(clinical).getByText('PRP')).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(listClinicalNotes).toHaveBeenCalledWith(TEST_PATIENT_ID);
    await waitFor(() => expect(createClinicalNote).toHaveBeenCalledTimes(2));
    expect(createClinicalNote).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'complaint', text: 'Hair fall' }),
    );
    expect(createClinicalNote).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'treatment_suggestion', text: 'PRP' }),
    );

    await user.type(input, 'ok{Enter}');
    await waitFor(() =>
      expect(notifyMock.info).toHaveBeenCalledWith('Nothing recognised yet'),
    );
  });

  it('reads a smart note in the UI language, its example in the placeholder', async () => {
    useLocaleStore.setState({ locale: 'de' });
    const { user } = await openBento();
    const clinical = await card('clinical');
    const input = await within(clinical).findByRole('textbox', { name: 'Smart note' });
    expect(input).toHaveAttribute(
      'placeholder',
      'Smart note · type naturally, e.g. hair fall 2 months, suggest PRP',
    );
    await user.type(input, 'Haarausfall und Juckreiz, PRP vorschlagen{Enter}');
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('3 items added from your note'),
    );
    expect(within(clinical).getByText('Haarausfall')).toBeInTheDocument();
    expect(within(clinical).getByText('Juckreiz')).toBeInTheDocument();
  });

  it('says when a smart note’s words cannot load, and Retry reads it', async () => {
    const { user } = await openBento();
    const clinical = await card('clinical');
    const input = await within(clinical).findByRole('textbox', { name: 'Smart note' });
    vi.mocked(loadSmartNoteReading).mockRejectedValueOnce(new Error('offline'));
    await user.type(input, 'acne on the chin{Enter}');
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Could not load data.', {
        action: { label: 'Try again', onClick: expect.any(Function) },
      }),
    );
    expect(notifyMock.info).not.toHaveBeenCalled();
    expect(input).toHaveValue('Acne on the chin');

    const [, options] = notifyMock.error.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    act(() => options.action.onClick());
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('1 item added from your note'),
    );
    expect(within(clinical).getByText('Acne')).toBeInTheDocument();
  });

  it('opens New prescription with a line for each medicine a smart note names', async () => {
    const { user, router } = await openBento();
    const clinical = await card('clinical');
    const input = await within(clinical).findByRole('textbox', { name: 'Smart note' });
    // The Rx catalogue loads for a member who writes prescriptions.
    await waitFor(async () => {
      await user.clear(input);
      await user.type(input, 'start flubolt at night{Enter}');
      expect(path(router)).toBe(`${FILE}/prescriptions/create`);
    });
    expect(shownLocation(router).search).toMatchObject({ medicines: ['Flubolt 400'] });
  });

  it('posts a team note from the card — on top at once, an add-note on the person', async () => {
    const { user } = await openBento();
    const notes = await card('notes');
    await within(notes).findByText('Prefers evening slots');
    const input = within(notes).getByRole('textbox', { name: 'Team note' });
    await user.type(input, '  Called about the peel {Enter}');
    expect(await within(notes).findByText('Called about the peel')).toBeInTheDocument();
    expect(input).toHaveValue('');
    expect(sendContactActivity).toHaveBeenCalledWith({
      contactId: TEST_CONTACT_ID,
      channel: 'note',
      body: 'Called about the peel',
      idempotencyKey: expect.any(String),
    });
    // A blank note posts nothing.
    await user.type(input, '   {Enter}');
    expect(sendContactActivity).toHaveBeenCalledTimes(1);
  });

  it('reschedules the next visit, and books one when none is', async () => {
    const first = await openBento();
    const visits = await card('visits');
    await first.user.click(within(visits).getByRole('button', { name: 'Reschedule' }));
    await waitFor(() =>
      expect(path(first.router)).toBe(
        '/organization/acme/appointments/appt_next0000000000000000',
      ),
    );
    expect(shownLocation(first.router).search).toEqual({
      mode: 'reschedule',
      from: `patients/${TEST_PATIENT_ID}/timeline`,
    });
    first.unmount();

    vi.mocked(fetchPersonAppointments).mockResolvedValue([]);
    const second = await openBento({ nextVisit: false });
    const empty = await card('visits');
    expect(await within(empty).findByText('No visits yet')).toBeInTheDocument();
    await second.user.click(within(empty).getByRole('button', { name: 'Book' }));
    await waitFor(() =>
      expect(path(second.router)).toBe('/organization/acme/appointments/create'),
    );
    expect(shownLocation(second.router).search).toMatchObject({ who: TEST_CONTACT_ID });
  });

  it('opens a photo’s album, a treatment’s drawer and a new record', async () => {
    const { user, router } = await openBento({ role: 'owner' });
    const photos = await card('photos');
    const [thumb] = await within(photos).findAllByTestId('overview-card-photos-thumb');
    await user.click(thumb!);
    await waitFor(() => expect(path(router)).toBe(`${FILE}/images`));
    expect(shownLocation(router).search).toMatchObject({ album: 'lhr' });

    const treatments = await card('treatments');
    const [row] = await within(treatments).findAllByTestId(
      'overview-card-treatments-row',
    );
    await user.click(row!);
    await waitFor(() => expect(path(router)).toBe(`${FILE}/treatments/trt_two/edit`));

    for (const [name, label, target] of [
      ['prescriptions', 'New prescription', 'prescriptions/create'],
      ['treatments', 'New treatment', 'treatments/create'],
      ['reports', 'Upload report', 'reports/create'],
    ] as const) {
      await user.click(within(await card(name)).getByRole('button', { name: label }));
      await waitFor(() => expect(path(router)).toBe(`${FILE}/${target}`));
    }
  });

  it('shows her money from the server — Due and Paid masked with the file, her newest three invoices', async () => {
    await openBento();
    const billing = await card('billing');
    const rows = await within(billing).findAllByTestId('overview-card-billing-row');
    expect(rows).toHaveLength(3);
    // The server's status on each (the titles' copy lands with the locale spec).
    expect(rows[0]).toHaveTextContent('Partly paid');
    expect(rows[1]).toHaveTextContent('Paid');
    // Every amount masked with the file (Q-F4), the server's count beside the title.
    expect(within(billing).getByTestId('overview-card-billing-due')).toHaveTextContent(
      '₹ ••••',
    );
    expect(within(billing).getByTestId('overview-card-billing-paid')).toHaveTextContent(
      '₹ ••••',
    );
    expect(within(billing).getByText('4')).toBeInTheDocument();
    expect(fetchInvoiceTotals).toHaveBeenCalledWith({ patientId: TEST_PATIENT_ID });
    expect(listInvoices).toHaveBeenCalledWith({ patientId: TEST_PATIENT_ID }, undefined);
  });

  it('shows the server’s figures once the file is unmasked, and the eye toggles the mask', async () => {
    const toggleMasked = vi.fn();
    const { user } = await openBento({ masked: false, toggleMasked });
    const billing = await card('billing');
    await waitFor(() =>
      expect(within(billing).getByTestId('overview-card-billing-due')).toHaveTextContent(
        '₹100',
      ),
    );
    expect(within(billing).getByTestId('overview-card-billing-paid')).toHaveTextContent(
      '₹5,700.50',
    );
    await user.click(within(billing).getByTestId('overview-card-billing-eye'));
    expect(toggleMasked).toHaveBeenCalledTimes(1);
  });

  it('collects what she owes and opens an invoice over the file', async () => {
    const { user, router } = await openBento({ role: 'owner' });
    const billing = await card('billing');
    await user.click(await within(billing).findByTestId('overview-card-billing-collect'));
    await waitFor(() => expect(path(router)).toBe('/organization/acme/payments/receive'));
    expect(shownLocation(router).search).toEqual({
      patient: TEST_PATIENT_ID,
      from: `patients/${TEST_PATIENT_ID}/timeline`,
    });

    router.history.back();
    const [row] = await within(await card('billing')).findAllByTestId(
      'overview-card-billing-row',
    );
    await user.click(row!);
    await waitFor(() =>
      expect(path(router)).toBe(
        '/organization/acme/invoices/invc_eight000000000000000/edit',
      ),
    );

    router.history.back();
    await user.click(
      within(await card('billing')).getByRole('button', { name: 'New invoice' }),
    );
    await waitFor(() => expect(path(router)).toBe('/organization/acme/invoices/create'));
    expect(shownLocation(router).search).toMatchObject({
      type: 'clinic',
      patient: TEST_PATIENT_ID,
    });
  });

  it('offers no Collect while nothing is due, and says when there are no invoices', async () => {
    vi.mocked(fetchInvoiceTotals).mockResolvedValue({ due: 0, paid: 0, count: 0 });
    vi.mocked(listInvoices).mockResolvedValue({
      rows: [],
      next: null,
      total: 0,
      totals: null,
    });
    await openBento({ role: 'owner' });
    const billing = await card('billing');
    expect(await within(billing).findByText('No invoices yet')).toBeInTheDocument();
    expect(
      within(billing).queryByTestId('overview-card-billing-collect'),
    ).not.toBeInTheDocument();
  });

  it('says when the money read failed, and Retry reads it again', async () => {
    vi.mocked(listInvoices).mockRejectedValueOnce(new Error('offline'));
    const { user } = await openBento();
    const billing = await card('billing');
    await user.click(await within(billing).findByTestId('retry-button'));
    expect(
      await within(billing).findAllByTestId('overview-card-billing-row'),
    ).toHaveLength(3);
    expect(listInvoices).toHaveBeenCalledTimes(2);
  });

  it('leaves Billing out — and reads no money — for a member without billing view', async () => {
    await openBento({
      viewable: PATIENT_FILE_SECTIONS.filter(
        (section) => section !== 'invoices' && section !== 'payments',
      ),
    });
    await card('visits');
    expect(screen.queryByTestId('overview-card-billing')).not.toBeInTheDocument();
    expect(listInvoices).not.toHaveBeenCalled();
  });
  it('sets the cards in fixed rows — Care, then Photos with Reports, then Billing with Team notes', async () => {
    await openBento();
    await card('visits');
    const rows = {
      care: ['visits', 'treatments', 'packages', 'prescriptions'],
      files: ['photos', 'reports'],
      money: ['billing', 'notes'],
    };
    for (const [row, cards] of Object.entries(rows)) {
      const shown = within(screen.getByTestId(`overview-row-${row}`));
      for (const name of cards) {
        expect(shown.getByTestId(`overview-card-${name}`)).toBeInTheDocument();
      }
    }
    // Clinical stands alone, the full width, above the rows.
    expect(screen.getByTestId('overview-row-care')).not.toContainElement(
      screen.getByTestId('overview-card-clinical'),
    );
  });

  it('shows each Clinical list as a panel — "Nothing added yet" when empty', async () => {
    await openBento();
    const complaints = await screen.findByTestId('overview-clinical-complaints');
    expect(within(complaints).getByText('Tanning')).toBeInTheDocument();
    expect(within(complaints).getByText('1')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('overview-clinical-diagnosis')).getByText(
        'Nothing added yet',
      ),
    ).toBeInTheDocument();
  });

  it('offers a card’s add in its empty slot, and keeps a slot without one plain', async () => {
    vi.mocked(listPatientPrescriptions).mockResolvedValue([]);
    const { user, router } = await openBento({ role: 'owner' });
    const prescriptions = await card('prescriptions');
    const slot = await within(prescriptions).findByTestId(
      'overview-card-prescriptions-empty',
    );
    expect(slot.tagName).toBe('BUTTON');
    expect(slot).toHaveTextContent('New prescription');
    await user.click(slot);
    await waitFor(() => expect(path(router)).toBe(`${FILE}/prescriptions/create`));
  });

  it('makes the Photos card an upload target — the Add photos tile, a drop, a paste', async () => {
    const photos = { pick: vi.fn(), capture: vi.fn(), upload: vi.fn() };
    const { user } = await openBento({ role: 'owner', photos });
    const shown = await card('photos');
    await user.click(await within(shown).findByTestId('overview-card-photos-add'));
    expect(photos.pick).toHaveBeenCalledWith('general');

    const files = [new File(['x'], 'cheek.jpg', { type: 'image/jpeg' })];
    fireEvent.drop(shown.parentElement!, { dataTransfer: { files } });
    expect(photos.upload).toHaveBeenCalledWith(files, 'general');

    const pasted = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasted, 'clipboardData', { value: { files } });
    act(() => {
      document.body.dispatchEvent(pasted);
    });
    expect(photos.upload).toHaveBeenLastCalledWith(files, 'general');
  });

  it('turns the empty Photos card into one drop zone for a member who uploads', async () => {
    vi.mocked(listPatientPhotos).mockResolvedValue({
      rows: [],
      next: null,
      hasMore: false,
      total: 0,
      albumCounts: { general: 0, lhr: 0, private: null },
    });
    const photos = { pick: vi.fn(), capture: vi.fn(), upload: vi.fn() };
    const { user } = await openBento({ role: 'owner', photos });
    const zone = await within(await card('photos')).findByTestId(
      'overview-card-photos-empty',
    );
    expect(zone).toHaveTextContent('Drop photos here or click to upload');
    await user.click(zone);
    expect(photos.pick).toHaveBeenCalledWith('general');
  });

  it('keeps the Photos card read-only for a member who may not upload', async () => {
    await openBento({ codes: READS_ONLY });
    const shown = await card('photos');
    await within(shown).findAllByTestId('overview-card-photos-thumb');
    expect(
      within(shown).queryByTestId('overview-card-photos-add'),
    ).not.toBeInTheDocument();
  });
});
