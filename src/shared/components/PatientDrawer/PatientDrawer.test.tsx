import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { findContactByPhone } from '@/shared/api/clinic/contacts-api.ts';
import type {
  ContactProfile,
  ContactSummary,
} from '@/shared/api/clinic/contacts-contracts.ts';
import { fetchLead } from '@/shared/api/clinic/leads-api.ts';
import type { LeadRecord } from '@/shared/api/clinic/leads-contracts.ts';
import { attachPatientImage } from '@/shared/api/clinic/patient-images-api.ts';
import {
  createPatient,
  fetchPatient,
  updatePatient,
} from '@/shared/api/clinic/patients-api.ts';
import type {
  PatientFields,
  PatientRecord,
} from '@/shared/api/clinic/patients-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { contactHit } from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { EMPTY_CONTACT_PROFILE } from '@/tests/utils/contact-doubles.ts';
import { patientRecord } from '@/tests/utils/patient-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

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
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const { enqueueMock } = vi.hoisted(() => ({ enqueueMock: vi.fn() }));
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => ({ enqueue: enqueueMock }),
}));

vi.mock('@/shared/api/clinic/patients-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatient: vi.fn(),
  createPatient: vi.fn(),
  updatePatient: vi.fn(),
}));
vi.mock('@/shared/api/clinic/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findContactByPhone: vi.fn(),
}));
vi.mock('@/shared/api/clinic/leads-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchLead: vi.fn(),
}));
vi.mock('@/shared/api/clinic/patient-images-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  attachPatientImage: vi.fn(),
}));

import { PatientDrawer } from './PatientDrawer.tsx';

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');

/** Dharti Galani, #3508 — a patient on +91 82006 03212. */
const DHARTI = patientRecord({
  id: 'pat_dharti000000000000000',
  seq: 3508,
  contactId: 'con_dharti000000000000000',
  firstName: 'Dharti',
  lastName: 'Galani',
  name: 'Dharti Galani',
  phone: '+918200603212',
  phones: [{ phone: '+918200603212', isPrimary: true, isOnWhatsapp: true }],
  status: 'regular',
  consents: ['data', 'photos'],
});
const DHARTI_DIGITS = '8200603212';

/** Dharti as the duplicate check finds her: a person with a file. */
const DHARTI_PERSON: ContactSummary & ContactProfile = {
  ...contactHit({
    id: DHARTI.contactId,
    contactNumber: 1100,
    firstName: 'Dharti',
    lastName: 'Galani',
    name: 'Dharti Galani',
    primaryPhone: DHARTI.phone,
    patientId: DHARTI.id,
    openLeadId: null,
  }),
  ...EMPTY_CONTACT_PROFILE,
  patientNumber: 3508,
};

/** Riya Mehta — someone the clinic knows (a lead's person) without a patient file. */
const RIYA_PERSON: ContactSummary & ContactProfile = {
  ...contactHit(),
  ...EMPTY_CONTACT_PROFILE,
};
const RIYA_DIGITS = '9825011241';

/** The lead a New patient link can come from, and its person. */
const LEAD_ID = 'lead_anaya0000000000000000';
const LEAD_CONTACT_ID = 'con_anaya0000000000000000';

/** The id and number clinozy-be gives the next patient. */
const NEW_PATIENT_ID = 'pat_new00000000000000000';
const NEW_CONTACT_ID = 'con_new00000000000000000';

/** The patients clinozy-be holds, by id — a create or a save writes here, a read answers from it. */
let saved = new Map<string, PatientRecord>();

/** A record with the drawer's fields written over it, as the server would answer the save. */
function recordWith(base: PatientRecord, fields: PatientFields): PatientRecord {
  const phones = [fields.phone, fields.phone2].filter((phone): phone is string =>
    Boolean(phone),
  );
  return {
    ...base,
    firstName: fields.firstName,
    lastName: fields.lastName,
    name: [fields.firstName, fields.lastName].filter(Boolean).join(' '),
    phone: fields.phone,
    phone2: fields.phone2,
    phones: phones.map((phone, index) => ({
      phone,
      isPrimary: index === 0,
      isOnWhatsapp: true,
    })),
    gender: fields.gender,
    dateOfBirth: fields.dateOfBirth,
    address: fields.address,
    referralSource: fields.referralSource,
    referredByName: fields.referredByName,
    homeBranchId: fields.homeBranchId,
    types: fields.types,
    status: fields.status,
    conversion: fields.conversion ?? 'not_converted',
    followUpAt: fields.followUpAt,
    notes: fields.notes,
    consents: fields.consents,
    hasMarketingConsent: fields.consents.includes('marketing'),
    updatedAt: new Date().toISOString(),
  };
}

