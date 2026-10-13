import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  PatientPersonInput,
  PatientRecord,
} from '@/shared/api/app/patients-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { patientRecord, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

const { notifyMock, patientsApi, imagesApi, uploads } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  patientsApi: { createPatient: vi.fn(), updatePatient: vi.fn() },
  imagesApi: { attachPatientImage: vi.fn() },
  uploads: { enqueue: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/patients-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...patientsApi,
}));
vi.mock('@/shared/api/app/patient-images-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...imagesApi,
}));
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => uploads,
}));

import {
  emptyPatientForm,
  patientFormOf,
  type PatientFormValues,
  patientInputOf,
} from './patient-form.ts';
import { usePatientSave } from './use-patient-save.ts';

const BRANCH_ID = 'brn_main0000000000000000';

const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError(`HTTP ${status}`, status, '/api/v1/app/patients', 'POST', { error });

const validation = (field: string, message: string) =>
  refusal(400, { type: 'validation_error', errors: [{ field, message }] });

/** Priya, a new patient typed in the drawer. */
const priya = (patch: Partial<PatientFormValues> = {}): PatientFormValues => ({
  ...emptyPatientForm({ name: 'Priya Shah', phone: '9876543210' }),
  ...patch,
});

describe('usePatientSave — the patient drawer’s write', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    patient = null,
    values,
    person = 'new',
    photos = [],
    onStale,
  }: {
    patient?: PatientRecord | null;
    values: PatientFormValues;
    person?: PatientPersonInput;
    photos?: File[];
    onStale?: () => void;
  }) {
    const onStep = vi.fn();
    const onConflict = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form: UseFormReturn<PatientFormValues> = useForm<PatientFormValues>({
          defaultValues: values,
        });
        return {
          form,
          drawer: usePatientSave({
            form,
            patient,
            input: () => patientInputOf(form.getValues(), { defaultBranchId: BRANCH_ID }),
            person: () => person,
            photos,
            onStep,
            onConflict,
            onStale,
            onDone,
          }),
        };
      },
      { wrapper },
    );
    return { ...view, onStep, onConflict, onDone };
  }

  beforeEach(() => {
    signInTestMember();
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    for (const fn of [
      ...Object.values(notifyMock),
      ...Object.values(patientsApi),
      ...Object.values(imagesApi),
      uploads.enqueue,
    ]) {
      fn.mockReset();
    }
  });
  afterEach(() => client.clear());

  describe('the mobile check', () => {
    it('stops a filled mobile that is not ten digits on step 1', async () => {
      const { result, onStep } = render({ values: priya({ phone: '98765' }) });
      await act(() => result.current.drawer.save());
      expect(result.current.form.getFieldState('phone').error?.message).toBe(
        'Enter a 10-digit mobile',
      );
      expect(onStep).toHaveBeenCalledWith('contact');
      expect(notifyMock.warning).toHaveBeenCalledWith('Enter a 10-digit mobile');
      expect(patientsApi.createPatient).not.toHaveBeenCalled();
    });

    it('checks the second mobile too — an empty one is fine', async () => {
      const { result } = render({ values: priya({ phone2: '12' }) });
      await act(() => result.current.drawer.save());
      expect(result.current.form.getFieldState('phone').error).toBeUndefined();
      expect(result.current.form.getFieldState('phone2').error?.message).toBe(
        'Enter a 10-digit mobile',
      );
      expect(patientsApi.createPatient).not.toHaveBeenCalled();
    });
  });

  describe('the write', () => {
    it('creates the patient for a new person — the mobile in E.164, a blank last name none, the default branch', async () => {
      const created = patientRecord();
      patientsApi.createPatient.mockResolvedValue(created);
      const { result, onDone } = render({ values: priya({ lastName: '  ' }) });

      await act(() => result.current.drawer.save());

      expect(patientsApi.createPatient).toHaveBeenCalledWith({
        fields: expect.objectContaining({
          firstName: 'Priya',
          // A blank last name is none.
          lastName: null,
          phone: '+919876543210',
          phone2: null,
          homeBranchId: BRANCH_ID,
          followUpAt: null,
        }),
        person: 'new',
        idempotencyKey: expect.any(String),
      });
      expect(uploads.enqueue).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith(
        { kind: 'created', patient: created, filed: 0 },
        false,
      );
    });

    it('sends a follow-up day with no time as 11:00 clinic time', async () => {
      patientsApi.createPatient.mockResolvedValue(patientRecord());
      const { result } = render({ values: priya({ followUpDate: '2026-10-20' }) });

      await act(() => result.current.drawer.save());

      const [vars] = patientsApi.createPatient.mock.lastCall as [
        { fields: { followUpAt: string | null } },
      ];
      expect(vars.fields.followUpAt).toBe('2026-10-20T05:30:00.000Z');
    });

    it('files the picked photos on the new patient through the upload tray', async () => {
      const created = patientRecord();
      patientsApi.createPatient.mockResolvedValue(created);
      uploads.enqueue.mockReturnValue({ accepted: 2, skipped: 1 });
      const photos = [
        new File(['a'], 'before.jpg', { type: 'image/jpeg' }),
        new File(['b'], 'after.jpg', { type: 'image/jpeg' }),
        new File(['c'], 'huge.jpg', { type: 'image/jpeg' }),
      ];
      const { result, onDone } = render({
        values: priya(),
        person: { contactId: 'con_priya0000000000000000' },
        photos,
      });

      await act(() => result.current.drawer.save());

      expect(patientsApi.createPatient).toHaveBeenCalledWith(
        expect.objectContaining({ person: { contactId: 'con_priya0000000000000000' } }),
      );
      expect(uploads.enqueue).toHaveBeenCalledWith(photos, {
        onUploaded: expect.any(Function),
      });
      expect(onDone).toHaveBeenCalledWith(
        { kind: 'created', patient: created, filed: 2 },
        false,
      );

      // The tray confirms each upload after the drawer is gone: it files on the patient.
      const [, target] = uploads.enqueue.mock.lastCall as [
        File[],
        { onUploaded: (key: string, file: File) => Promise<void> },
      ];
      await target.onUploaded('org/patients/before.jpg', photos[0] as File);
      expect(imagesApi.attachPatientImage).toHaveBeenCalledWith({
        patientId: TEST_PATIENT_ID,
        fileKey: 'org/patients/before.jpg',
        fileName: 'before.jpg',
      });
    });

    it('saves an edit against the patient as read, and never re-files photos', async () => {
      const patient = patientRecord();
      const saved = { ...patient, notes: 'Prefers mornings' };
      patientsApi.updatePatient.mockResolvedValue(saved);
      const { result, onDone } = render({
        patient,
        values: { ...patientFormOf(patient), notes: ' Prefers mornings ' },
        photos: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })],
      });

      await act(() => result.current.drawer.save());

      expect(patientsApi.updatePatient).toHaveBeenCalledWith({
        record: patient,
        fields: expect.objectContaining({ notes: 'Prefers mornings' }),
        idempotencyKey: expect.any(String),
      });
      expect(patientsApi.createPatient).not.toHaveBeenCalled();
      expect(uploads.enqueue).not.toHaveBeenCalled();
      expect(onDone).toHaveBeenCalledWith({ kind: 'saved', patient: saved }, false);
    });
  });

  describe('the server’s refusals', () => {
    it('shows the notice for a mobile that is someone else’s, on step 1, keeping the draft', async () => {
      patientsApi.createPatient.mockRejectedValue(
        refusal(409, {
          reason: 'contact_phone_exists',
          detail: 'This mobile belongs to another contact',
        }),
      );
      const { result, onStep, onConflict, onDone } = render({ values: priya() });

      await act(() => result.current.drawer.save());

      expect(onStep).toHaveBeenCalledWith('contact');
      expect(onConflict).toHaveBeenCalledOnce();
      expect(notifyMock.error).toHaveBeenCalledOnce();
      expect(onDone).not.toHaveBeenCalled();
      expect(result.current.drawer.saveState).toBe('idle');
      expect(result.current.form.getValues('firstName')).toBe('Priya');
    });

    it('puts the person’s fields on theirs — nested under contact on a create', async () => {
      patientsApi.createPatient.mockRejectedValue(
        validation('body.contact.first_name', 'Too long'),
      );
      const { result, onStep } = render({ values: priya() });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('firstName').error?.message).toBe(
        'Too long',
      );
      expect(onStep).toHaveBeenCalledWith('contact');
      expect(notifyMock.error).toHaveBeenCalledWith('Too long');
    });

    it('puts a refused second number on Mobile 2', async () => {
      patientsApi.createPatient.mockRejectedValue(
        validation('body.contact.phones/1/phone', 'Not a mobile'),
      );
      const { result } = render({ values: priya({ phone2: '9876500000' }) });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('phone2').error?.message).toBe(
        'Not a mobile',
      );
      expect(result.current.form.getFieldState('phone').error).toBeUndefined();
    });

    it('puts a refused follow-up on its day and opens the clinic step', async () => {
      patientsApi.createPatient.mockRejectedValue(
        validation('body.follow_up_at', 'Must be in the future'),
      );
      const { result, onStep } = render({
        values: priya({ followUpDate: '2026-01-01' }),
      });

      await act(() => result.current.drawer.save());

      expect(result.current.form.getFieldState('followUpDate').error?.message).toBe(
        'Must be in the future',
      );
      expect(onStep).toHaveBeenCalledWith('clinic');
    });

    it('opens the first field in the drawer’s order when the server names several', async () => {
      patientsApi.createPatient.mockRejectedValue(
        refusal(400, {
          type: 'validation_error',
          errors: [
            { field: 'body.notes', message: 'Too long' },
            { field: 'body.contact.address', message: 'Too long' },
          ],
        }),
      );
      const { result, onStep } = render({ values: priya() });

      await act(() => result.current.drawer.save());

      expect(onStep).toHaveBeenCalledOnce();
      expect(onStep).toHaveBeenCalledWith('contact');
      expect(result.current.form.getFieldState('notes').error?.message).toBe('Too long');
    });

    it('offers Reload for a stale edit', async () => {
      const patient = patientRecord();
      const onStale = vi.fn();
      patientsApi.updatePatient.mockRejectedValue(
        refusal(409, { reason: 'record_changed', detail: 'Changed by usr_x' }),
      );
      const { result, onConflict } = render({
        patient,
        values: { ...patientFormOf(patient), notes: 'x' },
        onStale,
      });

      await act(() => result.current.drawer.save());

      expect(onConflict).not.toHaveBeenCalled();
      const [, options] = notifyMock.error.mock.lastCall as [
        string,
        { id: string; action: { onClick: () => void } },
      ];
      expect(options.id).toBe('patient-save-failed');
      options.action.onClick();
      expect(onStale).toHaveBeenCalledOnce();
    });
  });
});
