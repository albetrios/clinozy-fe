import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type * as AppointmentsApiModule from '@/shared/api/app/appointments-api.ts';
import { fetchPersonAppointments } from '@/shared/api/app/appointments-api.ts';
import type * as ImagesApiModule from '@/shared/api/app/patient-images-api.ts';
import { listPatientPhotos } from '@/shared/api/app/patient-images-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';
import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';

import {
  PHOTO_PATIENT_ID,
  PHOTO_VISIT_ID,
  photoDouble,
  seedPhotos,
  storedPhotos,
} from './__tests__/integration/photo-api-double.ts';
import {
  PHOTO_CODES,
  photosUrl,
  renderPhotos,
  resetPhotos,
} from './__tests__/integration/photos-test-router.tsx';

vi.mock('@/shared/api/app/patient-images-api.ts', async (importOriginal) => {
  const double = await import('./__tests__/integration/photo-api-double.ts');
  return {
    ...(await importOriginal<typeof ImagesApiModule>()),
    listPatientPhotos: vi.fn(double.listPatientPhotos),
    fetchPatientPhoto: vi.fn(double.fetchPatientPhoto),
    deletePatientPhoto: vi.fn(double.deletePatientPhoto),
    restorePatientPhoto: vi.fn(double.restorePatientPhoto),
  };
});
vi.mock('@/shared/api/app/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof AppointmentsApiModule>()),
  fetchPersonAppointments: vi.fn(),
}));

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
    dismiss: vi.fn(),
  },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notify: notifyMock,
}));

/** The patient's three photos: one per album, the General one filed under a visit. */
const GENERAL = photoDouble({
  id: 'pimg_general000000000000a',
  appointmentId: PHOTO_VISIT_ID,
  serviceLabel: 'Hydrafacial',
  bodyPart: 'face',
});
const LHR = photoDouble({
  id: 'pimg_lhr0000000000000000a',
  album: 'lhr',
  displayName: 'IMG_5102',
  fileName: 'IMG_5102.png',
  stage: 'before',
});
const PRIVATE = photoDouble({
  id: 'pimg_private000000000000a',
  album: 'private',
  displayName: 'IMG_5103',
});

const tiles = () => screen.queryAllByTestId('patient-photo-tile');
const image = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(listPatientPhotos).mockClear();
  seedPhotos([GENERAL, LHR, PRIVATE]);
  vi.mocked(fetchPersonAppointments).mockResolvedValue([
    appointmentRow({
      id: PHOTO_VISIT_ID,
      patientId: PHOTO_PATIENT_ID,
      seq: 2790,
      date: '2026-09-24',
      serviceLabel: 'Hydrafacial',
      status: 'completed',
    }),
  ]);
  useDevicePrefsStore.setState({ photoSize: 'medium' });
});
afterEach(() => resetPhotos());