function setUser() {
  return userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
}

/** A member previewed as `role` (View-as narrows the clinic access to its matrix). */
function asRole(role: Role) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });
}

function renderCreate(prefill?: { name?: string; phone?: string; leadId?: string }) {
  const onCreated = vi.fn();
  const onClose = vi.fn();
  const view = renderWithProviders(
    <PatientDrawer
      mode="create"
      open
      prefill={prefill}
      onClose={onClose}
      onCreated={onCreated}
    />,
  );
  return { ...view, onCreated, onClose };
}

async function drawer(testId = 'patient-drawer') {
  return screen.findByTestId(testId);
}

/** Fill the two required fields. */
async function fillRequired(
  user: ReturnType<typeof setUser>,
  { first = 'Priya', mobile = '9876500001' } = {},
) {
  await user.type(await screen.findByTestId('patient-drawer-first-name'), first);
  await user.type(screen.getByTestId('patient-drawer-mobile'), mobile);
}

/** Let the last duplicate-number lookup answer, and the drawer render its answer. */
async function lookupAnswered() {
  await act(async () => {
    await vi.mocked(findContactByPhone).mock.results.at(-1)?.value;
  });
}

/** The vars of the last create. */
function lastCreate() {
  const call = vi.mocked(createPatient).mock.lastCall?.[0];
  if (!call) throw new Error('nothing was created');
  return call;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  saved = new Map([[DHARTI.id, structuredClone(DHARTI)]]);
  enqueueMock.mockReset();
  enqueueMock.mockImplementation((files: readonly File[]) => ({
    accepted: files.length,
    skipped: 0,
  }));
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(fetchPatient).mockReset();
  vi.mocked(fetchPatient).mockImplementation(async (patientId) => {
    const record = saved.get(patientId);
    if (!record) {
      throw new HttpError('Not found', 404, `/app/patients/${patientId}`, 'GET');
    }
    return structuredClone(record);
  });
  vi.mocked(createPatient).mockReset();
  vi.mocked(createPatient).mockImplementation(async ({ fields, person }) => {
    const created = recordWith(
      patientRecord({
        id: NEW_PATIENT_ID,
        seq: 3509,
        contactId: person === 'new' ? NEW_CONTACT_ID : person.contactId,
        consents: [],
      }),
      fields,
    );
    saved.set(created.id, created);
    return structuredClone(created);
  });
  vi.mocked(updatePatient).mockReset();
  vi.mocked(updatePatient).mockImplementation(async ({ record, fields }) => {
    const next = recordWith(record, fields);
    saved.set(next.id, next);
    return structuredClone(next);
  });
  vi.mocked(findContactByPhone).mockReset();
  vi.mocked(findContactByPhone).mockImplementation(
    async (phone) =>
      [DHARTI_PERSON, RIYA_PERSON].find((person) => person.primaryPhone === phone) ??
      null,
  );
  vi.mocked(fetchLead).mockReset();
  vi.mocked(fetchLead).mockImplementation(
    async (leadId) => ({ id: leadId, contactId: LEAD_CONTACT_ID }) as LeadRecord,
  );
  vi.mocked(attachPatientImage).mockReset();
  signInTestMember();
});
afterEach(() => {
  vi.useRealTimers();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('PatientDrawer — New patient (KICKOFF §6.5)', () => {
  it('opens on step 1 with the design’s header, Quick fill and footer', async () => {
    renderCreate();
    const panel = await drawer();
    expect(within(panel).getByTestId('patient-drawer-title')).toHaveTextContent(
      'New patient',
    );
    expect(within(panel).getByText('Creates or updates the contact too')).toBeVisible();
    const quickFill = within(panel).getByTestId('patient-drawer-quick-fill');
    expect(
      within(quickFill)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(['Walk-in today', 'Referred by patient', 'From Instagram', 'LHR patient']);
    expect(within(panel).getByTestId('patient-drawer-step-contact')).toHaveAttribute(
      'data-status',
      'open',
    );
    expect(within(panel).getByRole('group', { name: 'Contact' })).toBeInTheDocument();
    expect(within(panel).getByLabelText(/^First name/)).toBeRequired();
    expect(within(panel).getByText('primary · WhatsApp')).toBeInTheDocument();
    // The badges — Aesthetic picked from the start (H:4685), the status — and the summary.
    expect(within(panel).getByTestId('patient-drawer-badges')).toHaveTextContent(
      'AestheticNew',
    );
    // Each summary part isolated: a name or a mobile stays whole on a right-to-left page.
    expect(within(panel).getByTestId('patient-drawer-footer')).toHaveTextContent(
      `${fsi('New patient')} · ${fsi('Aesthetic')}`,
    );
    expect(within(panel).getByTestId('patient-drawer-save')).toHaveTextContent(
      'Create patient',
    );
    expect(within(panel).getByText('Create & add another')).toBeInTheDocument();
    expect(await axeForDialog(panel)).toHaveNoViolations();
  });

  it('prefills First / Last name and Mobile from the URL', async () => {
    renderCreate({ name: 'Priya Shah Mehta', phone: '+919876543210' });
    await drawer();
    expect(screen.getByTestId('patient-drawer-first-name')).toHaveValue('Priya');
    expect(screen.getByTestId('patient-drawer-last-name')).toHaveValue('Shah Mehta');
    expect(screen.getByTestId('patient-drawer-mobile')).toHaveValue('98765 43210');
  });

  it('opens the step with an empty required field and says "Add name and mobile"', async () => {
    const user = setUser();
    const { onCreated } = renderCreate();
    const panel = await drawer();
    await user.click(within(panel).getByTestId('patient-drawer-step-contact-next'));
    expect(within(panel).getByTestId('patient-drawer-step-clinic')).toHaveAttribute(
      'data-status',
      'open',
    );
    await user.click(within(panel).getByTestId('patient-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add name and mobile');
    expect(within(panel).getByTestId('patient-drawer-step-contact')).toHaveAttribute(
      'data-status',
      'open',
    );
    expect(createPatient).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('stops a mobile that is not ten digits with "Enter a 10-digit mobile"', async () => {
    const user = setUser();
    const { onCreated } = renderCreate();
    await fillRequired(user, { mobile: '98765' });
    await user.click(screen.getByTestId('patient-drawer-save'));
    expect(notifyMock.warning).toHaveBeenCalledWith('Enter a 10-digit mobile');
    const mobile = screen.getByTestId('patient-drawer-mobile');
    expect(mobile).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a 10-digit mobile');
    expect(createPatient).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('creates the patient with a new person and toasts "Patient #3509 created" with "Open file"', async () => {
    const user = setUser();
    const { onCreated } = renderCreate();
    await fillRequired(user);
    await user.type(screen.getByTestId('patient-drawer-last-name'), 'Shah');
    await user.click(screen.getByTestId('patient-drawer-step-contact-next'));
    // New patients start as Aesthetic (H:4685); LHR joins it.
    await user.click(screen.getByTestId('patient-drawer-types-lhr'));
    expect(screen.getByTestId('patient-drawer-footer')).toHaveTextContent(
      `${fsi('Priya Shah')} · ${fsi('Aesthetic, LHR')} · ${fsi('+91 98765 00001')}`,
    );
    await user.click(screen.getByTestId('patient-drawer-save'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createPatient).toHaveBeenCalledTimes(1);
    expect(lastCreate()).toEqual({
      fields: {
        firstName: 'Priya',
        lastName: 'Shah',
        phone: '+919876500001',
        phone2: null,
        address: null,
        homeBranchId: expect.stringMatching(/.+/),
        gender: null,
        dateOfBirth: null,
        types: ['aesthetic', 'lhr'],
        status: 'new',
        conversion: null,
        referredByName: null,
        referralSource: null,
        followUpAt: null,
        notes: null,
        consents: [],
      },
      person: 'new',
      idempotencyKey: expect.any(String),
    });
    expect(onCreated.mock.calls[0]?.[0]).toMatchObject({
      id: NEW_PATIENT_ID,
      seq: 3509,
      name: 'Priya Shah',
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      expect.stringMatching(/^Patient #3509 created/),
      { action: { label: 'Open file', onClick: expect.any(Function) } },
    );
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it('fills fields from Quick fill without saving', async () => {
    const user = setUser();
    renderCreate();
    const panel = await drawer();
    await user.click(within(panel).getByTestId('patient-drawer-quick-fill-walkIn'));
    await user.click(within(panel).getByTestId('patient-drawer-step-contact-next'));
    expect(screen.getByTestId('patient-drawer-referrer-type-walk_in')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('patient-drawer-status-new')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(panel).getByTestId('patient-drawer-quick-fill-lhr'));
    expect(screen.getByTestId('patient-drawer-types-lhr')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // "LHR patient" sets LHR only.
    expect(screen.getByTestId('patient-drawer-types-aesthetic')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(notifyMock.success).not.toHaveBeenCalled();
    expect(createPatient).not.toHaveBeenCalled();
  });

  it('sets the follow-up from a quick chip computed from today', async () => {
    const user = setUser();
    renderCreate();
    await drawer();
    await user.click(screen.getByTestId('patient-drawer-step-contact-next'));
    const tomorrow = screen.getByTestId('patient-drawer-follow-up-tomorrow');
    expect(tomorrow).toHaveTextContent('Tomorrow 10:30');
    await user.click(tomorrow);
    expect(tomorrow).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('patient-drawer-follow-up-time')).toHaveTextContent(
      '10:30',
    );
  });

  it('warns about a mobile another patient already has, when the field loses focus', async () => {
    const user = setUser();
    renderCreate();
    await fillRequired(user, { mobile: DHARTI_DIGITS });
    await user.tab();
    const notice = await screen.findByTestId('patient-drawer-duplicate');
    expect(findContactByPhone).toHaveBeenCalledWith(DHARTI.phone);
    expect(notice).toHaveTextContent('Same mobile as Dharti Galani · #3508');
    // "Open file" once the patient on it is read.
    expect(
      await screen.findByTestId('patient-drawer-duplicate-action'),
    ).toHaveTextContent('Open file');
    expect(fetchPatient).toHaveBeenCalledWith(DHARTI.id);
    // Editing the mobile drops the notice until it is checked again.
    await user.type(screen.getByTestId('patient-drawer-mobile'), '{Backspace}');
    expect(screen.queryByTestId('patient-drawer-duplicate')).not.toBeInTheDocument();
  });

  it('opens the file on someone the clinic already knows, with a notice and no action', async () => {
    const user = setUser();
    const { onCreated } = renderCreate();
    await fillRequired(user, { first: 'Riya', mobile: RIYA_DIGITS });
    await user.tab();
    const notice = await screen.findByTestId('patient-drawer-duplicate');
    expect(notice).not.toHaveTextContent('Same mobile as');
    expect(screen.queryByTestId('patient-drawer-duplicate-action')).toBeNull();

    await user.click(screen.getByTestId('patient-drawer-save'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    // The new file is the known person's, not a new contact.
    expect(lastCreate().person).toEqual({ contactId: RIYA_PERSON.id });
    expect(onCreated.mock.calls[0]?.[0]).toMatchObject({ contactId: RIYA_PERSON.id });
  });

  it('opens the file on the lead’s person when New patient comes from a lead', async () => {
    const user = setUser();
    const { onCreated } = renderCreate({ name: 'Anaya Desai', leadId: LEAD_ID });
    await waitFor(() => expect(fetchLead).toHaveBeenCalledWith(LEAD_ID));
    await user.type(await screen.findByTestId('patient-drawer-mobile'), '9876500005');
    await user.click(screen.getByTestId('patient-drawer-save'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(lastCreate().person).toEqual({ contactId: LEAD_CONTACT_ID });
  });

  it('"Create & add another" saves, then restarts the drawer empty', async () => {
    const user = setUser();
    const { onCreated } = renderCreate({ name: 'Priya Shah' });
    await user.type(await screen.findByTestId('patient-drawer-mobile'), '9876500002');
    await user.click(screen.getByText('Create & add another'));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalledTimes(1));
    expect(createPatient).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByTestId('patient-drawer-first-name')).toHaveValue(''),
    );
    expect(screen.getByTestId('patient-drawer-mobile')).toHaveValue('');
  });

  it('keeps the draft when the connection drops, and saves again from "Retry"', async () => {
    const user = setUser();
    const { onCreated } = renderCreate();
    await fillRequired(user);
    vi.mocked(createPatient).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await user.click(screen.getByTestId('patient-drawer-save'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledTimes(1));
    expect(notifyMock.error).toHaveBeenCalledWith(
      'Couldn’t save · connection dropped. Everything you entered is still here.',
      {
        id: 'patient-save-failed',
        action: { label: 'Retry', onClick: expect.any(Function) },
      },
    );
    expect(screen.getByTestId('patient-drawer-save')).toHaveTextContent('Retry save');
    expect(screen.getByText('Not saved · your changes are kept')).toBeInTheDocument();
    expect(screen.getByTestId('patient-drawer-first-name')).toHaveValue('Priya');

    const [, options] = notifyMock.error.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createPatient).toHaveBeenCalledTimes(2);
  });

  it('outlines the field a validation error names and opens its step', async () => {
    const user = setUser();
    renderCreate();
    await fillRequired(user);
    vi.mocked(createPatient).mockRejectedValueOnce(
      new HttpError('Bad request', 400, '/app/patients', 'POST', {
        error: {
          type: 'validation_error',
          errors: [
            { field: 'body.follow_up_at', message: 'Pick a follow-up in the future' },
          ],
        },
      }),
    );
    await user.click(screen.getByTestId('patient-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Pick a follow-up in the future'),
    );
    expect(screen.getByTestId('patient-drawer-step-clinic')).toHaveAttribute(
      'data-status',
      'open',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a follow-up in the future');
    expect(screen.getByTestId('patient-drawer-save')).toHaveTextContent('Create patient');
  });

  it('reads the person’s fields under `contact` as the form’s own', async () => {
    const user = setUser();
    renderCreate();
    await fillRequired(user);
    await user.click(screen.getByTestId('patient-drawer-step-contact-next'));
    vi.mocked(createPatient).mockRejectedValueOnce(
      new HttpError('Bad request', 400, '/app/patients', 'POST', {
        error: {
          type: 'validation_error',
          errors: [{ field: 'body.contact.phones/0/phone', message: 'Not a mobile' }],
        },
      }),
    );
    await user.click(screen.getByTestId('patient-drawer-save'));
    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledWith('Not a mobile'));
    expect(screen.getByTestId('patient-drawer-step-contact')).toHaveAttribute(
      'data-status',
      'open',
    );
    expect(screen.getByTestId('patient-drawer-mobile')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows the duplicate notice when the server refuses the mobile as taken', async () => {
    const user = setUser();
    renderCreate();
    await fillRequired(user, { mobile: DHARTI_DIGITS });
    await user.click(screen.getByTestId('patient-drawer-step-contact-next'));
    vi.mocked(createPatient).mockRejectedValueOnce(
      new HttpError('Conflict', 409, '/app/patients', 'POST', {
        error: {
          reason: 'contact_phone_exists',
          detail: 'Another contact has this mobile',
        },
      }),
    );
    await user.click(screen.getByTestId('patient-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Another contact has this mobile'),
    );
    expect(await screen.findByTestId('patient-drawer-duplicate')).toHaveTextContent(
      'Same mobile as Dharti Galani · #3508',
    );
    // The draft stays, on the step that holds the mobile.
    expect(screen.getByTestId('patient-drawer-step-contact')).toHaveAttribute(
      'data-status',
      'open',
    );
    expect(screen.getByTestId('patient-drawer-first-name')).toHaveValue('Priya');
    expect(screen.getByTestId('patient-drawer-save')).toHaveTextContent('Create patient');
  });

  it('takes photos dropped on the zone, and lets a pick be removed', async () => {
    const user = setUser();
    renderCreate();
    await drawer();
    await user.click(screen.getByTestId('patient-drawer-step-contact-next'));
    const zone = screen.getByTestId('patient-drawer-photos');
    expect(zone).toHaveTextContent('Take or drop photos');
    expect(zone).toHaveTextContent('JPG or PNG · up to 10 MB each');
    const dropped = new File(['jpeg'], 'dropped.jpg', { type: 'image/jpeg' });
    fireEvent.dragOver(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [dropped] } });
    expect(screen.getByText('dropped.jpg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove dropped.jpg' }));
    expect(screen.queryByText('dropped.jpg')).not.toBeInTheDocument();
  });

  it('files the first photos on the new patient through the upload tray', async () => {
    const user = setUser();
    const { onCreated } = renderCreate();
    await fillRequired(user);
    await user.click(screen.getByTestId('patient-drawer-step-contact-next'));
    const photo = new File(['jpeg'], 'before.jpg', { type: 'image/jpeg' });
    const note = new File(['pdf'], 'consent.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByTestId('patient-drawer-photos-input'), [photo, note]);
    // Only images are taken; each pick is a removable chip.
    expect(screen.getByText('before.jpg')).toBeInTheDocument();
    expect(screen.queryByText('consent.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove before.jpg' })).toBeInTheDocument();

    await user.click(screen.getByTestId('patient-drawer-save'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(enqueueMock).toHaveBeenCalledWith([photo], {
      onUploaded: expect.any(Function),
    });
    expect(attachPatientImage).not.toHaveBeenCalled();
    const [, target] = enqueueMock.mock.calls[0] as [
      File[],
      { onUploaded: (key: string, file: File) => Promise<void> },
    ];
    await target.onUploaded('org/patients/before.jpg', photo);
    expect(attachPatientImage).toHaveBeenCalledWith({
      patientId: NEW_PATIENT_ID,
      fileKey: 'org/patients/before.jpg',
      fileName: 'before.jpg',
    });
  });
});

describe('PatientDrawer — Edit patient', () => {
  function renderEdit(onSaved = vi.fn(), patient: PatientRecord = DHARTI) {
    renderWithProviders(
      <PatientDrawer
        mode="edit"
        open
        patient={patient}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    return onSaved;
  }

  it('opens prefilled with the "#ID" tag, and saves with "<name> saved"', async () => {
    const user = setUser();
    asRole('admin');
    const onSaved = renderEdit();
    const panel = await drawer();
    expect(within(panel).getByTestId('patient-drawer-title')).toHaveTextContent(
      'Edit patient',
    );
    expect(within(panel).getByTestId('patient-drawer-tag')).toHaveTextContent('#3508');
    expect(
      within(panel).queryByTestId('patient-drawer-quick-fill'),
    ).not.toBeInTheDocument();
    expect(within(panel).getByTestId('patient-drawer-first-name')).toHaveValue('Dharti');
    expect(within(panel).getByTestId('patient-drawer-mobile')).toHaveValue('82006 03212');
    // The closed step peeks at its values.
    expect(
      within(panel).getByTestId('patient-drawer-step-clinic-peek'),
    ).toBeInTheDocument();

    await user.clear(within(panel).getByTestId('patient-drawer-last-name'));
    await user.type(within(panel).getByTestId('patient-drawer-last-name'), 'Patel');
    await user.click(within(panel).getByTestId('patient-drawer-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(updatePatient).toHaveBeenCalledWith({
      record: DHARTI,
      fields: expect.objectContaining({
        firstName: 'Dharti',
        lastName: 'Patel',
        phone: DHARTI.phone,
        status: 'regular',
        consents: ['data', 'photos'],
      }),
      idempotencyKey: expect.any(String),
    });
    expect(notifyMock.success).toHaveBeenCalledWith('Dharti Patel saved');
    expect(onSaved.mock.calls[0]?.[0]).toMatchObject({ lastName: 'Patel' });
  });

  it('never warns about the edited patient’s own mobile, but does about another’s', async () => {
    const user = setUser();
    asRole('admin');
    const raam = patientRecord({
      id: 'pat_raam00000000000000000',
      seq: 3441,
      firstName: 'Raam',
      lastName: 'Shah',
      name: 'Raam Shah',
      phone: '+919879521034',
    });
    renderEdit(vi.fn(), raam);
    const mobile = await screen.findByTestId('patient-drawer-mobile');
    await user.click(mobile);
    await user.tab();
    await waitFor(() => expect(findContactByPhone).toHaveBeenCalledWith(raam.phone));
    await lookupAnswered();
    expect(screen.queryByTestId('patient-drawer-duplicate')).not.toBeInTheDocument();

    await user.clear(mobile);
    await user.type(mobile, DHARTI_DIGITS);
    await user.tab();
    expect(await screen.findByTestId('patient-drawer-duplicate')).toHaveTextContent(
      'Same mobile as Dharti Galani · #3508',
    );

    // Someone the clinic knows without a file says nothing on an edit — only a create opens on them.
    await user.clear(mobile);
    await user.type(mobile, RIYA_DIGITS);
    await user.tab();
    await waitFor(() =>
      expect(findContactByPhone).toHaveBeenCalledWith(RIYA_PERSON.primaryPhone),
    );
    await lookupAnswered();
    expect(screen.queryByTestId('patient-drawer-duplicate')).not.toBeInTheDocument();
  });

  it('reads the patient again on a stale save and restarts the form on what was saved', async () => {
    const user = setUser();
    asRole('admin');
    const onSaved = renderEdit();
    const panel = await drawer();
    await user.clear(within(panel).getByTestId('patient-drawer-last-name'));
    await user.type(within(panel).getByTestId('patient-drawer-last-name'), 'Patel');
    // Someone saved Dharti meanwhile.
    const theirs = {
      ...DHARTI,
      lastName: 'Mehta',
      name: 'Dharti Mehta',
      updatedAt: NOW.toISOString(),
    };
    saved.set(DHARTI.id, theirs);
    vi.mocked(updatePatient).mockRejectedValueOnce(
      new HttpError('Conflict', 409, `/app/patients/${DHARTI.id}`, 'PATCH', {
        error: { reason: 'record_changed', detail: 'Someone saved this meanwhile' },
      }),
    );
    await user.click(within(panel).getByTestId('patient-drawer-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Someone saved this meanwhile', {
        id: 'patient-save-failed',
        action: { label: 'Reload', onClick: expect.any(Function) },
      }),
    );
    expect(onSaved).not.toHaveBeenCalled();

    const [, options] = notifyMock.error.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();
    await waitFor(() =>
      expect(within(panel).getByTestId('patient-drawer-last-name')).toHaveValue('Mehta'),
    );
    expect(fetchPatient).toHaveBeenCalledWith(DHARTI.id);

    // The next save carries what was read again.
    await user.click(within(panel).getByTestId('patient-drawer-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updatePatient).mock.lastCall?.[0].record).toMatchObject({
      lastName: 'Mehta',
      updatedAt: NOW.toISOString(),
    });
  });

  it('offers Delete with the delete ability, as "Delete this record?" with the summary', async () => {
    const user = setUser();
    asRole('admin');
    renderEdit();
    const panel = await drawer();
    await user.click(within(panel).getByTestId('patient-drawer-delete'));
    const confirm = await screen.findByTestId('confirm-dialog');
    expect(within(confirm).getByText('Delete this record?')).toBeInTheDocument();
    expect(within(confirm).getByTestId('confirm-record')).toHaveTextContent(
      'Dharti Galani',
    );
  });

  it('is view-only for a role without Edit: Close, no Save, the controls disabled', async () => {
    asRole('therapist');
    renderEdit();
    const panel = await drawer();
    await waitFor(() =>
      expect(within(panel).queryByTestId('patient-drawer-save')).not.toBeInTheDocument(),
    );
    expect(
      within(panel).getByText('View only · your role can’t change this'),
    ).toBeVisible();
    expect(within(panel).getByTestId('patient-drawer-first-name')).toBeDisabled();
    expect(within(panel).queryByTestId('patient-drawer-delete')).not.toBeInTheDocument();
  });

  it('answers from the member’s own codes: patient:update edits, Delete needs patient:delete', async () => {
    useOrganizationStore
      .getState()
      .setPermissions(['organization:read', 'patient:read', 'patient:update']);
    renderEdit();
    const panel = await drawer();
    await waitFor(() =>
      expect(within(panel).getByTestId('patient-drawer-first-name')).toBeEnabled(),
    );
    expect(within(panel).getByTestId('patient-drawer-save')).toBeInTheDocument();
    expect(within(panel).queryByTestId('patient-drawer-delete')).not.toBeInTheDocument();
  });

  it('is view-only for a member holding patient:read alone', async () => {
    useOrganizationStore.getState().setPermissions(['organization:read', 'patient:read']);
    renderEdit();
    const panel = await drawer();
    await waitFor(() =>
      expect(within(panel).queryByTestId('patient-drawer-save')).not.toBeInTheDocument(),
    );
    expect(within(panel).getByTestId('patient-drawer-first-name')).toBeDisabled();
  });
});

describe('PatientDrawer — quick-add (Q-P2)', () => {
  function renderQuick(query = 'Priya Shah') {
    const onPick = vi.fn();
    renderWithProviders(
      <PatientDrawer mode="quick" open query={query} onClose={vi.fn()} onPick={onPick} />,
    );
    return onPick;
  }

  it('stacks the same form: its own sub line, "Back", no summary, the query as the name', async () => {
    renderQuick();
    const panel = await drawer('patient-quick-add');
    expect(
      within(panel).getByText('What the clinic needs before a visit is completed'),
    ).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(
      within(panel).queryByTestId('patient-quick-add-quick-fill'),
    ).not.toBeInTheDocument();
    expect(within(panel).queryByText('Create & add another')).not.toBeInTheDocument();
    expect(within(panel).getByTestId('patient-quick-add-first-name')).toHaveValue(
      'Priya',
    );
    expect(within(panel).getByTestId('patient-quick-add-last-name')).toHaveValue('Shah');
    // Both mobiles read "10 digits" here; the room's drawer says "primary · WhatsApp".
    expect(within(panel).getAllByText('10 digits')).toHaveLength(2);
    expect(within(panel).queryByText('primary · WhatsApp')).not.toBeInTheDocument();
  });

  it('registers the patient, counts the photos it filed, and hands it to the parent', async () => {
    const user = setUser();
    const onPick = renderQuick();
    const panel = await drawer('patient-quick-add');
    await user.type(within(panel).getByTestId('patient-quick-add-mobile'), '9876500003');
    await user.click(within(panel).getByTestId('patient-quick-add-step-contact-next'));
    await user.upload(within(panel).getByTestId('patient-quick-add-photos-input'), [
      new File(['a'], 'a.jpg', { type: 'image/jpeg' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ]);
    await user.click(within(panel).getByTestId('patient-quick-add-save'));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(onPick.mock.calls[0]?.[0]).toMatchObject({ id: NEW_PATIENT_ID, seq: 3509 });
    expect(notifyMock.success).toHaveBeenCalledWith(
      'Priya Shah registered as patient #3509 · 2 photos filed',
    );
  });

  it('offers "Use existing" for a mobile another patient has, and hands that patient over', async () => {
    const user = setUser();
    const onPick = renderQuick();
    const panel = await drawer('patient-quick-add');
    await user.type(within(panel).getByTestId('patient-quick-add-mobile'), DHARTI_DIGITS);
    await user.tab();
    const action = await within(panel).findByTestId('patient-quick-add-duplicate-action');
    expect(action).toHaveTextContent('Use existing');
    await user.click(action);
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: DHARTI.id, seq: 3508, name: 'Dharti Galani' }),
    );
    expect(createPatient).not.toHaveBeenCalled();
  });

  it('starts from a booking’s prefill and raises the booking’s own toast (H:6039)', async () => {
    const user = setUser();
    const onPick = vi.fn();
    renderWithProviders(
      <PatientDrawer
        mode="quick"
        open
        prefill={{
          name: 'Riya Patel',
          phone: '+919876500004',
          types: ['lhr'],
          notes: 'Upper lip and chin',
        }}
        createdMessage={(patient) => `${patient.firstName} is now a patient`}
        onClose={vi.fn()}
        onPick={onPick}
      />,
    );
    const panel = await drawer('patient-quick-add');
    expect(within(panel).getByTestId('patient-quick-add-first-name')).toHaveValue('Riya');
    expect(within(panel).getByTestId('patient-quick-add-mobile')).toHaveValue(
      '98765 00004',
    );
    expect(within(panel).getByTestId('patient-quick-add-badges')).toHaveTextContent(
      'LHR',
    );
    await user.click(within(panel).getByTestId('patient-quick-add-save'));
    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(notifyMock.success).toHaveBeenCalledWith('Riya is now a patient');
    expect(lastCreate().fields).toMatchObject({
      types: ['lhr'],
      notes: 'Upper lip and chin',
    });
    expect(onPick.mock.calls[0]?.[0]).toMatchObject({
      types: ['lhr'],
      notes: 'Upper lip and chin',
    });
  });
});
