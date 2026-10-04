import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/clinic/appointments-api.ts';
import { clinicHttpError } from '@/shared/api/clinic/clinic-fixture-store.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';

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

/** What the next create does: throw this, or book. */
const api = vi.hoisted(() => ({ createError: null as unknown }));
vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => {
  const original = await importOriginal<typeof AppointmentsApiModule>();
  return {
    ...original,
    createAppointment: async (
      input: Parameters<typeof original.createAppointment>[0],
    ) => {
      if (api.createError) throw api.createError;
      return original.createAppointment(input);
    },
  };
});

import { type AppointmentDraft, emptyDraft } from './appointment-form-model.ts';
import { saveProblem, useAppointmentSave } from './use-appointment-save.ts';

const TODAY = '2026-10-03';
const NOW = new Date(clinicInstant(TODAY, '10:00'));

const draft = (patch: Partial<AppointmentDraft> = {}): AppointmentDraft => ({
  ...emptyDraft('2026-10-05'),
  who: {
    kind: 'lead',
    name: 'Priya Shah',
    phone: '+919876543210',
    patientId: null,
    leadId: 'lead-1',
    seq: 2401,
  },
  doctorId: 'dr-1',
  time: '11:00',
  ...patch,
});

describe('saveProblem — the checks before the request (appointments.md:249)', () => {
  it('asks for who, a new contact’s mobile, the slot and the doctor, in that order', () => {
    expect(saveProblem('create', draft({ who: null }), null, NOW)).toBe('who');
    const fresh = draft({
      who: { ...draft().who!, kind: 'new', leadId: null, phone: null, seq: null },
    });
    expect(saveProblem('create', fresh, null, NOW)).toBe('mobile');
    expect(
      saveProblem('create', { ...fresh, newPhone: '9811122233' }, null, NOW),
    ).toBeNull();
    expect(saveProblem('create', draft({ time: null }), null, NOW)).toBe('slot');
    expect(saveProblem('create', draft({ doctorId: null }), null, NOW)).toBe('doctor');
    expect(saveProblem('create', draft(), null, NOW)).toBeNull();
  });

  it('refuses a passed slot for a new or moved booking, never the saved one', () => {
    const past = draft({ date: TODAY, time: '09:00' });
    expect(saveProblem('create', past, null, NOW)).toBe('passed');
    const saved = { date: TODAY, time: '09:00', status: 'checked_in' as const };
    expect(saveProblem('edit', past, saved, NOW)).toBeNull();
    expect(saveProblem('edit', { ...past, time: '09:30' }, saved, NOW)).toBe('passed');
    expect(saveProblem('reschedule', past, saved, NOW)).toBe('passed');
  });
});

describe('useAppointmentSave — the write and its refusals', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const render = () => {
    const onProblem = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () =>
        useAppointmentSave({
          mode: 'create',
          row: null,
          branchId: null,
          leads: [],
          onProblem,
          onDone,
        }),
      { wrapper },
    );
    return { ...view, onProblem, onDone };
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.createError = null;
    for (const fn of Object.values(notifyMock)) fn.mockReset();
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
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.saveState).toBe('idle');
  });

  it('answers a slot someone took with "Just taken · pick another slot"', async () => {
    api.createError = clinicHttpError(
      409,
      'slot_taken',
      'Just taken · pick another slot',
    );
    const { result, onDone } = render();
    await act(() => result.current.save(draft()));
    expect(notifyMock.error).toHaveBeenCalledWith('Just taken · pick another slot');
    expect(onDone).not.toHaveBeenCalled();
    expect(result.current.saveState).toBe('idle');
  });

  it('toasts any other refusal and keeps the draft', async () => {
    api.createError = clinicHttpError(
      422,
      'validation',
      'Pick a time inside clinic hours',
    );
    const { result } = render();
    await act(() => result.current.save(draft()));
    expect(notifyMock.error).toHaveBeenCalledOnce();
    expect(result.current.saveState).toBe('idle');
  });

  it('keeps the draft after a failed connection: "Retry save" and a toast that saves again', async () => {
    api.createError = new HttpError('down', 503, '/appointments', 'POST');
    const { result, onDone } = render();
    await act(() => result.current.save(draft()));
    expect(result.current.saveState).toBe('failed');
    const [, options] = notifyMock.error.mock.lastCall ?? [];
    expect(options).toMatchObject({ id: 'appointment-save-failed' });
    // "Retry" sends the same draft again — this time the server answers.
    api.createError = clinicHttpError(
      422,
      'validation',
      'Pick a time inside clinic hours',
    );
    await act(async () => {
      options.action.onClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(notifyMock.error).toHaveBeenCalledTimes(2));
    expect(result.current.saveState).toBe('idle');
    expect(onDone).not.toHaveBeenCalled();
  });
});
