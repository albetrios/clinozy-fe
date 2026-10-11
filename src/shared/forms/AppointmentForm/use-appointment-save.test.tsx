import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appointmentQueryKeys } from '@/shared/api/app/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import type { Contact } from '@/shared/api/app/contacts-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  APPOINTMENT_NOW,
  APPOINTMENT_TODAY,
  appointmentRow,
  contactHit,
  DOCTOR_ARJUN,
  DOCTOR_NISHA,
  TEST_BRANCH_ID,
} from '@/tests/utils/appointment-doubles.ts';

const { notifyMock, appointmentsApi, contactsApi } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
  },
  appointmentsApi: {
    createAppointment: vi.fn(),
    copyAppointment: vi.fn(),
    updateAppointment: vi.fn(),
    moveAppointment: vi.fn(),
  },
  contactsApi: { createContact: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...appointmentsApi,
}));
vi.mock('@/shared/api/app/contacts-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...contactsApi,
}));

import {
  type AppointmentDraft,
  copyDraftOf,
  draftOf,
  emptyDraft,
  type WhoDraft,
  whoOfContact,
} from './appointment-form-model.ts';
import {
  saveProblem,
  useAppointmentSave,
  type UseAppointmentSaveOptions,
} from './use-appointment-save.ts';

/** Riya, a lead the search found. */
const RIYA: WhoDraft = whoOfContact(contactHit());

/** Meera, a person the search did not find. */
const MEERA: WhoDraft = {
  kind: 'new',
  contactId: null,
  name: 'Meera Iyer',
  phone: null,
  patientId: null,
  leadId: null,
  contactNumber: null,
};

const draft = (patch: Partial<AppointmentDraft> = {}): AppointmentDraft => ({
  ...emptyDraft('2026-10-05'),
  who: RIYA,
  doctorId: DOCTOR_NISHA.id,
  time: '11:00',
  ...patch,
});

/** A refusal in clinozy-be's error envelope. */
const refusal = (status: number, reason: string, detail: string) =>
  new HttpError(detail, status, '/app/appointments', 'POST', {
    error: { reason, detail },
  });

describe('saveProblem — the checks before the request (appointments.md:249)', () => {
  const now = APPOINTMENT_NOW;

  it('asks for who, a new contact’s mobile, the slot and the doctor, in that order', () => {
    expect(saveProblem('create', draft({ who: null }), null, now)).toBe('who');
    const fresh = draft({ who: MEERA });
    expect(saveProblem('create', fresh, null, now)).toBe('mobile');
    expect(saveProblem('create', { ...fresh, newPhone: '98111' }, null, now)).toBe(
      'mobile',
    );
    expect(
      saveProblem('create', { ...fresh, newPhone: '9811122233' }, null, now),
    ).toBeNull();
    expect(saveProblem('create', draft({ time: null }), null, now)).toBe('slot');
    expect(saveProblem('create', draft({ doctorId: null }), null, now)).toBe('doctor');
    expect(saveProblem('create', draft(), null, now)).toBeNull();
  });

  it('refuses a passed slot for a new or moved booking, never the saved one', () => {
    const past = draft({ date: APPOINTMENT_TODAY, time: '08:30' });
    expect(saveProblem('create', past, null, now)).toBe('passed');
    expect(saveProblem('create', { ...past, time: '09:00' }, null, now)).toBe('passed');
    const saved = {
      date: APPOINTMENT_TODAY,
      time: '08:30',
      status: 'checked_in' as const,
    };
    expect(saveProblem('edit', past, saved, now)).toBeNull();
    expect(saveProblem('edit', { ...past, time: '08:45' }, saved, now)).toBe('passed');
    expect(saveProblem('reschedule', past, saved, now)).toBe('passed');
  });
});

