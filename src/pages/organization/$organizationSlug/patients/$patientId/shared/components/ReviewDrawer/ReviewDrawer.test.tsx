import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as FeedbackApiModule from '@/shared/api/app/feedback-api.ts';
import {
  attachReviewFile,
  createReview,
  updateReview,
} from '@/shared/api/app/feedback-api.ts';
import type { PatientReview } from '@/shared/api/app/feedback-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  renderInPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';
import { ReviewDrawer, type ReviewDrawerProps } from './ReviewDrawer.tsx';

const { notifyMock, enqueueMock } = vi.hoisted(() => ({
  notifyMock: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  enqueueMock: vi.fn(() => ({ accepted: 1, skipped: 0 })),
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => ({ enqueue: enqueueMock }),
}));
vi.mock('@/shared/api/app/feedback-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof FeedbackApiModule>()),
  createReview: vi.fn(),
  updateReview: vi.fn(),
  attachReviewFile: vi.fn(async () => undefined),
}));

const D = 'review-drawer';
const TODAY = '2026-10-10';

/** A review as the file reads it — five stars on Google, no files. */
function review(overrides: Partial<PatientReview> = {}): PatientReview {
  return {
    id: 'rev_saved0000000000000000',
    patientId: TEST_PATIENT_ID,
    appointmentId: null,
    source: 'google',
    rating: 5,
    text: 'Lovely staff',
    link: null,
    fileKeys: [],
    date: '2026-09-24',
    needsAction: false,
    actions: [],
    createdAt: '2026-09-24T05:00:00.000Z',
    updatedAt: '2026-09-24T05:00:00.000Z',
    ...overrides,
  };
}

async function open(props: Partial<ReviewDrawerProps> = {}) {
  const onClose = vi.fn();
  const user = userEvent.setup({ applyAccept: false });
  const view = renderInPatientFile(
    <ReviewDrawer
      patientId={TEST_PATIENT_ID}
      patientName="Priya Shah"
      review={null}
      source={null}
      appointmentId={null}
      today={TODAY}
      onClose={onClose}
      {...props}
    />,
    { file: patientFile(), section: 'overview' },
  );
  const drawer = await screen.findByTestId(D);
  return { ...view, user, drawer, onClose };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  enqueueMock.mockClear();
});
afterEach(() => {
  resetPatientFile();
  vi.resetAllMocks();
});

describe('Log a review (KICKOFF §6.6; S:46–47)', () => {
  it('opens on Google and five stars', async () => {
    const { drawer, baseElement } = await open();
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Log a review');
    expect(drawer).toHaveTextContent(
      `${fsi('Priya Shah')} · kept on the patient file so anyone can find it later`,
    );
    expect(within(drawer).getByTestId(`${D}-where-google`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(drawer).getByTestId(`${D}-rating-5`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(drawer).getByTestId(`${D}-where-internal_form`)).toHaveTextContent(
      'Feedback form',
    );
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('starts on the source the picker chose', async () => {
    const { drawer } = await open({ source: 'video' });
    expect(within(drawer).getByTestId(`${D}-where-video`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('asks for an https link', async () => {
    const { user, drawer } = await open();
    await user.click(within(drawer).getByTestId(`${D}-step-details-trigger`));
    await user.type(within(drawer).getByTestId(`${D}-link`), 'g.page/review');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add an https:// link');
    expect(within(drawer).getByTestId(`${D}-link`)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(createReview).not.toHaveBeenCalled();
  });

  it('saves a low Instagram review, then files its clip — the server’s call-back in the toast', async () => {
    vi.mocked(createReview).mockResolvedValue(
      review({ id: 'rev_new', source: 'instagram', rating: 2, needsAction: true }),
    );
    const { user, drawer, onClose } = await open({ appointmentId: 'appt_visit' });
    await user.click(within(drawer).getByTestId(`${D}-where-instagram`));
    await user.click(within(drawer).getByTestId(`${D}-rating-2`));
    await user.click(within(drawer).getByTestId(`${D}-step-details-trigger`));
    await user.type(
      within(drawer).getByTestId(`${D}-link`),
      'https://instagram.com/p/abc',
    );
    await user.click(within(drawer).getByTestId(`${D}-step-notes-trigger`));
    const clip = new File(['mp4'], 'clip.mp4', { type: 'video/mp4' });
    await user.upload(within(drawer).getByTestId(`${D}-files-input`), clip);
    await user.type(within(drawer).getByTestId(`${D}-text`), 'Waited an hour');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith(
        '2★ Instagram review saved for Priya Shah · call-back task created',
      ),
    );
    expect(createReview).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      input: {
        source: 'instagram',
        rating: 2,
        link: 'https://instagram.com/p/abc',
        text: 'Waited an hour',
        appointmentId: 'appt_visit',
        date: TODAY,
      },
      idempotencyKey: expect.any(String),
    });
    expect(onClose).toHaveBeenCalled();
    const [files, target] = enqueueMock.mock.calls[0] as unknown as [
      File[],
      { onUploaded: (key: string) => Promise<void> },
    ];
    expect(files).toEqual([clip]);
    await target.onUploaded('organization-files/org/clip.mp4');
    expect(attachReviewFile).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      reviewId: 'rev_new',
      fileKey: 'organization-files/org/clip.mp4',
    });
  });

  it('opens a saved one prefilled with how many files it has, and saves its changes', async () => {
    const saved = review({ fileKeys: ['organization-files/org/a.png'] });
    vi.mocked(updateReview).mockResolvedValue(saved);
    const { user, drawer } = await open({ review: saved, source: saved.source });
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Save changes');
    await user.click(within(drawer).getByTestId(`${D}-step-notes-trigger`));
    // B1: a file's name is not kept and none can be read back — the count only.
    expect(within(drawer).getByTestId(`${D}-attached`)).toBeInTheDocument();
    expect(within(drawer).getByTestId(`${D}-attached`)).not.toHaveTextContent('a.png');
    await user.click(within(drawer).getByTestId(`${D}-step-review-trigger`));
    await user.click(within(drawer).getByTestId(`${D}-rating-4`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Review updated'),
    );
    expect(updateReview).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      reviewId: saved.id,
      fields: { source: 'google', rating: 4, link: null, text: 'Lovely staff' },
      expectedUpdatedAt: saved.updatedAt,
      idempotencyKey: expect.any(String),
    });
  });

  it('puts the server’s field error on the field and opens its step', async () => {
    vi.mocked(createReview).mockRejectedValue(
      new HttpError('Bad request', 400, '/app/patients/x/reviews', 'POST', {
        error: {
          type: 'validation_error',
          errors: [{ field: 'body.link', message: 'Link must use HTTPS' }],
        },
      }),
    );
    const { user, drawer } = await open();
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith('Link must use HTTPS'),
    );
    expect(within(drawer).getByTestId(`${D}-step-details`)).toHaveAttribute(
      'data-status',
      'open',
    );
    expect(within(drawer).getByTestId(`${D}-link`)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
});
