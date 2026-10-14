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
import { shownLocation } from '@/tests/utils/shown-location.ts';

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
      photos: { pick: vi.fn(), capture: vi.fn(), upload },
    });
    await waitFor(() => expect(tiles()).toHaveLength(1));
    const files = [image('a.jpg'), image('b.jpg')];
    fireEvent.drop(screen.getByTestId('patient-photos'), { dataTransfer: { files } });
    expect(upload).toHaveBeenCalledWith(files, 'lhr');
  });

  it('opens the picker for the album on screen from "Upload images"', async () => {
    const user = userEvent.setup();
    const pick = vi.fn();
    renderPhotos(photosUrl(), { photos: { pick, capture: vi.fn(), upload: vi.fn() } });
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
  it('shows the upload strip to a writer — Choose photos and Take photo for the album on screen', async () => {
    const user = userEvent.setup();
    const photos = { pick: vi.fn(), capture: vi.fn(), upload: vi.fn() };
    renderPhotos(photosUrl('?album=lhr'), { photos });
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(screen.getByTestId('patient-photos-upload')).toHaveTextContent('Adds to LHR');
    await user.click(screen.getByTestId('patient-photos-choose'));
    expect(photos.pick).toHaveBeenCalledWith('lhr');
    await user.click(screen.getByTestId('patient-photos-take'));
    expect(photos.capture).toHaveBeenCalledWith('lhr');
  });

  it('uploads an image pasted on the section into the album on screen', async () => {
    const upload = vi.fn();
    renderPhotos(photosUrl(), { photos: { pick: vi.fn(), capture: vi.fn(), upload } });
    await waitFor(() => expect(tiles()).toHaveLength(1));
    const files = [image('pasted.png')];
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', { value: { files } });
    document.body.dispatchEvent(paste);
    expect(upload).toHaveBeenCalledWith(files, 'general');
  });

  it('names the album on the veil while files hover the section', async () => {
    renderPhotos(photosUrl());
    await waitFor(() => expect(tiles()).toHaveLength(1));
    fireEvent.dragOver(screen.getByTestId('patient-photos'), {
      dataTransfer: { types: ['Files'] },
    });
    expect(screen.getByTestId('patient-photos-drop-veil')).toHaveTextContent(
      'Drop to add to General',
    );
  });

  it('turns an empty album into the drop zone for a writer', async () => {
    const user = userEvent.setup();
    seedPhotos([]);
    const pick = vi.fn();
    renderPhotos(photosUrl(), { photos: { pick, capture: vi.fn(), upload: vi.fn() } });
    const zone = await screen.findByTestId('patient-photos-empty');
    expect(zone).toHaveTextContent('No photos in General yet');
    await user.click(within(zone).getByRole('button', { name: 'Choose photos' }));
    expect(pick).toHaveBeenCalledWith('general');
    expect(screen.queryByTestId('patient-photos-upload')).not.toBeInTheDocument();
  });

  it('selects photos and compares them side by side, oldest first, on ?compare=', async () => {
    const user = userEvent.setup();
    seedPhotos([
      photoDouble({
        id: 'pimg_late0000000000000000a',
        displayName: 'Late',
        takenOn: '2026-09-24',
      }),
      photoDouble({
        id: 'pimg_early000000000000000a',
        displayName: 'Early',
        takenOn: '2026-09-03',
      }),
      photoDouble({
        id: 'pimg_mid00000000000000000a',
        displayName: 'Mid',
        takenOn: '2026-09-10',
      }),
    ]);
    const { router } = renderPhotos(photosUrl());
    await waitFor(() => expect(tiles()).toHaveLength(3));
    await user.click(screen.getByTestId('patient-photos-select'));
    for (const name of ['Late', 'Early', 'Mid']) {
      await user.click(screen.getByRole('button', { name: `Select ${name}` }));
    }
    expect(screen.getByTestId('patient-photos-selection-count')).toHaveTextContent(
      '3 selected',
    );
    await user.click(screen.getByTestId('patient-photos-compare'));
    await waitFor(() =>
      expect(shownLocation(router).search).toMatchObject({
        compare:
          'pimg_late0000000000000000a,pimg_early000000000000000a,pimg_mid00000000000000000a',
      }),
    );
    const compare = await screen.findByTestId('patient-photo-compare');
    const panels = within(compare).getAllByTestId('patient-photo-compare-panel');
    expect(panels.map((panel) => panel.getAttribute('data-photo'))).toEqual([
      'pimg_early000000000000000a',
      'pimg_mid00000000000000000a',
      'pimg_late0000000000000000a',
    ]);
    expect(
      within(compare)
        .getAllByTestId('patient-photo-compare-since')
        .map((label) => label.textContent),
    ).toEqual(['Start', '+7 days', '+21 days']);
    await user.click(within(compare).getByTestId('patient-photo-compare-close'));
    await waitFor(() =>
      expect(shownLocation(router).search).not.toHaveProperty('compare'),
    );
    expect(screen.queryByTestId('patient-photo-compare')).not.toBeInTheDocument();
  });

  it('takes eight photos at most, and says so', async () => {
    const user = userEvent.setup();
    seedPhotos(
      Array.from({ length: 9 }, (_, index) =>
        photoDouble({
          id: `pimg_${String(index).padStart(21, 's')}`,
          displayName: `IMG_${7000 + index}`,
        }),
      ),
    );
    renderPhotos(photosUrl());
    await waitFor(() => expect(tiles()).toHaveLength(9));
    for (const check of screen.getAllByTestId('patient-photo-check')) {
      await user.click(check);
    }
    expect(screen.getByTestId('patient-photos-selection-count')).toHaveTextContent(
      '8 selected',
    );
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You can compare up to 8 photos at a time',
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('patient-photos-selection')).not.toBeInTheDocument();
  });

  it('opens a comparison from its link, zooms every panel at once, and takes one out down to two', async () => {
    const user = userEvent.setup();
    const ids = [
      'pimg_one00000000000000000a',
      'pimg_two00000000000000000a',
      'pimg_three0000000000000000',
    ];
    seedPhotos(
      ids.map((id, index) => photoDouble({ id, takenOn: `2026-09-0${index + 1}` })),
    );
    const { router } = renderPhotos(photosUrl(`?compare=${ids.join(',')}`));
    const compare = await screen.findByTestId('patient-photo-compare');
    await waitFor(() =>
      expect(within(compare).getAllByTestId('patient-photo-compare-panel')).toHaveLength(
        3,
      ),
    );
    await user.click(within(compare).getByTestId('patient-photo-compare-zoom-in'));
    const zooms = within(compare)
      .getAllByTestId('patient-photo-compare-panel')
      .map((panel) =>
        panel
          .querySelector<HTMLElement>('[style]')
          ?.style.getPropertyValue('--photo-zoom'),
      );
    expect(zooms).toEqual(['1.25', '1.25', '1.25']);
    const [remove] = within(compare).getAllByTestId('patient-photo-compare-remove');
    await user.click(remove!);
    await waitFor(() =>
      expect(shownLocation(router).search).toMatchObject({
        compare: `${ids[1]},${ids[2]}`,
      }),
    );
    await waitFor(() =>
      expect(within(compare).getAllByTestId('patient-photo-compare-panel')).toHaveLength(
        2,
      ),
    );
    expect(
      within(compare).queryByTestId('patient-photo-compare-remove'),
    ).not.toBeInTheDocument();
  });

  it('switches the comparison between one row and a grid', async () => {
    const user = userEvent.setup();
    const ids = Array.from(
      { length: 5 },
      (_, index) => `pimg_${String(index).padStart(21, 'g')}`,
    );
    seedPhotos(ids.map((id) => photoDouble({ id })));
    renderPhotos(photosUrl(`?compare=${ids.join(',')}`));
    const compare = await screen.findByTestId('patient-photo-compare');
    const stage = within(compare).getByTestId('patient-photo-compare-stage');
    // Five open as a grid: three columns.
    await waitFor(() => expect(stage).toHaveAttribute('data-columns', '3'));
    await user.click(within(compare).getByRole('radio', { name: 'One row' }));
    expect(stage).toHaveAttribute('data-columns', '5');
    expect(await axe(compare)).toHaveNoViolations();
  });
});