describe('useAppointmentSave — the write and its refusals', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const render = (options: Partial<UseAppointmentSaveOptions> = {}) => {
    const onProblem = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () =>
        useAppointmentSave({
          mode: 'create',
          row: null,
          branchId: TEST_BRANCH_ID,
          onProblem,
          onDone,
          ...options,
        }),
      { wrapper },
    );
    return { ...view, onProblem, onDone };
  };

  /** The booking the server answers a create or a copy with. */
  const booked = appointmentRow({
    id: 'appt_new000000000000000000',
    seq: 2870,
    date: '2026-10-05',
    startTime: '11:00',
    endTime: '11:20',
  });

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(APPOINTMENT_NOW);
    signInTestMember();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    for (const fn of [...Object.values(notifyMock), ...Object.values(appointmentsApi)]) {
      fn.mockReset();
    }
    contactsApi.createContact.mockReset();
    appointmentsApi.createAppointment.mockResolvedValue(booked);
    appointmentsApi.copyAppointment.mockResolvedValue(booked);
  });
  afterEach(() => {
    client.clear();
    vi.useRealTimers();
  });

  it('names the first problem and opens its step instead of writing', async () => {
    const { result, onProblem, onDone } = render();
    await act(() => result.current.save(draft({ doctorId: null })));
    expect(onProblem).toHaveBeenCalledWith('doctor');
    expect(notifyMock.warning).toHaveBeenCalledWith('Pick a doctor');
    await act(() => result.current.save(draft({ who: MEERA, newPhone: '98' })));
    expect(onProblem).toHaveBeenLastCalledWith('mobile');
    expect(notifyMock.warning).toHaveBeenLastCalledWith('Mobile needs 10 digits');
    await act(() =>
      result.current.save(draft({ date: APPOINTMENT_TODAY, time: '08:00' })),
    );
    expect(onProblem).toHaveBeenLastCalledWith('passed');
    expect(notifyMock.warning).toHaveBeenLastCalledWith(
      'That time has passed · pick a future slot',
    );
    expect(appointmentsApi.createAppointment).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.saveState).toBe('idle');
  });

  it('asks for an open branch before a new booking', async () => {
    const { result, onProblem } = render({ branchId: null });
    await act(() => result.current.save(draft()));
    expect(onProblem).toHaveBeenCalledWith('branch');
    expect(notifyMock.warning).toHaveBeenCalledWith('No open branch to book at');
    expect(appointmentsApi.createAppointment).not.toHaveBeenCalled();
  });

  it('books a known contact on the branch — no contact is created', async () => {
    const { result, onDone } = render();
    await act(() => result.current.save(draft({ reason: ' Acne ' })));
    expect(contactsApi.createContact).not.toHaveBeenCalled();
    expect(appointmentsApi.createAppointment).toHaveBeenCalledExactlyOnceWith({
      input: {
        contactId: 'con_riya00000000000000000',
        branchId: TEST_BRANCH_ID,
        doctorId: DOCTOR_NISHA.id,
        type: 'consultation',
        serviceLabel: 'Consultation',
        offeringId: null,
        durationMin: 20,
        date: '2026-10-05',
        startTime: '11:00',
        reason: 'Acne',
        notes: null,
      },
      idempotencyKey: expect.any(String),
    });
    expect(onDone).toHaveBeenCalledExactlyOnceWith({
      kind: 'created',
      appointment: booked,
    });
  });

  it('creates a new person as a contact first, then books them by its id', async () => {
    contactsApi.createContact.mockResolvedValue({
      id: 'con_meera0000000000000000',
    } as Contact);
    const { result, onDone } = render();
    await act(() => result.current.save(draft({ who: MEERA, newPhone: '9811122233' })));
    expect(contactsApi.createContact).toHaveBeenCalledExactlyOnceWith({
      fields: {
        firstName: 'Meera',
        lastName: 'Iyer',
        phones: [{ phone: '+919811122233', isOnWhatsapp: true }],
        instagramHandles: [],
        defaultChannel: 'whatsapp',
        preferenceTags: [],
      },
      idempotencyKey: expect.any(String),
    });
    expect(appointmentsApi.createAppointment).toHaveBeenCalledExactlyOnceWith({
      input: expect.objectContaining({ contactId: 'con_meera0000000000000000' }),
      idempotencyKey: expect.any(String),
    });
    expect(contactsApi.createContact.mock.invocationCallOrder[0]).toBeLessThan(
      appointmentsApi.createAppointment.mock.invocationCallOrder[0] ?? 0,
    );
    expect(onDone).toHaveBeenCalledWith({ kind: 'created', appointment: booked });
  });

  it('books a Copy as is through the copy route — the source on its new slot', async () => {
    const source = appointmentRow();
    const { result, onDone } = render({ source });
    await act(() =>
      result.current.save({
        ...copyDraftOf(source, APPOINTMENT_TODAY),
        date: '2026-10-05',
        time: '11:00',
      }),
    );
    expect(appointmentsApi.copyAppointment).toHaveBeenCalledExactlyOnceWith({
      appointmentId: source.id,
      date: '2026-10-05',
      startTime: '11:00',
      idempotencyKey: expect.any(String),
    });
    expect(appointmentsApi.createAppointment).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith({ kind: 'created', appointment: booked });
  });

  it('books a changed Copy as a new booking for the same person', async () => {
    const source = appointmentRow();
    const { result } = render({ source });
    await act(() =>
      result.current.save({
        ...copyDraftOf(source, APPOINTMENT_TODAY),
        date: '2026-10-05',
        time: '11:00',
        durationMin: 30,
        doctorId: DOCTOR_ARJUN.id,
      }),
    );
    expect(appointmentsApi.copyAppointment).not.toHaveBeenCalled();
    expect(appointmentsApi.createAppointment).toHaveBeenCalledExactlyOnceWith({
      input: expect.objectContaining({
        contactId: source.contactId,
        doctorId: DOCTOR_ARJUN.id,
        durationMin: 30,
      }),
      idempotencyKey: expect.any(String),
    });
  });

  describe('an edit', () => {
    const row: AppointmentRow = appointmentRow({ updatedAt: '2026-10-02T07:15:00.000Z' });

    it('saves the changed fields against the read, then the tile’s move', async () => {
      const updated = {
        ...row,
        startTime: '11:00',
        updatedAt: '2026-10-03T03:30:00.000Z',
      };
      const confirmed = { ...updated, status: 'confirmed' as const };
      appointmentsApi.updateAppointment.mockResolvedValue(updated);
      appointmentsApi.moveAppointment.mockResolvedValue(confirmed);
      const { result, onDone } = render({ mode: 'edit', row });
      await act(() =>
        result.current.save({
          ...draftOf(row),
          time: '11:00',
          reason: 'Pigmentation',
          status: 'confirmed',
        }),
      );
      expect(appointmentsApi.updateAppointment).toHaveBeenCalledExactlyOnceWith({
        appointmentId: row.id,
        fields: { reason: 'Pigmentation', startTime: '11:00' },
        expectedUpdatedAt: '2026-10-02T07:15:00.000Z',
        idempotencyKey: expect.any(String),
      });
      expect(appointmentsApi.moveAppointment).toHaveBeenCalledExactlyOnceWith({
        appointmentId: row.id,
        route: 'confirm',
        idempotencyKey: expect.any(String),
      });
      expect(appointmentsApi.updateAppointment.mock.invocationCallOrder[0]).toBeLessThan(
        appointmentsApi.moveAppointment.mock.invocationCallOrder[0] ?? 0,
      );
      expect(onDone).toHaveBeenCalledExactlyOnceWith({
        kind: 'updated',
        appointment: confirmed,
      });
    });

    it('moves the status alone when only a tile changed', async () => {
      const confirmed = { ...row, status: 'confirmed' as const };
      appointmentsApi.moveAppointment.mockResolvedValue(confirmed);
      const { result, onDone } = render({ mode: 'edit', row });
      await act(() => result.current.save({ ...draftOf(row), status: 'confirmed' }));
      expect(appointmentsApi.updateAppointment).not.toHaveBeenCalled();
      expect(appointmentsApi.moveAppointment).toHaveBeenCalledWith(
        expect.objectContaining({ route: 'confirm' }),
      );
      expect(onDone).toHaveBeenCalledWith({ kind: 'updated', appointment: confirmed });
    });

    it('writes nothing when nothing changed', async () => {
      const { result, onDone } = render({ mode: 'edit', row });
      await act(() => result.current.save(draftOf(row)));
      expect(appointmentsApi.updateAppointment).not.toHaveBeenCalled();
      expect(appointmentsApi.moveAppointment).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith({ kind: 'updated', appointment: row });
    });
  });

  it('answers a slot someone took with "Just taken · pick another slot" and reads the slots again', async () => {
    appointmentsApi.createAppointment.mockRejectedValue(
      refusal(409, 'slot_taken', 'That slot is no longer free'),
    );
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result, onDone } = render();
    await act(() => result.current.save(draft()));
    expect(notifyMock.error).toHaveBeenCalledExactlyOnceWith(
      'Just taken · pick another slot',
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: appointmentQueryKeys.slotDays('org_test'),
    });
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.saveState).toBe('idle');
  });

  it('toasts another slot refusal in the server’s words, and reads the slots again', async () => {
    appointmentsApi.createAppointment.mockRejectedValue(
      refusal(409, 'slot_outside_hours', 'Dr. Nisha is not in at 11:00 that day'),
    );
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = render();
    await act(() => result.current.save(draft()));
    expect(notifyMock.error).toHaveBeenCalledExactlyOnceWith(
      'Dr. Nisha is not in at 11:00 that day',
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: appointmentQueryKeys.slotDays('org_test'),
    });
    expect(result.current.saveState).toBe('idle');
  });

  it('toasts any other refusal in the server’s words and keeps the draft', async () => {
    appointmentsApi.createAppointment.mockRejectedValue(
      refusal(422, 'validation', 'Reason is too long'),
    );
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result, onDone } = render();
    await act(() => result.current.save(draft()));
    expect(notifyMock.error).toHaveBeenCalledExactlyOnceWith('Reason is too long');
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: appointmentQueryKeys.slotDays('org_test'),
    });
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.saveState).toBe('idle');
  });

  it('keeps the draft after a failed connection: "failed", and a toast whose Retry saves again', async () => {
    appointmentsApi.createAppointment.mockRejectedValueOnce(
      new HttpError('Service unavailable', 503, '/app/appointments', 'POST'),
    );
    const { result, onDone } = render();
    await act(() => result.current.save(draft()));
    expect(result.current.saveState).toBe('failed');
    const [message, options] = notifyMock.error.mock.lastCall ?? [];
    expect(message).toBe(
      'Couldn’t save · connection dropped. Everything you entered is still here.',
    );
    expect(options).toMatchObject({
      id: 'appointment-save-failed',
      action: { label: 'Retry' },
    });
    expect(onDone).not.toHaveBeenCalled();
    // "Retry" sends the same draft again — this time the server books it.
    await act(async () => {
      options.action.onClick();
    });
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(appointmentsApi.createAppointment).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledWith({ kind: 'created', appointment: booked });
  });
});
