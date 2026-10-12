import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { DOCTOR_NISHA } from '@/tests/utils/appointment-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

const { notifyMock, rxApi } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  rxApi: {
    createPrescription: vi.fn(),
    updatePrescription: vi.fn(),
    approvePrescription: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/prescriptions-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...rxApi,
}));

import {
  prescriptionRecord,
  TEST_PRESCRIPTION_ID,
} from '../../__tests__/integration/prescription-doubles.ts';
import { emptyRxLine, newRxForm, rxFormOf, type RxFormValues } from './rx-form.ts';
import { useRxSave } from './use-rx-save.ts';

const APPOINTMENT_ID = 'appt_visit000000000000000';

const validation = (...errors: { field: string; message: string }[]) =>
  new HttpError('HTTP 400', 400, '/api/v1/app/patients/x/prescriptions', 'POST', {
    error: { type: 'validation_error', errors },
  });

/** A new Rx: a blank first row, then Glycolac on the second, and advice with spaces. */
const newRx = (patch: Partial<RxFormValues> = {}): RxFormValues => ({
  ...newRxForm('2026-10-12', DOCTOR_NISHA.id),
  items: [
    emptyRxLine(),
    { ...emptyRxLine(), medicineName: 'Glycolac Cream', dose: '1-0-1', qty: 2 },
  ],
  advice: '  Avoid sun ',
  ...patch,
});

