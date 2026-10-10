import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { moveAppointment } from '@/shared/api/clinic/appointments-api.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type { ClinicalNote } from '@/shared/api/clinic/clinical-notes-contracts.ts';
import { listInvoices } from '@/shared/api/clinic/invoices-api.ts';
import type { InvoiceRecord } from '@/shared/api/clinic/invoices-contracts.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import {
  approvePrescription,
  createPrescription,
} from '@/shared/api/clinic/prescriptions-api.ts';
import type {
  PrescriptionKit,
  PrescriptionRecord,
} from '@/shared/api/clinic/prescriptions-contracts.ts';
import { moveFloorStage } from '@/shared/api/clinic/today-api.ts';
import { createTreatment } from '@/shared/api/clinic/treatments-api.ts';
import type { TreatmentRecord } from '@/shared/api/clinic/treatments-contracts.ts';
import {
  fetchVisitCheckNotes,
  recordVisitCheck,
  removeVisitCheck,
  setVisitPaused,
} from '@/shared/api/clinic/visits-api.ts';
import type { VisitRecord } from '@/shared/api/clinic/visits-contracts.ts';
import type { PatientFileSectionSlug } from '@/shared/clinic/patient-file-sections.ts';
import { PATIENT_FILE_SECTIONS } from '@/shared/clinic/patient-file-sections.ts';
import {
  APPOINTMENT_NOW,
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
import { VisitFlow } from './VisitFlow.tsx';

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

/** What clinozy-be holds for Priya's visit: its notes, Rx, sessions, packages, the kits. */
const world = vi.hoisted(() => ({
  visit: null as VisitRecord | null,
  notes: [] as ClinicalNote[],
  prescriptions: [] as PrescriptionRecord[],
  treatments: [] as TreatmentRecord[],
  packages: [] as PatientPackageRow[],
  kits: [] as PrescriptionKit[],
  invoices: [] as InvoiceRecord[],
  failNotes: false,
}));
vi.mock('@/shared/api/clinic/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listInvoices: vi.fn(async () => ({
    rows: world.invoices,
    next: null,
    total: world.invoices.length,
    totals: null,
  })),
}));
vi.mock('@/shared/api/clinic/visits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchOpenVisit: vi.fn(async () => world.visit),
  fetchVisitCheckNotes: vi.fn(async () => {
    if (world.failNotes) throw new TypeError('Failed to fetch');
    return world.notes;
  }),
  recordVisitCheck: vi.fn(
    async ({ check, appointmentId }: { check: string; appointmentId: string }) => {
      const texts: Record<string, string> = {
        consent: 'Consent signed',
        photos: 'Before photos taken',
        allergies: 'Allergies & medicines checked',
      };
      const note: ClinicalNote = {
        id: `pcn_${check}`,
        patientId: 'pat_priya0000000000000000',
        kind: 'safety_check',
        text: texts[check] ?? check,
        appointmentId,
        diagnosisId: null,
        addedAt: new Date().toISOString(),
      };
      world.notes = [...world.notes, note];
      return note;
    },
  ),
  removeVisitCheck: vi.fn(async ({ noteId }: { noteId: string }) => {
    world.notes = world.notes.filter((note) => note.id !== noteId);
  }),
  setVisitPaused: vi.fn(async () => world.visit),
}));
vi.mock('@/shared/api/clinic/patient-file-api.ts', async (importOriginal) => {
  const { patientFile: file } = await import('@/tests/utils/patient-doubles.ts');
  return {
    ...(await importOriginal<object>()),
    fetchPatientFile: vi.fn(async () => file()),
  };
});
vi.mock('@/shared/api/clinic/prescriptions-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientPrescriptions: vi.fn(async () => world.prescriptions),
  listPrescriptionKits: vi.fn(async () => world.kits),
  createPrescription: vi.fn(
    async ({
      patientId,
      fields,
      appointmentId,
    }: {
      patientId: string;
      fields: Pick<PrescriptionRecord, 'doctorId' | 'date' | 'items'>;
      appointmentId: string | null;
    }) => {
      const record = {
        id: 'rx_new000000000000000000',
        seq: 512,
        patientId,
        appointmentId,
        advice: null,
        labReport: null,
        procedureToday: null,
        followUpDate: null,
        status: 'draft',
        approvedAt: null,
        approvedById: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...fields,
      } satisfies PrescriptionRecord;
      world.prescriptions = [record, ...world.prescriptions];
      return record;
    },
  ),
  approvePrescription: vi.fn(async () => {
    const [record] = world.prescriptions;
    if (!record) throw new Error('nothing to approve');
    return { ...record, status: 'approved' };
  }),
}));
vi.mock('@/shared/api/clinic/treatments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientTreatments: vi.fn(async () => world.treatments),
  createTreatment: vi.fn(
    async ({
      patientId,
      input,
    }: {
      patientId: string;
      input: Omit<TreatmentRecord, 'id'>;
    }) => {
      const [last] = world.treatments;
      if (!last) throw new Error('no session to repeat');
      const record: TreatmentRecord = {
        ...last,
        ...input,
        id: 'trt_new00000000000000000',
        patientId,
        appointmentId: input.appointmentId ?? null,
      };
      world.treatments = [record, ...world.treatments];
      return record;
    },
  ),
}));
vi.mock('@/shared/api/clinic/patient-packages-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPatientPackages: vi.fn(async () => world.packages),
}));
vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => {
  const { appointmentRow: row } = await import('@/tests/utils/appointment-doubles.ts');
  return {
    ...(await importOriginal<object>()),
    moveAppointment: vi.fn(async () => {
      world.visit = null;
      return row({ status: 'completed' });
    }),
  };
});
vi.mock('@/shared/api/clinic/today-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  moveFloorStage: vi.fn(async () => undefined),
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => {
  const { DOCTOR_NISHA: nisha, DOCTOR_ARJUN: arjun } =
    await import('@/tests/utils/appointment-doubles.ts');
  return {
    ...(await importOriginal<object>()),
    fetchTeamDirectory: vi.fn(async () => [nisha, arjun]),
  };
});
vi.mock('@/shared/tenancy/my-membership.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findMyMembershipId: vi.fn(async () => 'mem_nisha0000000000000000'),
}));

