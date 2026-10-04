import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as PatientsApiModule from '@/shared/api/clinic/patients-api.ts';
import type { PatientRecord } from '@/shared/api/clinic/patients-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
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

/** The next create fails with this, once. */
const api = vi.hoisted(() => ({ createError: null as unknown }));
vi.mock('@/shared/api/clinic/patients-api.ts', async (importOriginal) => {
  const original = await importOriginal<typeof PatientsApiModule>();
  return {
    ...original,
    createPatient: async (input: Parameters<typeof original.createPatient>[0]) => {
      const error = api.createError;
      if (error) {
        api.createError = null;
        throw error;
      }
      return original.createPatient(input);
    },
  };
});

import { PatientDrawer } from './PatientDrawer.tsx';

/** 10:00 on 3 Oct, clinic time — the seed day is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const DHARTI = patientRef('Dharti Galani');

const dharti = () => {
  const [patient] = clinicFixtures.patients.snapshot((record) => record.id === DHARTI);
  if (!patient) throw new Error('the seed lost Dharti');
  return patient;
};

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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  viewport.tier = 'desktop';
  api.createError = null;
  enqueueMock.mockReset();
  enqueueMock.mockImplementation((files: readonly File[]) => ({
    accepted: files.length,
    skipped: 0,
  }));
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
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
    expect(within(panel).getByTestId('patient-drawer-footer')).toHaveTextContent(
      'New patient · Aesthetic',
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
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('creates the patient with the onboarding task and toasts "Open file"', async () => {
    const user = setUser();
    const { onCreated } = renderCreate({ leadId: undefined });
    await fillRequired(user);
    await user.type(screen.getByTestId('patient-drawer-last-name'), 'Shah');
    await user.click(screen.getByTestId('patient-drawer-step-contact-next'));
    // New patients start as Aesthetic (H:4685); LHR joins it.
    await user.click(screen.getByTestId('patient-drawer-types-lhr'));
    expect(screen.getByTestId('patient-drawer-footer')).toHaveTextContent(
      'Priya Shah · Aesthetic, LHR · +91 98765 00001',
    );
    await user.click(screen.getByTestId('patient-drawer-save'));

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    const created = onCreated.mock.calls[0]?.[0] as PatientRecord;
    expect(created).toMatchObject({
      firstName: 'Priya',
      lastName: 'Shah',
      phone: '+919876500001',
      types: ['aesthetic', 'lhr'],
      status: 'new',
    });
    expect(notifyMock.success).toHaveBeenCalledWith(
      `Patient #${created.seq} created · onboarding task added`,
      { action: { label: 'Open file', onClick: expect.any(Function) } },
    );
    expect(
      clinicFixtures.tasks.snapshot(
        (task) => task.patientId === created.id && task.title === 'Onboarding',
      ),
    ).toHaveLength(1);
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
    const digits = dharti().phone.slice(3);
    await fillRequired(user, { mobile: digits });
    await user.tab();
    const notice = await screen.findByTestId('patient-drawer-duplicate');
    expect(notice).toHaveTextContent(`Same mobile as Dharti Galani · #${dharti().seq}`);
    expect(screen.getByTestId('patient-drawer-duplicate-action')).toHaveTextContent(
      'Open file',
    );
    // Editing the mobile drops the notice until it is checked again.
    await user.type(screen.getByTestId('patient-drawer-mobile'), '{Backspace}');
    expect(screen.queryByTestId('patient-drawer-duplicate')).not.toBeInTheDocument();
  });

  it('"Create & add another" saves, then restarts the drawer empty', async () => {
    const user = setUser();
    const { onCreated } = renderCreate({ name: 'Priya Shah' });
    await user.type(await screen.findByTestId('patient-drawer-mobile'), '9876500002');
    await user.click(screen.getByText('Create & add another'));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalledTimes(1));
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
    api.createError = new TypeError('Failed to fetch');
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
  });

  it('outlines the field a validation error names and opens its step', async () => {
    const user = setUser();
    renderCreate();
    await fillRequired(user);
    api.createError = new HttpError('Unprocessable', 422, '/api/patients', 'POST', {
      error: { fields: { followUpAt: ['Pick a follow-up in the future'] } },
    });
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

  it('shows the duplicate notice when the server refuses the mobile as taken', async () => {
    const user = setUser();
    renderCreate();
    await fillRequired(user, { mobile: dharti().phone.slice(3) });
    api.createError = new HttpError('Conflict', 409, '/api/patients', 'POST', {
      error: { detail: 'A patient with this phone exists' },
    });
    await user.click(screen.getByTestId('patient-drawer-save'));
    expect(await screen.findByTestId('patient-drawer-duplicate')).toHaveTextContent(
      'Same mobile as Dharti Galani',
    );
    expect(notifyMock.error).toHaveBeenCalledWith('A patient with this phone exists');
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

  it('files the first photos through the upload tray once the patient exists', async () => {
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
    const created = onCreated.mock.calls[0]?.[0] as PatientRecord;
    expect(enqueueMock).toHaveBeenCalledWith([photo], {
      onUploaded: expect.any(Function),
    });
    const [, target] = enqueueMock.mock.calls[0] as [
      File[],
      { onUploaded: (key: string, file: File) => Promise<void> },
    ];
    await target.onUploaded('org/patients/before.jpg', photo);
    expect(
      clinicFixtures.patientImages.snapshot((image) => image.patientId === created.id),
    ).toHaveLength(1);
  });
});

describe('PatientDrawer — Edit patient', () => {
  function renderEdit(onSaved = vi.fn()) {
    renderWithProviders(
      <PatientDrawer
        mode="edit"
        open
        patient={dharti()}
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
    expect(within(panel).getByTestId('patient-drawer-tag')).toHaveTextContent(
      `#${dharti().seq}`,
    );
    expect(
      within(panel).queryByTestId('patient-drawer-quick-fill'),
    ).not.toBeInTheDocument();
    expect(within(panel).getByTestId('patient-drawer-first-name')).toHaveValue('Dharti');
    // The closed step peeks at its values.
    expect(
      within(panel).getByTestId('patient-drawer-step-clinic-peek'),
    ).toBeInTheDocument();

    await user.clear(within(panel).getByTestId('patient-drawer-last-name'));
    await user.type(within(panel).getByTestId('patient-drawer-last-name'), 'Patel');
    await user.click(within(panel).getByTestId('patient-drawer-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(notifyMock.success).toHaveBeenCalledWith('Dharti Patel saved');
    expect(dharti().lastName).toBe('Patel');
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
    const created = onPick.mock.calls[0]?.[0] as PatientRecord;
    expect(notifyMock.success).toHaveBeenCalledWith(
      `Priya Shah registered as patient #${created.seq} · 2 photos filed`,
    );
  });

  it('offers "Use existing" for a mobile another patient has, and hands that patient over', async () => {
    const user = setUser();
    const onPick = renderQuick();
    const panel = await drawer('patient-quick-add');
    await user.type(
      within(panel).getByTestId('patient-quick-add-mobile'),
      dharti().phone.slice(3),
    );
    await user.tab();
    const action = await within(panel).findByTestId('patient-quick-add-duplicate-action');
    expect(action).toHaveTextContent('Use existing');
    await user.click(action);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: DHARTI }));
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
    const created = onPick.mock.calls[0]?.[0] as PatientRecord;
    expect(created).toMatchObject({ types: ['lhr'], notes: 'Upper lip and chin' });
  });
});
