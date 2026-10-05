import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { fsi } from '@/tests/utils/bidi-marks.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';

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

const DHARTI = patientRef('Dharti Galani');
const D = 'review-drawer';
const url = (rest: string) => patientFileUrl(DHARTI, rest);
const reviewsOf = () =>
  clinicFixtures.reviews.snapshot((row) => row.patientId === DHARTI);
const callBacks = () =>
  clinicFixtures.tasks.snapshot(
    (task) => task.patientId === DHARTI && task.kind === 'callback',
  );

async function open(path: string) {
  const user = userEvent.setup({ applyAccept: false });
  const view = renderPatientFile(url(path), { role: 'doctor' });
  const drawer = await screen.findByTestId(D);
  return { ...view, user, drawer };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  enqueueMock.mockClear();
  resetClinicFixtures();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('Log a review (KICKOFF §6.6; S:46–47)', () => {
  it('opens on Google and five stars, over Clinical notes', async () => {
    const { drawer, baseElement } = await open('/reviews/create');
    expect(within(drawer).getByTestId(`${D}-title`)).toHaveTextContent('Log a review');
    expect(drawer).toHaveTextContent(
      `${fsi('Dharti Galani')} · kept on the patient file so anyone can find it later`,
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
    expect(screen.getByTestId('patient-section-overview')).toBeInTheDocument();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('starts on the source the picker chose', async () => {
    const { drawer } = await open('/reviews/create?source=video');
    expect(within(drawer).getByTestId(`${D}-where-video`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('asks for an https link', async () => {
    const { user, drawer } = await open('/reviews/create');
    await user.click(within(drawer).getByTestId(`${D}-step-details-trigger`));
    await user.type(within(drawer).getByTestId(`${D}-link`), 'g.page/review');
    await user.click(within(drawer).getByTestId(`${D}-save`));
    expect(notifyMock.warning).toHaveBeenCalledWith('Add an https:// link');
    expect(within(drawer).getByTestId(`${D}-link`)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('saves a low Instagram review with its text and file — the call-back follows', async () => {
    const { user, drawer, router } = await open('/reviews/create');
    const before = callBacks().length;
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
        '2★ Instagram review saved for Dharti Galani · call-back task created',
      ),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(url('/overview')));
    const saved = reviewsOf().find((row) => row.text === 'Waited an hour');
    expect(saved).toMatchObject({
      source: 'instagram',
      rating: 2,
      link: 'https://instagram.com/p/abc',
    });
    expect(callBacks()).toHaveLength(before + 1);
    const [files, target] = enqueueMock.mock.calls[0] as unknown as [
      File[],
      { onUploaded: (key: string) => Promise<void> },
    ];
    expect(files).toEqual([clip]);
    await target.onUploaded('reviews/clip.mp4');
    expect(reviewsOf().find((row) => row.id === saved?.id)?.files).toEqual([
      'reviews/clip.mp4',
    ]);
  });

  it('opens a saved one prefilled and saves its changes — “Review updated”', async () => {
    const [saved] = reviewsOf();
    if (!saved) throw new Error('Dharti has no review');
    const { user, drawer } = await open(`/reviews/${saved.id}/edit?from=visits`);
    expect(within(drawer).getByTestId(`${D}-save`)).toHaveTextContent('Save changes');
    expect(screen.getByTestId('patient-section-visits')).toBeInTheDocument();
    await user.click(within(drawer).getByTestId(`${D}-rating-4`));
    await user.click(within(drawer).getByTestId(`${D}-save`));
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('Review updated'),
    );
    expect(
      clinicFixtures.reviews.snapshot((row) => row.id === saved.id)[0],
    ).toMatchObject({ rating: 4, source: saved.source });
  });

  it('goes back with a toast when the review is gone', async () => {
    const { router } = renderPatientFile(url(`/reviews/${ref.treatment(1)}/edit`));
    await waitFor(() => expect(router.state.location.pathname).toBe(url('/overview')));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Review not found · it may have been deleted',
    );
  });
});
