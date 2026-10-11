import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/clinic/appointments-api.ts';
import type * as ImagesApiModule from '@/shared/api/clinic/patient-images-api.ts';
import type { PatientPhoto } from '@/shared/api/clinic/patient-images-contracts.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import { photoDouble, seedPhotos } from '../__tests__/integration/photo-api-double.ts';
import {
  PHOTO_CODES,
  photosUrl,
  renderPhotos,
  resetPhotos,
} from '../__tests__/integration/photos-test-router.tsx';

vi.mock('@/shared/api/clinic/patient-images-api.ts', async (importOriginal) => {
  const double = await import('../__tests__/integration/photo-api-double.ts');
  return {
    ...(await importOriginal<typeof ImagesApiModule>()),
    listPatientPhotos: vi.fn(double.listPatientPhotos),
    fetchPatientPhoto: vi.fn(double.fetchPatientPhoto),
    updatePatientPhoto: vi.fn(double.updatePatientPhoto),
    deletePatientPhoto: vi.fn(double.deletePatientPhoto),
    restorePatientPhoto: vi.fn(double.restorePatientPhoto),
  };
});
vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof AppointmentsApiModule>()),
  fetchPersonAppointments: vi.fn(async () => []),
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

/** Fourteen General photos, newest first — more than a page of 12 — and one Private. */
const GENERAL: PatientPhoto[] = Array.from({ length: 14 }, (_, index) =>
  photoDouble({
    id: `pimg_${String(index).padStart(21, 'g')}`,
    displayName: `IMG_${6000 + index}`,
    fileName: `IMG_${6000 + index}.png`,
    bodyPart: index === 0 ? 'chest' : null,
    createdAt: `2026-09-24T06:${String(59 - index)}:00.000Z`,
  }),
);
const PRIVATE = photoDouble({ id: 'pimg_private000000000000a', album: 'private' });

const viewerUrl = (photo: PatientPhoto, search = '') =>
  photosUrl(`/${photo.id}${search}`);
const pathOf = (rest = '') => photosUrl(rest);
const first = GENERAL[0] as PatientPhoto;
const second = GENERAL[1] as PatientPhoto;

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  seedPhotos([...GENERAL, PRIVATE]);
});
afterEach(() => resetPhotos());

describe('the photo viewer (KICKOFF §6.6; S:40)', () => {
  it('opens one photo over Photos, named and placed among the album’s photos', async () => {
    const { baseElement } = renderPhotos(viewerUrl(first));
    const viewer = await screen.findByTestId('patient-photo-viewer');
    expect(within(viewer).getByRole('heading', { name: 'IMG_6000' })).toBeInTheDocument();
    await waitFor(() => expect(viewer).toHaveTextContent('1 of 14'));
    expect(viewer).toHaveTextContent('Chest');
    expect(viewer).toHaveTextContent('General');
    // The photo itself, from its link (D86).
    expect(
      screen.getByTestId('patient-photo-viewer-stage').querySelector('img'),
    ).toHaveAttribute('src', expect.stringContaining('X-Amz-Expires=900'));
    expect(screen.getByTestId('patient-section-images')).toBeInTheDocument();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('browses with ‹ › and the arrow keys, replacing the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderPhotos(viewerUrl(first));
    const viewer = await screen.findByTestId('patient-photo-viewer');
    await waitFor(() => expect(viewer).toHaveTextContent('1 of 14'));
    await user.click(within(viewer).getByTestId('patient-photo-viewer-next'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(pathOf(`/${second.id}`)),
    );
    fireEvent.keyDown(screen.getByTestId('patient-photo-viewer'), { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(pathOf(`/${first.id}`)),
    );
    expect(router.history).toHaveLength(1);
  });

  it('reads the next page to step past the photos read, then wraps at the end', async () => {
    const user = userEvent.setup();
    const twelfth = GENERAL[11] as PatientPhoto;
    const last = GENERAL[13] as PatientPhoto;
    const { router } = renderPhotos(viewerUrl(twelfth));
    const viewer = await screen.findByTestId('patient-photo-viewer');
    await waitFor(() => expect(viewer).toHaveTextContent('12 of 14'));
    await user.click(within(viewer).getByTestId('patient-photo-viewer-next'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(pathOf(`/${GENERAL[12]?.id}`)),
    );
    await user.click(screen.getByTestId('patient-photo-viewer-next'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(pathOf(`/${last.id}`)),
    );
    await user.click(screen.getByTestId('patient-photo-viewer-next'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(pathOf(`/${first.id}`)),
    );
  });

  it('closes on Esc and ×, back to Photos with its filter', async () => {
    const user = userEvent.setup();
    const { router } = renderPhotos(viewerUrl(first, '?appointment=none'));
    const viewer = await screen.findByTestId('patient-photo-viewer');
    fireEvent.keyDown(viewer, { key: 'Escape' });
    await waitFor(() => expect(router.state.location.pathname).toBe(pathOf()));
    expect(router.state.location.search).toMatchObject({ appointment: 'none' });
    expect(screen.queryByTestId('patient-photo-viewer')).not.toBeInTheDocument();

    await router.navigate({ to: viewerUrl(first) });
    await user.click(await screen.findByTestId('patient-photo-viewer-close'));
    await waitFor(() => expect(router.state.location.pathname).toBe(pathOf()));
  });

  it('opens Photo details from Edit details', async () => {
    const user = userEvent.setup();
    const { router } = renderPhotos(viewerUrl(first));
    await user.click(await screen.findByTestId('patient-photo-viewer-edit'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(pathOf(`/${first.id}/edit`)),
    );
    expect(await screen.findByTestId('patient-photo-details')).toBeInTheDocument();
  });

  it('deletes the photo and goes back to Photos, offering Undo', async () => {
    const user = userEvent.setup();
    const { router } = renderPhotos(viewerUrl(first));
    await user.click(await screen.findByTestId('patient-photo-viewer-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Duplicate' }));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(router.state.location.pathname).toBe(pathOf()));
    expect(notifyMock.undo).toHaveBeenCalledWith('Photo deleted', {
      onUndo: expect.any(Function),
    });
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('offers neither Edit nor Delete without patient:update', async () => {
    renderPhotos(viewerUrl(first), {
      codes: PHOTO_CODES.filter((code) => code !== 'patient:update'),
    });
    await screen.findByTestId('patient-photo-viewer');
    expect(screen.queryByTestId('patient-photo-viewer-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-photo-viewer-delete')).not.toBeInTheDocument();
  });

  it('says "Photo not found" for a photo the API does not answer, and goes back', async () => {
    const { router } = renderPhotos(photosUrl('/pimg_gone0000000000000000'));
    await waitFor(() => expect(router.state.location.pathname).toBe(pathOf()));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Photo not found · it may have been deleted',
    );
  });
});
