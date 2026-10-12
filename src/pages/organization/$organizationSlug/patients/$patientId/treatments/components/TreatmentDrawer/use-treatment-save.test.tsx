import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientPackageQueryKeys } from '@/shared/api/app/patient-packages-api.ts';
import { treatmentQueryKeys } from '@/shared/api/app/treatments-api.ts';
import type { TreatmentRecord } from '@/shared/api/app/treatments-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

const { notifyMock, treatmentsApi } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  treatmentsApi: { createTreatment: vi.fn(), updateTreatment: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/treatments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...treatmentsApi,
}));

import {
  TEST_PACKAGE_ID,
  treatmentRecord,
} from '../../__tests__/integration/treatment-doubles.ts';
import {
  newTreatmentForm,
  treatmentFormOf,
  type TreatmentFormValues,
} from './treatment-form.ts';
import { useTreatmentSave } from './use-treatment-save.ts';

const NISHA_ID = 'mem_nisha0000000000000000';
const APPOINTMENT_ID = 'appt_visit000000000000000';

const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError(`HTTP ${status}`, status, '/api/v1/app/patients/x/treatments', 'POST', {
    error,
  });

const validation = (field: string, message: string) =>
  refusal(400, { type: 'validation_error', errors: [{ field, message }] });

const blankSkin = (patch: Partial<TreatmentFormValues> = {}): TreatmentFormValues => ({
  ...newTreatmentForm('skin', { doctorId: NISHA_ID, therapistId: null }),
  ...patch,
});

describe('useTreatmentSave — the Treatment drawer’s write', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    treatment = null,
    values,
    visit,
  }: {
    treatment?: TreatmentRecord | null;
    values: TreatmentFormValues;
    visit?: { appointmentId: string; onWritten: () => void };
  }) {
    const onStep = vi.fn();
    const onStale = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<TreatmentFormValues>({ defaultValues: values });
        return {
          form,
          drawer: useTreatmentSave({
            form,
            treatment,
            patientId: TEST_PATIENT_ID,
            visit,
            onStep,
            onStale,
            onDone,
          }),
        };
      },
      { wrapper },
    );
    return { ...view, onStep, onStale, onDone };
  }

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const fn of [...Object.values(notifyMock), ...Object.values(treatmentsApi)]) {
      fn.mockReset();
    }
  });
  afterEach(() => client.clear());

  it('saves a blank name as "Treatment" — nothing is required in the UI', async () => {
    treatmentsApi.createTreatment.mockResolvedValue(
      treatmentRecord({ name: 'Treatment' }),
    );
    const { result, onDone } = render({ values: blankSkin({ name: '   ' }) });

    await act(() => result.current.drawer.save());

    expect(treatmentsApi.createTreatment).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      input: expect.objectContaining({
        name: 'Treatment',
        template: 'skin',
        doctorId: NISHA_ID,
        packageId: null,
        appointmentId: null,
        remark: null,
      }),
      idempotencyKey: expect.any(String),
    });
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ name: 'Treatment' }));
  });

  it('spends a package’s session and writes at the open visit, then moves the visit on', async () => {
    const written = treatmentRecord({ packageId: TEST_PACKAGE_ID });
    treatmentsApi.createTreatment.mockResolvedValue(written);
    const onWritten = vi.fn();
    const { result, onDone } = render({
      values: blankSkin({ name: 'LHR Full Face', packageId: TEST_PACKAGE_ID }),
      visit: { appointmentId: APPOINTMENT_ID, onWritten },
    });

    await act(() => result.current.drawer.save());

    expect(treatmentsApi.createTreatment).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          packageId: TEST_PACKAGE_ID,
          appointmentId: APPOINTMENT_ID,
        }),
      }),
    );
    expect(onDone).toHaveBeenCalledWith(written);
    expect(onWritten).toHaveBeenCalledOnce();
    expect(onDone.mock.invocationCallOrder[0]).toBeLessThan(
      onWritten.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('saves an edit with no visit hand-off, even inside the visit flow', async () => {
    const treatment = treatmentRecord();
    treatmentsApi.updateTreatment.mockResolvedValue({
      ...treatment,
      remark: 'Mild redness',
    });
    const onWritten = vi.fn();
    const { result, onDone } = render({
      treatment,
      values: { ...treatmentFormOf(treatment), remark: ' Mild redness ' },
      visit: { appointmentId: APPOINTMENT_ID, onWritten },
    });

    await act(() => result.current.drawer.save());

    expect(treatmentsApi.updateTreatment).toHaveBeenCalledWith({
      treatment,
      fields: expect.objectContaining({ remark: 'Mild redness' }),
      idempotencyKey: expect.any(String),
    });
    expect(treatmentsApi.createTreatment).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
    expect(onWritten).not.toHaveBeenCalled();
  });

  it('says why a package session is refused and reads the packages and sessions again', async () => {
    treatmentsApi.createTreatment.mockRejectedValue(
      refusal(409, {
        reason: 'offering_used_up',
        detail: 'No session left on this package',
      }),
    );
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result, onDone } = render({
      values: blankSkin({ packageId: TEST_PACKAGE_ID }),
    });

    await act(() => result.current.drawer.save());

    expect(notifyMock.error).toHaveBeenCalledWith(expect.any(String), {
      id: 'treatment-save-failed',
    });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(patientPackageQueryKeys.all);
    expect(keys).toContainEqual(treatmentQueryKeys.all);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('offers Reload for a stale save — not the package refusal', async () => {
    const treatment = treatmentRecord();
    treatmentsApi.updateTreatment.mockRejectedValue(
      refusal(409, { reason: 'record_changed', detail: 'Changed by usr_x' }),
    );
    const { result, onStale } = render({
      treatment,
      values: { ...treatmentFormOf(treatment), remark: 'x' },
    });

    await act(() => result.current.drawer.save());

    const [, options] = notifyMock.error.mock.lastCall as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();
    expect(onStale).toHaveBeenCalledOnce();
  });

  it('puts the API’s names on the form’s fields and opens their step', async () => {
    const cases: [string, keyof TreatmentFormValues, string][] = [
      ['body.body_parts', 'areas', 'details'],
      ['body.therapist_membership_id', 'therapistId', 'session'],
      ['body.patient_offering_id', 'packageId', 'session'],
      ['body.remark', 'remark', 'aftercare'],
    ];
    for (const [field, formField, step] of cases) {
      treatmentsApi.createTreatment.mockRejectedValueOnce(validation(field, 'Refused'));
      const { result, onStep } = render({ values: blankSkin() });
      await act(() => result.current.drawer.save());
      expect(result.current.form.getFieldState(formField).error?.message).toBe('Refused');
      expect(onStep).toHaveBeenCalledWith(step);
    }
  });

  it('opens Details for a refused template parameter', async () => {
    treatmentsApi.createTreatment.mockRejectedValue(
      validation('body.parameters.fluence', 'Out of range'),
    );
    const { result, onStep } = render({ values: blankSkin() });

    await act(() => result.current.drawer.save());

    expect(result.current.form.getFieldState('parameters.fluence').error?.message).toBe(
      'Out of range',
    );
    expect(onStep).toHaveBeenCalledWith('details');
  });
});