const APPOINTMENT_ID = 'appt_priya000000000000000';
const PACKAGE_ID = 'poff_lhr0000000000000000';

/** Priya's visit today — checked in, with Dr. Nisha, for a booking of `type`. */
function visitOf(overrides: Partial<VisitRecord> = {}, type = 'consultation' as const) {
  return {
    appointmentId: APPOINTMENT_ID,
    booking: appointmentRow({
      id: APPOINTMENT_ID,
      contactId: TEST_CONTACT_ID,
      patientId: TEST_PATIENT_ID,
      date: APPOINTMENT_TODAY,
      status: 'checked_in',
      type,
      visitStage: 'with_doctor',
    }),
    stage: 'with_doctor',
    stageAt: '2026-10-03T03:35:00.000Z',
    pausedAt: null,
    ...overrides,
  } satisfies VisitRecord;
}

/** Her last laser session — session 3, before today. */
function lastSession(overrides: Partial<TreatmentRecord> = {}): TreatmentRecord {
  return {
    id: 'trt_last00000000000000000',
    patientId: TEST_PATIENT_ID,
    appointmentId: 'appt_old000000000000000000',
    offeringId: 'off_lhr00000000000000000',
    name: 'Laser hair reduction',
    template: 'skin',
    performedAt: '2026-09-20T05:00:00.000Z',
    doctorId: DOCTOR_NISHA.id,
    therapistId: null,
    bodyParts: ['legs'],
    sessionNumber: 3,
    parameters: { machine: 'GentleMax', power: '18 J/cm²', wavelength: '755' },
    remark: null,
    aftercareCall: 'in_two_days',
    packageId: null,
    isBilled: false,
    status: 'done',
    reversedReason: null,
    reversedAt: null,
    latestCheckIn: null,
    createdAt: '2026-09-20T05:00:00.000Z',
    updatedAt: '2026-09-20T05:00:00.000Z',
    ...overrides,
  };
}