describe('useRxSave — the Prescription drawer’s write', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    prescription = null,
    values,
    approves = false,
    appointmentId,
  }: {
    prescription?: PrescriptionRecord | null;
    values: RxFormValues;
    approves?: boolean;
    appointmentId?: string | null;
  }) {
    const onStep = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<RxFormValues>({ defaultValues: values });
        return {
          form,
          drawer: useRxSave({
            form,
            prescription,
            patientId: TEST_PATIENT_ID,
            appointmentId,
            approves,
            onStep,
            onDone,
          }),
        };
      },
      { wrapper },
    );
    return { ...view, onStep, onDone };
  }

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const fn of [...Object.values(notifyMock), ...Object.values(rxApi)])
      fn.mockReset();
  });
  afterEach(() => client.clear());

  it('asks for a medicine when no row names one, and opens Medicines', async () => {
    const { result, onStep } = render({
      values: newRx({
        items: [emptyRxLine(), { ...emptyRxLine(), medicineName: '   ' }],
      }),
    });

    await act(() => result.current.drawer.save());

    expect(onStep).toHaveBeenCalledWith('medicines');
    expect(notifyMock.warning).toHaveBeenCalledWith('Add a medicine');
    expect(rxApi.createPrescription).not.toHaveBeenCalled();
  });

  it('writes a draft with only the named rows, blank notes as none — at the visit’s booking', async () => {
    const written = prescriptionRecord({ id: 'rx_new00000000000000000000' });
    rxApi.createPrescription.mockResolvedValue(written);
    const { result, onDone } = render({ values: newRx(), appointmentId: APPOINTMENT_ID });

    await act(() => result.current.drawer.save());

    expect(rxApi.createPrescription).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      fields: expect.objectContaining({
        doctorId: DOCTOR_NISHA.id,
        date: '2026-10-12',
        advice: 'Avoid sun',
        labReport: null,
        procedureToday: null,
        items: [expect.objectContaining({ medicineName: 'Glycolac Cream', qty: 2 })],
      }),
      appointmentId: APPOINTMENT_ID,
      idempotencyKey: expect.any(String),
    });
    expect(rxApi.approvePrescription).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(written, false);
  });

  it('approves what it wrote for an approver — under the write’s own key, suffixed', async () => {
    const written = prescriptionRecord();
    const approved = { ...written, status: 'approved' as const };
    rxApi.createPrescription.mockResolvedValue(written);
    rxApi.approvePrescription.mockResolvedValue(approved);
    const { result, onDone } = render({ values: newRx(), approves: true });

    await act(() => result.current.drawer.save());

    const [create] = rxApi.createPrescription.mock.lastCall as [
      { idempotencyKey: string },
    ];
    expect(rxApi.approvePrescription).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      prescriptionId: TEST_PRESCRIPTION_ID,
      idempotencyKey: `${create.idempotencyKey}:approve`,
    });
    expect(onDone).toHaveBeenCalledWith(approved, false);
  });

  it('keeps the draft when the approval is refused after the write', async () => {
    rxApi.createPrescription.mockResolvedValue(prescriptionRecord());
    rxApi.approvePrescription.mockRejectedValue(
      new HttpError('HTTP 403', 403, '/approve', 'POST', {
        error: { type: 'forbidden', detail: 'Only a doctor approves a prescription' },
      }),
    );
    const { result, onDone } = render({ values: newRx(), approves: true });

    await act(() => result.current.drawer.save());

    expect(onDone).not.toHaveBeenCalled();
    expect(notifyMock.error).toHaveBeenCalledWith(
      'Only a doctor approves a prescription',
    );
    expect(result.current.drawer.saveState).toBe('idle');
  });

  it('saves a draft’s edit with its updated_at', async () => {
    const prescription = prescriptionRecord();
    rxApi.updatePrescription.mockResolvedValue(prescription);
    const { result, onDone } = render({
      prescription,
      values: { ...rxFormOf(prescription), advice: 'Sunscreen' },
    });

    await act(() => result.current.drawer.save());

    expect(rxApi.updatePrescription).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      prescriptionId: TEST_PRESCRIPTION_ID,
      fields: expect.objectContaining({ advice: 'Sunscreen' }),
      expectedUpdatedAt: '2026-10-01T05:00:00.000Z',
      idempotencyKey: expect.any(String),
    });
    expect(rxApi.createPrescription).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(prescription, false);
  });

  it('puts a refused line on the row it came from — blank rows are not sent', async () => {
    rxApi.createPrescription.mockRejectedValue(
      validation({ field: 'body.items/0/dose_morning', message: 'Pick a dose' }),
    );
    const { result, onStep } = render({ values: newRx() });

    await act(() => result.current.drawer.save());

    // The first line sent is the form's second row.
    expect(result.current.form.getFieldState('items.1.dose').error?.message).toBe(
      'Pick a dose',
    );
    expect(result.current.form.getFieldState('items.0.dose').error).toBeUndefined();
    expect(onStep).toHaveBeenCalledWith('medicines');
    expect(notifyMock.error).toHaveBeenCalledWith('Pick a dose');
  });

  it('lands a line’s timing, place and quantity on their controls', async () => {
    rxApi.createPrescription.mockRejectedValue(
      validation(
        { field: 'body.items/0/timing_text', message: 'Too long' },
        { field: 'body.items/0/body_part', message: 'Unknown place' },
        { field: 'body.items/0/quantity', message: 'At least 1' },
      ),
    );
    const { result } = render({ values: newRx() });

    await act(() => result.current.drawer.save());

    expect(result.current.form.getFieldState('items.1.when').error?.message).toBe(
      'Too long',
    );
    expect(result.current.form.getFieldState('items.1.where').error?.message).toBe(
      'Unknown place',
    );
    expect(result.current.form.getFieldState('items.1.qty').error?.message).toBe(
      'At least 1',
    );
  });

  it('opens the step of the first refused field: the doctor before the notes', async () => {
    rxApi.createPrescription.mockRejectedValue(
      validation(
        { field: 'body.lab_report', message: 'Too long' },
        { field: 'body.doctor_membership_id', message: 'Not a doctor' },
      ),
    );
    const { result, onStep } = render({ values: newRx() });

    await act(() => result.current.drawer.save());

    expect(result.current.form.getFieldState('doctorId').error?.message).toBe(
      'Not a doctor',
    );
    expect(result.current.form.getFieldState('labReport').error?.message).toBe(
      'Too long',
    );
    expect(onStep).toHaveBeenCalledOnce();
    expect(onStep).toHaveBeenCalledWith('prescription');
  });

  it('opens Notes for a refused note alone', async () => {
    rxApi.createPrescription.mockRejectedValue(
      validation({ field: 'body.procedure_today', message: 'Too long' }),
    );
    const { result, onStep } = render({ values: newRx() });

    await act(() => result.current.drawer.save());

    expect(onStep).toHaveBeenCalledWith('notes');
  });
});
