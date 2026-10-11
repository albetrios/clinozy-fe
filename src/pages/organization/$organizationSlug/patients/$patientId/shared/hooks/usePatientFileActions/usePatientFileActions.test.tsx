import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { fetchInvoiceTotals } from '@/shared/api/app/invoices-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import {
  patientFile,
  TEST_CONTACT_ID,
  TEST_PATIENT_ID,
} from '@/tests/utils/patient-doubles.ts';
import { shownLocation } from '@/tests/utils/shown-location.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { usePatientFileActions } from './usePatientFileActions.ts';

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
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchInvoiceTotals: vi.fn(),
}));

const FILE = `/organization/acme/patients/${TEST_PATIENT_ID}`;

/** Each item as a button, and each section's primary item. */
function ActionsProbe() {
  const { items, primaryFor } = usePatientFileActions();
  return (
    <div>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={item.run}>
          {item.id}
        </button>
      ))}
      <output data-testid="primaries">
        {(
          [
            'visits',
            'prescriptions',
            'treatments',
            'images',
            'reports',
            'invoices',
            'payments',
            'timeline',
            'packages',
            'notes',
          ] as const
        )
          .map((section) => `${section}:${primaryFor(section)?.id ?? '-'}`)
          .join(' ')}
      </output>
    </div>
  );
}

/** Moves the visit `appt_next…`. */
function RescheduleProbe() {
  const { reschedule } = usePatientFileActions();
  return (
    <button
      type="button"
      onClick={() => reschedule({ appointmentId: 'appt_next00000000000000000' })}
    >
      reschedule
    </button>
  );
}

const itemIds = () =>
  screen
    .getAllByRole('button')
    .map((button) => button.textContent)
    .filter(Boolean);

/** The member signed in, now holding exactly these codes. */
function signedInWith(codes: OrganizationPermission[]) {
  act(() => {
    useOrganizationStore.getState().setPermissions(['organization:read', ...codes]);
  });
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  // She owes ₹100 over every invoice of hers — the server's `meta.due_total`.
  vi.mocked(fetchInvoiceTotals).mockReset();
  vi.mocked(fetchInvoiceTotals).mockResolvedValue({ due: 100, paid: 400, count: 1 });
});
afterEach(() => {
  resetPatientFile();
});

