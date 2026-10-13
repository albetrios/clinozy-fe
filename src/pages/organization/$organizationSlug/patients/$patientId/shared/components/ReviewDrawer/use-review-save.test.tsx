import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { feedbackQueryKeys } from '@/shared/api/app/feedback-api.ts';
import type { PatientReview } from '@/shared/api/app/feedback-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

const { notifyMock, feedbackApi, uploads } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  feedbackApi: {
    createReview: vi.fn(),
    updateReview: vi.fn(),
    attachReviewFile: vi.fn(),
  },
  uploads: { enqueue: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/api/app/feedback-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...feedbackApi,
}));
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => uploads,
}));

import { newReviewForm, reviewFormOf, type ReviewFormValues } from './review-form.ts';
import { useReviewSave } from './use-review-save.ts';

const APPOINTMENT_ID = 'appt_visit000000000000000';
const PLACE = {
  patientId: TEST_PATIENT_ID,
  appointmentId: APPOINTMENT_ID,
  date: '2026-10-12',
};

const review = (patch: Partial<PatientReview> = {}): PatientReview => ({
  id: 'prev_kavya000000000000000',
  patientId: TEST_PATIENT_ID,
  appointmentId: null,
  source: 'google',
  rating: 5,
  text: 'Lovely staff',
  link: null,
  fileKeys: [],
  date: '2026-10-08',
  needsAction: false,
  actions: [],
  createdAt: '2026-10-08T05:00:00.000Z',
  updatedAt: '2026-10-08T05:00:00.000Z',
  ...patch,
});

const validation = (field: string, message: string) =>
  new HttpError('HTTP 400', 400, '/api/v1/app/patients/x/reviews', 'POST', {
    error: { type: 'validation_error', errors: [{ field, message }] },
  });

describe('useReviewSave — Log a review’s write', () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  function render({
    saved = null,
    values,
  }: {
    saved?: PatientReview | null;
    values: ReviewFormValues;
  }) {
    const onStep = vi.fn();
    const onDone = vi.fn();
    const view = renderHook(
      () => {
        const form = useForm<ReviewFormValues>({ defaultValues: values });
        return {
          form,
          drawer: useReviewSave({ form, review: saved, place: PLACE, onStep, onDone }),
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
    for (const fn of [
      ...Object.values(notifyMock),
      ...Object.values(feedbackApi),
      uploads.enqueue,
    ]) {
      fn.mockReset();
    }
  });
  afterEach(() => client.clear());

  it('refuses a link that is not https on the Details step — an empty one is fine', async () => {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- asserting http:// is refused
    const http = render({ values: { ...newReviewForm(), link: 'http://g.page/r/x' } });
    await act(() => http.result.current.drawer.save());
    expect(http.result.current.form.getFieldState('link').error?.message).toBe(
      'Add an https:// link',
    );
    expect(http.onStep).toHaveBeenCalledWith('details');
    expect(feedbackApi.createReview).not.toHaveBeenCalled();

    feedbackApi.createReview.mockResolvedValue(review());
    const none = render({ values: { ...newReviewForm(), link: '   ' } });
    await act(() => none.result.current.drawer.save());
    expect(feedbackApi.createReview).toHaveBeenCalledOnce();
  });

  it('writes a new review at its visit and day, blanks as none', async () => {
    const written = review();
    feedbackApi.createReview.mockResolvedValue(written);
    const { result, onDone } = render({
      values: { ...newReviewForm('video'), rating: 2, text: '  ' },
    });

    await act(() => result.current.drawer.save());

    expect(feedbackApi.createReview).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      input: {
        source: 'video',
        rating: 2,
        link: null,
        text: null,
        appointmentId: APPOINTMENT_ID,
        date: '2026-10-12',
      },
      idempotencyKey: expect.any(String),
    });
    expect(uploads.enqueue).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(written);
  });

  it('files each picked file on the saved review through the upload tray', async () => {
    const written = review();
    feedbackApi.createReview.mockResolvedValue(written);
    feedbackApi.attachReviewFile.mockResolvedValue(written);
    const clip = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = render({
      values: { ...newReviewForm(), files: [{ id: 'clip', file: clip }] },
    });

    await act(() => result.current.drawer.save());

    expect(uploads.enqueue).toHaveBeenCalledWith([clip], {
      onUploaded: expect.any(Function),
    });
    const [, target] = uploads.enqueue.mock.lastCall as [
      File[],
      { onUploaded: (key: string) => Promise<void> },
    ];
    invalidate.mockClear();
    await target.onUploaded('org/reviews/clip.mp4');
    expect(feedbackApi.attachReviewFile).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      reviewId: written.id,
      fileKey: 'org/reviews/clip.mp4',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: feedbackQueryKeys.all });
  });

  it('saves an edit with the review’s updated_at', async () => {
    const saved = review({ rating: 3 });
    feedbackApi.updateReview.mockResolvedValue({ ...saved, rating: 4 });
    const { result } = render({ saved, values: { ...reviewFormOf(saved), rating: 4 } });

    await act(() => result.current.drawer.save());

    expect(feedbackApi.updateReview).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      reviewId: saved.id,
      fields: expect.objectContaining({ rating: 4 }),
      expectedUpdatedAt: '2026-10-08T05:00:00.000Z',
      idempotencyKey: expect.any(String),
    });
    expect(feedbackApi.createReview).not.toHaveBeenCalled();
  });

  it('puts refused files on the files field and opens Notes', async () => {
    feedbackApi.createReview.mockRejectedValue(
      validation('body.file_keys', 'At most 5 files'),
    );
    const { result, onStep } = render({ values: newReviewForm() });

    await act(() => result.current.drawer.save());

    expect(result.current.form.getFieldState('files').error?.message).toBe(
      'At most 5 files',
    );
    expect(onStep).toHaveBeenCalledWith('notes');
  });

  it('puts a refused rating on Rating and opens the first step', async () => {
    feedbackApi.createReview.mockRejectedValue(
      validation('body.rating', 'Between 1 and 5'),
    );
    const { result, onStep } = render({ values: newReviewForm() });

    await act(() => result.current.drawer.save());

    expect(result.current.form.getFieldState('rating').error?.message).toBe(
      'Between 1 and 5',
    );
    expect(onStep).toHaveBeenCalledWith('review');
  });
});