/** A safety-check note already at the visit. */
const checkNote = (id: string, text: string): ClinicalNote => ({
  id,
  patientId: TEST_PATIENT_ID,
  kind: 'safety_check',
  text,
  appointmentId: APPOINTMENT_ID,
  diagnosisId: null,
  addedAt: '2026-10-03T03:40:00.000Z',
});

const HAIR_FALL_KIT: PrescriptionKit = {
  id: 'rxk_hairfall0000000000000',
  name: 'Hair fall kit',
  items: [
    {
      medicineId: null,
      medicineName: 'Minoxidil 5%',
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
    },
  ],
};

/**
 * The flow for a member holding the `role` preset's codes (or exactly `codes`), in the file
 * at `timeline?visit=open` — where the Overview mounts it — on `visit`.
 */
async function openFlow({
  role = 'owner',
  codes,
  visit = visitOf(),
  viewable = PATIENT_FILE_SECTIONS,
}: {
  role?: Role;
  /** Exactly these codes instead of the `role` preset's. */
  codes?: readonly OrganizationPermission[];
  visit?: VisitRecord;
  viewable?: readonly PatientFileSectionSlug[];
} = {}) {
  world.visit = visit;
  const user = userEvent.setup();
  const view = renderInPatientFile(<VisitFlow visit={visit} />, {
    role,
    codes,
    file: patientFile(),
    section: 'timeline',
    viewable,
  });
  await act(() =>
    view.router.navigate({
      href: patientFileUrl(TEST_PATIENT_ID, '/timeline?visit=open'),
    }),
  );
  await screen.findByTestId('visit-flow');
  return { user, ...view };
}

const step = (name: string) => screen.getByTestId(`visit-flow-step-${name}`);
const stateOf = () =>
  Object.fromEntries(
    ['checks', 'rx', 'treatment'].map((name) => [
      name,
      step(name).getAttribute('data-state'),
    ]),
  );

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(APPOINTMENT_NOW);
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  Object.assign(world, {
    visit: null,
    notes: [],
    prescriptions: [],
    treatments: [lastSession()],
    packages: [],
    kits: [HAIR_FALL_KIT],
    invoices: [],
    failNotes: false,
  });
});
afterEach(() => {
  resetPatientFile();
  vi.useRealTimers();
  vi.mocked(moveFloorStage).mockClear();
  vi.mocked(moveAppointment).mockClear();
  vi.mocked(createPrescription).mockClear();
  vi.mocked(approvePrescription).mockClear();
  vi.mocked(createTreatment).mockClear();
  vi.mocked(recordVisitCheck).mockClear();
  vi.mocked(removeVisitCheck).mockClear();
  vi.mocked(setVisitPaused).mockClear();
  vi.mocked(fetchVisitCheckNotes).mockClear();
  vi.mocked(listInvoices).mockClear();
});