describe('usePatientFileActions', () => {
  it('offers the Owner the eight items in the menu’s order', async () => {
    renderInPatientFile(<ActionsProbe />, { file: patientFile(), role: 'owner' });
    await screen.findByRole('button', { name: 'prescription' });
    expect(itemIds()).toEqual([
      'prescription',
      'treatment',
      'invoice',
      'payment',
      'photo',
      'appointment',
      'report',
      'note',
    ]);
  });

  it('gives each section its own primary — New invoice, Record payment on the billing ones', async () => {
    renderInPatientFile(<ActionsProbe />, { file: patientFile(), role: 'owner' });
    await screen.findByRole('button', { name: 'prescription' });
    expect(screen.getByTestId('primaries')).toHaveTextContent(
      [
        'visits:appointment',
        'prescriptions:prescription',
        'treatments:treatment',
        'images:photo',
        'reports:report',
        'invoices:invoice',
        'payments:payment',
        'timeline:-',
        'packages:-',
        'notes:-',
      ].join(' '),
    );
  });

  it('gives an Admin the Rx and the treatment (S:35, 38)', async () => {
    renderInPatientFile(<ActionsProbe />, { file: patientFile() });
    await screen.findByRole('button', { name: 'prescription' });
    expect(itemIds()).toContain('treatment');
  });

  it('keeps the Rx and treatment items from a Front desk, who holds neither code (S:35, 38)', async () => {
    renderInPatientFile(<ActionsProbe />, { file: patientFile(), role: 'front_desk' });
    await screen.findByRole('button', { name: 'appointment' });
    expect(itemIds()).toEqual([
      'invoice',
      'payment',
      'photo',
      'appointment',
      'report',
      'note',
    ]);
  });

  it('asks a signed-in member’s own codes for every item', async () => {
    renderInPatientFile(<ActionsProbe />, { file: patientFile() });
    await screen.findByRole('button', { name: 'prescription' });

    signedInWith(['patient:read']);
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'prescription' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    signedInWith(['patient:read', 'patient_treatment:create', 'appointment:create']);
    expect(await screen.findByRole('button', { name: 'treatment' })).toBeInTheDocument();
    expect(itemIds()).toEqual(['treatment', 'appointment']);

    signedInWith([
      'patient:read',
      'patient:create',
      'patient:update',
      'patient_prescription:create',
    ]);
    expect(
      await screen.findByRole('button', { name: 'prescription' }),
    ).toBeInTheDocument();
    expect(itemIds()).toEqual(['prescription', 'photo', 'report', 'note']);

    signedInWith(['patient:read', 'payment:read', 'payment:create']);
    expect(await screen.findByRole('button', { name: 'invoice' })).toBeInTheDocument();
    expect(itemIds()).toEqual(['invoice', 'payment']);
  });

  it('bills the patient in the Invoice drawer over her section (A-P1)', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, {
      file: patientFile(),
      section: 'invoices',
    });
    await user.click(await screen.findByRole('button', { name: 'invoice' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/invoices/create'),
    );
    expect(shownLocation(router).search).toEqual({
      type: 'clinic',
      patient: TEST_PATIENT_ID,
      from: `patients/${TEST_PATIENT_ID}/invoices`,
    });
    expect(router.state.location.pathname).toBe(`${FILE}/invoices`);
  });

  it('receives a payment from her while the server says she owes', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, {
      file: patientFile(),
      section: 'payments',
    });
    await waitFor(() => expect(fetchInvoiceTotals).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: 'payment' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe('/organization/acme/payments/receive'),
    );
    expect(shownLocation(router).search).toEqual({
      patient: TEST_PATIENT_ID,
      from: `patients/${TEST_PATIENT_ID}/payments`,
    });
    expect(fetchInvoiceTotals).toHaveBeenCalledWith({ patientId: TEST_PATIENT_ID });
  });

  it('says "Nothing due" instead of Receive when the server says she owes nothing', async () => {
    vi.mocked(fetchInvoiceTotals).mockResolvedValue({ due: 0, paid: 400, count: 1 });
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, {
      file: patientFile(),
      section: 'payments',
    });
    await waitFor(() => expect(fetchInvoiceTotals).toHaveBeenCalled());
    const payment = await screen.findByRole('button', { name: 'payment' });
    await waitFor(async () => {
      await user.click(payment);
      expect(notifyMock.info).toHaveBeenCalled();
    });
    expect(router.state.location.pathname).toBe(`${FILE}/payments`);
    expect(shownLocation(router).pathname).toBe(`${FILE}/payments`);
  });

  it('opens a record’s drawer over its section', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, {
      file: patientFile(),
      role: 'owner',
    });
    for (const [item, path] of [
      ['prescription', 'prescriptions/create'],
      ['treatment', 'treatments/create'],
      ['report', 'reports/create'],
    ] as const) {
      await user.click(await screen.findByRole('button', { name: item }));
      await waitFor(() => expect(router.state.location.pathname).toBe(`${FILE}/${path}`));
    }
  });

  it('books an appointment for the patient’s person', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, { file: patientFile() });
    await user.click(await screen.findByRole('button', { name: 'appointment' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    // `who=` the contact id — the booking is the person's.
    expect(shownLocation(router).search).toEqual({
      who: TEST_CONTACT_ID,
      from: `patients/${TEST_PATIENT_ID}/visits`,
    });
  });

  it('keeps the file behind the booking (A-P1)', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, { file: patientFile() });
    await user.click(await screen.findByRole('button', { name: 'appointment' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/create',
      ),
    );
    expect(router.state.location.pathname).toBe(`${FILE}/visits`);
  });

  it('opens the photo picker for General, then Photos (KICKOFF §6.6 Add menu)', async () => {
    const user = userEvent.setup();
    const photos = { pick: vi.fn(), upload: vi.fn() };
    const { router } = renderInPatientFile(<ActionsProbe />, {
      file: patientFile(),
      photos,
    });
    await user.click(await screen.findByRole('button', { name: 'photo' }));
    expect(photos.pick).toHaveBeenCalledWith('general');
    await waitFor(() => expect(router.state.location.pathname).toBe(`${FILE}/images`));
  });

  it('opens Team notes for a note', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<ActionsProbe />, { file: patientFile() });
    await user.click(await screen.findByRole('button', { name: 'note' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${FILE}/notes`));
  });

  it('moves a booked visit: the appointment form in reschedule mode, the file behind it', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<RescheduleProbe />, {
      file: patientFile(),
      section: 'timeline',
    });
    await user.click(await screen.findByRole('button', { name: 'reschedule' }));
    await waitFor(() =>
      expect(shownLocation(router).pathname).toBe(
        '/organization/acme/appointments/appt_next00000000000000000',
      ),
    );
    expect(shownLocation(router).search).toEqual({
      mode: 'reschedule',
      from: `patients/${TEST_PATIENT_ID}/timeline`,
    });
  });

  it('moves a visit from outside a section with no way back', async () => {
    const user = userEvent.setup();
    const { router } = renderInPatientFile(<RescheduleProbe />, {
      file: patientFile(),
      section: null,
    });
    await user.click(await screen.findByRole('button', { name: 'reschedule' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/organization/acme/appointments/appt_next00000000000000000',
      ),
    );
    expect(router.state.location.search).toEqual({ mode: 'reschedule' });
  });
});