describe('Patient file › Photos (KICKOFF §6.6)', () => {
  it('shows the General album by day with its visit, the albums’ counts and the toolbar', async () => {
    const { container } = renderPhotos(photosUrl());
    await waitFor(() => expect(tiles()).toHaveLength(1));
    const section = screen.getByTestId('patient-section-images');
    expect(within(section).getByRole('tab', { name: /^General/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(section).getAllByRole('tab')).toHaveLength(3);
    expect(within(section).getByRole('tab', { name: /^General/ })).toHaveAccessibleName(
      /1 photo/,
    );
    expect(screen.getByTestId('patient-photos-day')).toHaveTextContent('Hydrafacial');
    expect(screen.getByRole('button', { name: 'Open IMG_5100' })).toBeInTheDocument();
    expect(screen.getByText('Face')).toBeInTheDocument();
    expect(listPatientPhotos).toHaveBeenCalledWith(
      PHOTO_PATIENT_ID,
      { album: 'general', limit: 12 },
      undefined,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('switches albums through the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderPhotos(photosUrl());
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByRole('tab', { name: /^LHR/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ album: 'lhr' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Open IMG_5102' }),
    ).toBeInTheDocument();
  });

  it('keeps the Private album to a member with its code', async () => {
    const { router } = renderPhotos(photosUrl('?album=private'), {
      codes: PHOTO_CODES.filter((code) => code !== 'patient:private_album:read'),
    });
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('album'));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    const section = screen.getByTestId('patient-section-images');
    expect(
      within(section).queryByRole('tab', { name: /^Private/ }),
    ).not.toBeInTheDocument();
    expect(listPatientPhotos).not.toHaveBeenCalledWith(
      PHOTO_PATIENT_ID,
      expect.objectContaining({ album: 'private' }),
      undefined,
    );
  });

  it('filters by visit through the API, and says the album is empty', async () => {
    const user = userEvent.setup();
    const { router } = renderPhotos(photosUrl());
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByTestId('patient-photos-visit-filter'));
    expect(
      await screen.findByRole('option', { name: /Hydrafacial/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Not attached to a visit/ }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ appointment: 'none' }),
    );
    expect(await screen.findByTestId('patient-photos-empty')).toHaveTextContent(
      'No photos in General yet',
    );
    expect(listPatientPhotos).toHaveBeenCalledWith(
      PHOTO_PATIENT_ID,
      { album: 'general', appointmentId: 'none', limit: 12 },
      undefined,
    );
  });

  it('keeps the thumbnail size on the device', async () => {
    const user = userEvent.setup();
    renderPhotos(photosUrl());
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByRole('radio', { name: 'Large thumbnails' }));
    expect(useDevicePrefsStore.getState().photoSize).toBe('large');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Large thumbnails' }), {
      key: 'ArrowLeft',
    });
    expect(useDevicePrefsStore.getState().photoSize).toBe('medium');
  });

  it('reads 12 photos a page, and the next with "Load more"', async () => {
    const user = userEvent.setup();
    seedPhotos(
      Array.from({ length: 14 }, (_, index) =>
        photoDouble({
          id: `pimg_${String(index).padStart(21, 'p')}`,
          displayName: `IMG_${6000 + index}`,
          createdAt: `2026-09-24T06:${String(10 + index)}:00.000Z`,
        }),
      ),
    );
    renderPhotos(photosUrl());
    await waitFor(() => expect(tiles()).toHaveLength(12));
    expect(screen.getByTestId('patient-photos-load-more')).toHaveTextContent(
      'Load more · 2 left',
    );
    await user.click(screen.getByTestId('patient-photos-load-more'));
    await waitFor(() => expect(tiles()).toHaveLength(14));
    expect(screen.queryByTestId('patient-photos-load-more')).not.toBeInTheDocument();
    expect(vi.mocked(listPatientPhotos).mock.calls.at(-1)?.[2]).toBe('12');
  });

  it('uploads dropped files into the album on screen', async () => {
    const upload = vi.fn();
    renderPhotos(photosUrl('?album=lhr'), {
      photos: { pick: vi.fn(), upload },
    });
    await waitFor(() => expect(tiles()).toHaveLength(1));
    const files = [image('a.jpg'), image('b.jpg')];
    fireEvent.drop(screen.getByTestId('patient-photos'), { dataTransfer: { files } });
    expect(upload).toHaveBeenCalledWith(files, 'lhr');
  });

  it('opens the picker for the album on screen from "Upload images"', async () => {
    const user = userEvent.setup();
    const pick = vi.fn();
    renderPhotos(photosUrl(), { photos: { pick, upload: vi.fn() } });
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByTestId('patient-section-primary'));
    expect(pick).toHaveBeenCalledWith('general');
  });

  it('deletes a photo through the reason confirm, with Undo', async () => {
    const user = userEvent.setup();
    renderPhotos(photosUrl());
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByTestId('patient-photo-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this photo?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent('IMG_5100');
    await user.click(within(dialog).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(tiles()).toHaveLength(0));
    expect(notifyMock.undo).toHaveBeenCalledWith('Photo deleted', {
      onUndo: expect.any(Function),
    });
    expect(storedPhotos().find((row) => row.photo.id === GENERAL.id)?.deleted).toEqual({
      reason: 'duplicate',
      note: null,
    });
  });

  it('opens the viewer from a tile and Photo details from its Edit, keeping the album', async () => {
    const user = userEvent.setup();
    const { router } = renderPhotos(photosUrl('?album=lhr'));
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByTestId('patient-photo-edit'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(photosUrl(`/${LHR.id}/edit`)),
    );
    expect(router.state.location.search).toMatchObject({ album: 'lhr' });
  });

  it('hides Upload, Edit and Delete from a member without patient:update', async () => {
    renderPhotos(photosUrl(), {
      codes: PHOTO_CODES.filter((code) => code !== 'patient:update'),
    });
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(screen.queryByTestId('patient-section-primary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-photo-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-photo-delete')).not.toBeInTheDocument();
  });

  it('says a failed read failed, and reads again on Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(listPatientPhotos).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderPhotos(photosUrl());
    const retry = await screen.findByTestId('retry-button');
    expect(screen.queryByTestId('patient-photos-empty')).not.toBeInTheDocument();
    await user.click(retry);
    await waitFor(() => expect(tiles()).toHaveLength(1));
  });
});
