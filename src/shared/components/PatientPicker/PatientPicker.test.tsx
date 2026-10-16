import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

const notifyMock = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  searchContacts: vi.fn(),
  fetchRecentContacts: vi.fn(),
  findContactByPhone: vi.fn(),
}));
vi.mock('@/shared/api/app/patients-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatient: vi.fn(),
  createPatient: vi.fn(),
}));
import {
  fetchRecentContacts,
  findContactByPhone,
  searchContacts,
} from '@/shared/api/app/contacts-api.ts';
import type { ContactHit } from '@/shared/api/app/contacts-contracts.ts';
import { createPatient, fetchPatient } from '@/shared/api/app/patients-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { patientRecord } from '@/tests/utils/patient-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import type { PatientPick } from './patient-pick.ts';
import { PatientPicker } from './PatientPicker.tsx';

const viewport = vi.hoisted(() => ({ tier: 'desktop' as ViewportTier }));
vi.mock('@/shared/hooks/useViewportTier/index.ts', () => ({
  useViewportTier: () => viewport.tier,
  readViewportTier: () => viewport.tier,
}));

/** Kiran Desai — patient #3441 — as the search finds her. */
const KIRAN: ContactHit = {
  id: 'con_kiran0000000000000000',
  contactNumber: 18,
  firstName: 'Kiran',
  lastName: 'Desai',
  name: 'Kiran Desai',
  primaryPhone: '+919879122840',
  email: null,
  instagramHandles: [],
  defaultChannel: 'whatsapp',
  preferenceTags: [],
  patientId: 'pat_kiran0000000000000000',
  patientNumber: 3441,
  openLeadId: null,
  lastActivityAt: null,
  lastReceivedAt: null,
  isAwaitingReply: false,
  updatedAt: '2026-10-09T20:01:53.622Z',
};

/** What a pick of Kiran hands back. */
const KIRAN_PICK: PatientPick = {
  id: 'pat_kiran0000000000000000',
  contactId: 'con_kiran0000000000000000',
  name: 'Kiran Desai',
  phone: '+919879122840',
};