describe('VisitFlow (KICKOFF §6.6 Visit flow; H:758–768) on clinozy-be', () => {
  it('shows the five steps on the visit’s records, the checks current', async () => {
    const { container } = await openFlow();
    const flow = screen.getByTestId('visit-flow');
    expect(within(flow).getByText('Visit in progress')).toBeInTheDocument();
    // Invoice and Collect join once the member's Payments access is known.
    await waitFor(() =>
      expect(
        within(flow)
          .getAllByRole('heading', { level: 3 })
          .map((heading) => heading.textContent),
      ).toEqual(['Check-in & safety', 'Prescription', 'Treatment', 'Invoice', 'Collect']),
    );
    await waitFor(() => expect(step('checks')).toHaveTextContent('3 checks left'));
    expect(stateOf()).toEqual({ checks: 'current', rx: 'later', treatment: 'later' });
    expect(step('rx')).toHaveTextContent('One tap from a kit, or write one');
    expect(
      await within(step('treatment')).findByTestId('visit-flow-repeat'),
    ).toHaveTextContent('⚡ Repeat · Laser hair reduction · session 4');
    expect(step('treatment')).toHaveTextContent(
      'Last settings: GentleMax · 18 J/cm² · 755 nm',
    );
    // Nothing recorded at the visit yet: nothing to bill, nothing to collect (D156).
    await waitFor(() => expect(step('invoice')).toHaveTextContent('Nothing to bill yet'));
    expect(step('collect')).toHaveTextContent('Invoice the visit first');
    expect(listInvoices).toHaveBeenCalledWith(
      { patientId: TEST_PATIENT_ID, day: APPOINTMENT_TODAY },
      undefined,
    );
    // The share goes (§6 #26).
    expect(screen.queryByText('Share Rx, invoice & photos')).not.toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('holds the treatment until the checks are done, then repeats the last session and moves the visit on', async () => {
    const { user } = await openFlow();
    await user.click(await screen.findByTestId('visit-flow-repeat'));
    expect(notifyMock.info).toHaveBeenCalledWith('Finish check-in first');
    expect(createTreatment).not.toHaveBeenCalled();

    for (const check of ['consent', 'photos', 'allergies']) {
      const tile = screen.getByTestId(`visit-flow-check-${check}`);
      await user.click(tile);
      await waitFor(() => expect(tile).toHaveAttribute('aria-checked', 'true'));
      await waitFor(() => expect(tile).not.toBeDisabled());
    }
    expect(vi.mocked(recordVisitCheck).mock.calls.map(([vars]) => vars.check)).toEqual([
      'consent',
      'photos',
      'allergies',
    ]);
    expect(recordVisitCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: TEST_PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
      }),
    );
    await waitFor(() => expect(step('checks')).toHaveAttribute('data-state', 'done'));
    expect(step('checks')).toHaveTextContent('All checks done');
    expect(step('rx')).toHaveAttribute('data-state', 'current');

    await user.click(screen.getByTestId('visit-flow-repeat'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Session 4 recorded with last settings',
      ),
    );
    expect(vi.mocked(createTreatment).mock.calls[0]?.[0]).toMatchObject({
      patientId: TEST_PATIENT_ID,
      input: {
        name: 'Laser hair reduction',
        sessionNumber: 4,
        bodyParts: ['legs'],
        aftercareCall: 'in_two_days',
        appointmentId: APPOINTMENT_ID,
        packageId: null,
      },
    });
    // Q8 (the plan's proposal): a session takes the visit to Checkout.
    await waitFor(() =>
      expect(moveFloorStage).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: APPOINTMENT_ID, stage: 'checkout' }),
      ),
    );
    await waitFor(() => expect(step('treatment')).toHaveAttribute('data-state', 'done'));
    expect(step('treatment')).toHaveTextContent('Laser hair reduction · session 4');
    // The visit has its session: a second one is a new treatment.
    expect(screen.queryByTestId('visit-flow-repeat')).not.toBeInTheDocument();
  });

  it('repeats on the package while it can still spend a session, and shows its pill', async () => {
    world.treatments = [lastSession({ packageId: PACKAGE_ID })];
    world.packages = [
      {
        id: PACKAGE_ID,
        offeringId: 'off_lhrpack000000000000000',
        name: 'LHR Legs · 6 sessions',
        sessionsTotal: 6,
        sessionsUsed: 3,
        sessionsLeft: 3,
        status: 'active',
        validUntil: null,
        invoiceId: 'invc_lhr0000000000000000',
        createdAt: '2026-09-01T05:00:00.000Z',
        updatedAt: '2026-09-20T05:00:00.000Z',
      },
    ];
    world.notes = [
      checkNote('pcn_consent', 'Consent signed'),
      checkNote('pcn_photos', 'Before photos taken'),
      checkNote('pcn_allergies', 'Allergies & medicines checked'),
    ];
    const { user } = await openFlow();
    expect(
      await within(step('treatment')).findByText(
        'Uses 1 session of LHR Legs · 6 sessions',
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(step('checks')).toHaveAttribute('data-state', 'done'));
    await user.click(screen.getByTestId('visit-flow-repeat'));
    await waitFor(() => expect(createTreatment).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createTreatment).mock.calls[0]?.[0].input.packageId).toBe(
      PACKAGE_ID,
    );
  });

  it('unticks a check — its note removed — the tile itself the way back', async () => {
    world.notes = [checkNote('pcn_consent', 'Consent signed')];
    const { user } = await openFlow();
    const tile = screen.getByTestId('visit-flow-check-consent');
    await waitFor(() => expect(tile).toHaveAttribute('aria-checked', 'true'));
    expect(step('checks')).toHaveTextContent('2 checks left');
    await user.click(tile);
    await waitFor(() => expect(tile).toHaveAttribute('aria-checked', 'false'));
    expect(removeVisitCheck).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      noteId: 'pcn_consent',
    });
  });

  it('prescribes a kit in one tap for a doctor — approved, at the visit — and moves the visit on', async () => {
    const { user } = await openFlow({ role: 'doctor' });
    const [kit] = await screen.findAllByTestId('visit-flow-kit');
    if (!kit) throw new Error('no kit');
    expect(kit).toHaveTextContent('⚡ Hair fall kit');
    await user.click(kit);
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Hair fall kit prescribed'),
    );
    expect(vi.mocked(createPrescription).mock.calls[0]?.[0]).toMatchObject({
      patientId: TEST_PATIENT_ID,
      appointmentId: APPOINTMENT_ID,
      fields: {
        doctorId: DOCTOR_NISHA.id,
        date: APPOINTMENT_TODAY,
        items: HAIR_FALL_KIT.items,
        advice: null,
      },
    });
    // Q19: a doctor's save is approved.
    expect(approvePrescription).toHaveBeenCalledTimes(1);
    // Q8: a consultation's Rx takes it to Checkout — no session is due.
    await waitFor(() =>
      expect(moveFloorStage).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: APPOINTMENT_ID, stage: 'checkout' }),
      ),
    );
    await waitFor(() => expect(step('rx')).toHaveTextContent('Minoxidil 5%'));
    expect(step('rx')).toHaveAttribute('data-state', 'done');
  });

  it('writes a prescription in the drawer, the flow kept behind it', async () => {
    const { user, router } = await openFlow({ role: 'doctor' });
    await user.click(await screen.findByTestId('visit-flow-write-rx'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(TEST_PATIENT_ID, '/prescriptions/create'),
      ),
    );
    expect(router.state.location.search).toEqual({ visit: 'open' });
  });

  it('pauses — out of the flow, the visit left open — and resumes a paused visit', async () => {
    const { user, router } = await openFlow();
    await user.click(await screen.findByTestId('visit-flow-pause'));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(setVisitPaused).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: APPOINTMENT_ID, paused: true }),
    );
  });

  it('shows a paused visit as paused, with Resume', async () => {
    const { user } = await openFlow({
      visit: visitOf({ pausedAt: '2026-10-03T03:50:00.000Z' }),
    });
    expect(screen.queryByTestId('visit-flow-pause')).not.toBeInTheDocument();
    await user.click(await screen.findByTestId('visit-flow-resume'));
    await waitFor(() =>
      expect(setVisitPaused).toHaveBeenCalledWith(
        expect.objectContaining({ appointmentId: APPOINTMENT_ID, paused: false }),
      ),
    );
  });

  it('completes the visit with what it did — the package session, the follow-up', async () => {
    world.treatments = [
      lastSession({
        id: 'trt_today00000000000000',
        appointmentId: APPOINTMENT_ID,
        sessionNumber: 4,
        packageId: PACKAGE_ID,
      }),
    ];
    world.prescriptions = [
      {
        id: 'rx_today000000000000000',
        seq: 511,
        patientId: TEST_PATIENT_ID,
        appointmentId: APPOINTMENT_ID,
        doctorId: DOCTOR_NISHA.id,
        date: APPOINTMENT_TODAY,
        items: HAIR_FALL_KIT.items,
        advice: null,
        labReport: null,
        procedureToday: null,
        followUpDate: '2026-10-26',
        status: 'approved',
        approvedAt: '2026-10-03T03:45:00.000Z',
        approvedById: DOCTOR_NISHA.id,
        createdAt: '2026-10-03T03:45:00.000Z',
        updatedAt: '2026-10-03T03:45:00.000Z',
      },
    ];
    const { user } = await openFlow();
    await waitFor(() => expect(step('treatment')).toHaveAttribute('data-state', 'done'));
    await waitFor(() => expect(step('rx')).toHaveAttribute('data-state', 'done'));
    await user.click(await screen.findByTestId('visit-flow-complete'));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        'Visit completed · 1 package session used · follow-up set for Oct 26',
      ),
    );
    expect(moveAppointment).toHaveBeenCalledWith(
      expect.objectContaining({ appointmentId: APPOINTMENT_ID, route: 'complete' }),
    );
  });

  it('says "Nothing to bill" while the visit has no session to bill, opening nothing', async () => {
    const { user, router } = await openFlow();
    await waitFor(() => expect(step('invoice')).toHaveTextContent('Nothing to bill yet'));
    await user.click(screen.getByTestId('visit-flow-create-invoice'));
    expect(notifyMock.info).toHaveBeenCalledWith('Nothing to bill');
    expect(router.state.location.search).toEqual({ visit: 'open' });
  });

  it('bills the visit’s sessions in the Invoice drawer over the flow', async () => {
    world.treatments = [
      lastSession({ id: 'trt_today0000000000000000', appointmentId: APPOINTMENT_ID }),
      lastSession(),
    ];
    const { user, router } = await openFlow();
    await waitFor(() => expect(step('invoice')).toHaveTextContent('1 item ready'));
    await user.click(screen.getByTestId('visit-flow-create-invoice'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/invoices/create'),
    );
    expect(shownLocation(router).search).toEqual({
      type: 'clinic',
      patient: TEST_PATIENT_ID,
      appointment: APPOINTMENT_ID,
      from: `patients/${TEST_PATIENT_ID}/timeline?visit=open`,
    });
    // The flow stays behind the drawer.
    expect(router.state.location.pathname).toBe(
      patientFileUrl(TEST_PATIENT_ID, '/timeline'),
    );
  });

  it('opens a custom invoice for the patient, the flow kept behind it', async () => {
    const { user, router } = await openFlow();
    await user.click(await screen.findByTestId('visit-flow-custom-invoice'));
    await waitFor(() =>
      expect(shownLocation(router).search).toEqual({
        type: 'clinic',
        patient: TEST_PATIENT_ID,
        from: `patients/${TEST_PATIENT_ID}/timeline?visit=open`,
      }),
    );
  });

  it('shows the visit’s invoice — masked with the file — and collects what it owes against it', async () => {
    world.treatments = [
      lastSession({
        id: 'trt_today0000000000000000',
        appointmentId: APPOINTMENT_ID,
        isBilled: true,
        packageId: PACKAGE_ID,
      }),
    ];
    const billed = invoiceRecord();
    world.invoices = [
      invoiceRecord({
        id: 'invc_visit0000000000000000',
        seq: 7,
        total: 1533.41,
        paid: 0,
        due: 1533.41,
        status: 'unpaid',
        items: billed.items.map((line) => ({
          ...line,
          treatmentIds: ['trt_today0000000000000000'],
        })),
      }),
    ];
    const { user, router } = await openFlow();
    await waitFor(() => expect(step('invoice')).toHaveAttribute('data-state', 'done'));
    expect(step('invoice')).toHaveTextContent('#7 · ₹ ••••');
    expect(screen.queryByTestId('visit-flow-create-invoice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-flow-custom-invoice')).not.toBeInTheDocument();
    expect(step('collect')).toHaveTextContent('₹ •••• due');
    expect(step('collect')).not.toHaveAttribute('data-state', 'done');

    await user.click(screen.getByTestId('visit-flow-collect'));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/payments/receive'),
    );
    expect(shownLocation(router).search).toEqual({
      patient: TEST_PATIENT_ID,
      invoice: 'invc_visit0000000000000000',
      from: `patients/${TEST_PATIENT_ID}/timeline?visit=open`,
    });
  });

  it('is done once the visit’s invoice is paid, and when a package covered every session', async () => {
    world.treatments = [
      lastSession({
        id: 'trt_today0000000000000000',
        appointmentId: APPOINTMENT_ID,
        isBilled: true,
        packageId: PACKAGE_ID,
      }),
    ];
    await openFlow();
    // A package bought before covered it: nothing to bill, nothing to collect.
    await waitFor(() =>
      expect(step('invoice')).toHaveTextContent('Covered by package · nothing to bill'),
    );
    expect(step('invoice')).toHaveAttribute('data-state', 'done');
    expect(step('collect')).toHaveTextContent('Nothing due');
    expect(screen.queryByTestId('visit-flow-collect')).not.toBeInTheDocument();
  });

  it('shows no Invoice or Collect to a member who can’t see Payments — a Therapist', async () => {
    await openFlow({ role: 'therapist' });
    await screen.findByTestId('visit-flow-step-treatment');
    expect(screen.queryByTestId('visit-flow-step-invoice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-flow-step-collect')).not.toBeInTheDocument();
    expect(listInvoices).not.toHaveBeenCalled();
  });

  it('leaves a member who only treats the treatment — the checks read-only, no Pause or Complete', async () => {
    world.notes = [checkNote('pcn_consent', 'Consent signed')];
    await openFlow({
      codes: [
        'organization:read',
        'patient:read',
        'patient:clinical_record:read',
        'patient_treatment:read',
        'patient_treatment:create',
        'appointment:read',
      ],
    });
    await waitFor(() =>
      expect(screen.getByTestId('visit-flow-check-consent')).toHaveAttribute(
        'aria-checked',
        'true',
      ),
    );
    expect(screen.getByTestId('visit-flow-check-photos')).toBeDisabled();
    expect(screen.queryByTestId('visit-flow-pause')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-flow-complete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('visit-flow-kit')).not.toBeInTheDocument();
    expect(await screen.findByTestId('visit-flow-new-treatment')).toBeInTheDocument();
  });

  it('shows no checks to a member who can’t read the clinical record — and holds nothing on them', async () => {
    const { user } = await openFlow({
      viewable: PATIENT_FILE_SECTIONS.filter((section) => section !== 'overview'),
    });
    expect(screen.queryByTestId('visit-flow-step-checks')).not.toBeInTheDocument();
    expect(fetchVisitCheckNotes).not.toHaveBeenCalled();
    await user.click(await screen.findByTestId('visit-flow-repeat'));
    await waitFor(() => expect(createTreatment).toHaveBeenCalledTimes(1));
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('says a check read failed, in place, and reads again on Retry', async () => {
    world.failNotes = true;
    const { user } = await openFlow();
    await waitFor(() => expect(step('checks')).toHaveTextContent('Could not load data.'));
    world.failNotes = false;
    await user.click(screen.getByTestId('visit-flow-retry-checks'));
    await waitFor(() => expect(step('checks')).toHaveTextContent('3 checks left'));
  });
});