/** The field as a form holds it: the id, and what the last pick handed back. */
function Field({ onPick }: { onPick: (patient: PatientPick | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <PatientPicker
      value={value}
      onChange={(patient) => {
        setValue(patient?.id ?? null);
        onPick(patient);
      }}
    />
  );
}

/** Open the field and start a quick add from what was typed. */
async function quickAdd(user: ReturnType<typeof userEvent.setup>, typed: string) {
  await user.click(await screen.findByTestId('patient-picker'));
  await user.type(await screen.findByTestId('patient-picker-search'), typed);
  await user.click(await screen.findByTestId('patient-picker-create'));
}

const setup = () =>
  userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

beforeEach(() => {
  vi.resetAllMocks();
  viewport.tier = 'desktop';
  signInTestMember();
  vi.mocked(fetchRecentContacts).mockResolvedValue([]);
  vi.mocked(searchContacts).mockResolvedValue([]);
  vi.mocked(findContactByPhone).mockResolvedValue(null);
  vi.mocked(fetchPatient).mockImplementation(async (id) =>
    patientRecord({ id, seq: 3441, name: 'Kiran Desai', firstName: 'Kiran' }),
  );
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('PatientPicker — the shared contact picker over the patients (D23)', () => {
  it('searches only patients, shows each as “#3441 · mobile”, and hands back the pick', async () => {
    vi.mocked(searchContacts).mockResolvedValue([KIRAN]);
    const user = setup();
    const onPick = vi.fn();
    const { container } = renderWithProviders(<Field onPick={onPick} />);
    const trigger = await screen.findByTestId('patient-picker');
    expect(trigger).toHaveTextContent('Search patients');
    expect(await axe(container)).toHaveNoViolations();

    await user.click(trigger);
    await user.type(await screen.findByTestId('patient-picker-search'), 'Kiran');
    const option = await screen.findByTestId(`patient-picker-option-${KIRAN.patientId}`);
    expect(option).toHaveTextContent(`${fsi('#3441')} · ${fsi('+91 98791 22840')}`);
    // Picking only takes the patient: the row says nothing more (change-natural-contact-search D8).
    expect(option).not.toHaveTextContent('Use patient');
    expect(searchContacts).toHaveBeenCalledWith('Kiran', 'patients');

    await user.click(option);
    expect(onPick).toHaveBeenCalledWith(KIRAN_PICK);
    await waitFor(() => expect(trigger).toHaveTextContent('Kiran Desai'));
    expect(trigger).toHaveAccessibleName('Patient · Kiran Desai');
    expect(screen.queryByTestId('patient-picker-panel')).toBeNull();
  });

  it('offers the patients last in touch before anything is typed', async () => {
    vi.mocked(fetchRecentContacts).mockResolvedValue([KIRAN]);
    const user = setup();
    renderWithProviders(<Field onPick={vi.fn()} />);
    await user.click(await screen.findByTestId('patient-picker'));
    const panel = await screen.findByTestId('patient-picker-panel');
    expect(await within(panel).findByText('Kiran Desai')).toBeInTheDocument();
    expect(fetchRecentContacts).toHaveBeenCalledWith('patients');
    expect(within(panel).getByTestId('patient-picker-create')).toHaveTextContent(
      'New patient',
    );
  });

  it('registers someone nobody has on file — New patient from a name and a mobile', async () => {
    vi.mocked(createPatient).mockResolvedValue(
      patientRecord({
        id: 'pat_meera0000000000000000',
        contactId: 'con_meera0000000000000000',
        name: 'Meera Rao',
        firstName: 'Meera',
        phone: '+919825011299',
      }),
    );
    const user = setup();
    const onPick = vi.fn();
    renderWithProviders(<Field onPick={onPick} />);
    await quickAdd(user, 'Meera Rao 9825011299');
    expect(screen.getByTestId('patient-picker-quick-add')).toHaveTextContent(
      'New patient',
    );
    await user.click(screen.getByTestId('patient-picker-quick-add-submit'));

    await waitFor(() =>
      expect(onPick).toHaveBeenCalledWith({
        id: 'pat_meera0000000000000000',
        contactId: 'con_meera0000000000000000',
        name: 'Meera Rao',
        phone: '+919825011299',
      }),
    );
    expect(findContactByPhone).toHaveBeenCalledWith('+919825011299');
    expect(createPatient).toHaveBeenCalledWith(
      expect.objectContaining({
        person: 'new',
        fields: expect.objectContaining({
          firstName: 'Meera',
          lastName: 'Rao',
          phone: '+919825011299',
          status: 'new',
        }),
      }),
    );
    expect(notifyMock.success).toHaveBeenCalledWith(
      `${fsi('Meera Rao')} added as a patient`,
    );
  });

  it('picks the patient already on that mobile instead of a second file', async () => {
    vi.mocked(findContactByPhone).mockResolvedValue({ ...KIRAN, gender: null } as never);
    const user = setup();
    const onPick = vi.fn();
    renderWithProviders(<Field onPick={onPick} />);
    await quickAdd(user, 'Kiran 9879122840');
    await user.click(screen.getByTestId('patient-picker-quick-add-submit'));

    await waitFor(() => expect(onPick).toHaveBeenCalledWith(KIRAN_PICK));
    expect(createPatient).not.toHaveBeenCalled();
    expect(notifyMock.info).toHaveBeenCalledWith(
      `${fsi('Kiran Desai')} is already a patient · picked`,
    );
  });

  it('opens a file on someone the clinic knows without one', async () => {
    vi.mocked(findContactByPhone).mockResolvedValue({
      ...KIRAN,
      patientId: null,
      patientNumber: null,
    } as never);
    vi.mocked(createPatient).mockResolvedValue(
      patientRecord({ id: 'pat_new00000000000000000', contactId: KIRAN.id }),
    );
    const user = setup();
    renderWithProviders(<Field onPick={vi.fn()} />);
    await quickAdd(user, 'Kiran 9879122840');
    await user.click(screen.getByTestId('patient-picker-quick-add-submit'));
    await waitFor(() =>
      expect(createPatient).toHaveBeenCalledWith(
        expect.objectContaining({ person: { contactId: KIRAN.id } }),
      ),
    );
  });

  it('says why and keeps the quick add when the mobile cannot be looked up', async () => {
    vi.mocked(findContactByPhone).mockRejectedValue(
      new HttpError('Offline', 503, '/app/contacts', 'GET'),
    );
    const user = setup();
    const onPick = vi.fn();
    renderWithProviders(<Field onPick={onPick} />);
    await quickAdd(user, 'Meera Rao 9825011299');
    await user.click(screen.getByTestId('patient-picker-quick-add-submit'));

    await waitFor(() => expect(notifyMock.error).toHaveBeenCalledOnce());
    expect(createPatient).not.toHaveBeenCalled();
    expect(screen.getByTestId('patient-picker-quick-add-mobile')).toHaveValue(
      '98250 11299',
    );
    expect(onPick).not.toHaveBeenCalled();
  });

  it('keeps the quick add as typed when the file cannot be made', async () => {
    vi.mocked(createPatient).mockRejectedValue(
      new HttpError('Forbidden', 403, '/app/patients', 'POST'),
    );
    const user = setup();
    const onPick = vi.fn();
    renderWithProviders(<Field onPick={onPick} />);
    await quickAdd(user, 'Meera Rao 9825011299');
    await user.click(screen.getByTestId('patient-picker-quick-add-submit'));

    await waitFor(() => expect(createPatient).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByTestId('patient-picker-quick-add-submit')).not.toHaveAttribute(
        'aria-busy',
      ),
    );
    expect(screen.getByTestId('patient-picker-quick-add-name')).toHaveValue('Meera Rao');
    expect(onPick).not.toHaveBeenCalled();
  });
});
