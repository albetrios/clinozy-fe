import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as AppointmentsApiModule from '@/shared/api/clinic/appointments-api.ts';
import { fetchPersonAppointments } from '@/shared/api/clinic/appointments-api.ts';
import type * as ImagesApiModule from '@/shared/api/clinic/patient-images-api.ts';
import { updatePatientPhoto } from '@/shared/api/clinic/patient-images-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { appointmentRow } from '@/tests/utils/appointment-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  PHOTO_PATIENT_ID,
  PHOTO_VISIT_ID,
  photoDouble,
  seedPhotos,
  storedPhotos,
} from '../../__tests__/integration/photo-api-double.ts';
import {
  PHOTO_CODES,
  photosUrl,
  renderPhotos,
  resetPhotos,
} from '../../__tests__/integration/photos-test-router.tsx';

vi.mock('@/shared/api/clinic/patient-images-api.ts', async (importOriginal) => {
  const double = await import('../../__tests__/integration/photo-api-double.ts');
  return {
    ...(await importOriginal<typeof ImagesApiModule>()),
    listPatientPhotos: vi.fn(double.listPatientPhotos),
    fetchPatientPhoto: vi.fn(double.fetchPatientPhoto),
    updatePatientPhoto: vi.fn(double.updatePatientPhoto),
  };
});
vi.mock('@/shared/api/clinic/appointments-api.ts', async (importOriginal) => ({
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

/** IMG_5100 in General: Face, filed under the Hydrafacial visit. */
const PHOTO = photoDouble({ bodyPart: 'face', appointmentId: PHOTO_VISIT_ID });

const detailsUrl = (imageId: string) => photosUrl(`/${imageId}/edit?album=lhr`);
const stored = () => storedPhotos()[0]?.photo;

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(updatePatientPhoto).mockClear();
  seedPhotos([PHOTO]);
  vi.mocked(fetchPersonAppointments).mockResolvedValue([
    appointmentRow({
      id: PHOTO_VISIT_ID,
      patientId: PHOTO_PATIENT_ID,
      date: '2026-09-24',
      serviceLabel: 'Hydrafacial',
      status: 'completed',
    }),
  ]);
});
afterEach(() => resetPhotos());

describe('Photo details (KICKOFF §6.6; S:41)', () => {
  it('opens over Photos with the photo’s name, date, album, stage, body part and visit', async () => {
    const { baseElement } = renderPhotos(detailsUrl(PHOTO.id));
    const drawer = await screen.findByTestId('patient-photo-details');
    expect(within(drawer).getByText('Photo details')).toBeInTheDocument();
    expect(within(drawer).getByTestId('patient-photo-details-name')).toHaveValue(
      'IMG_5100',
    );
    expect(
      within(drawer).getByTestId('patient-photo-details-album-general'),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(drawer).getByTestId('patient-photo-details-stage-before'),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(
      within(drawer).getByTestId('patient-photo-details-body-part-face'),
    ).toHaveAttribute('aria-pressed', 'true');
    // The API's fifteen body parts.
    expect(
      within(drawer).getByTestId('patient-photo-details-body-part-full_body'),
    ).toBeInTheDocument();
    expect(
      await within(drawer).findByTestId(`patient-photo-details-visit-${PHOTO_VISIT_ID}`),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('patient-section-images')).toBeInTheDocument();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('saves what changed with the read’s updated_at and goes back to Photos, keeping its album', async () => {
    const user = userEvent.setup();
    const { router } = renderPhotos(detailsUrl(PHOTO.id));
    const drawer = await screen.findByTestId('patient-photo-details');
    const name = within(drawer).getByTestId('patient-photo-details-name');
    await user.clear(name);
    await user.type(name, 'Left cheek before peel');
    await user.click(within(drawer).getByTestId('patient-photo-details-album-lhr'));
    await user.click(within(drawer).getByTestId('patient-photo-details-stage-after'));
    await user.click(within(drawer).getByTestId('patient-photo-details-body-part-chest'));
    await user.click(within(drawer).getByTestId('patient-photo-details-visit-none'));
    await user.click(within(drawer).getByTestId('patient-photo-details-save'));
    await waitFor(() => expect(router.state.location.pathname).toBe(photosUrl()));
    expect(router.state.location.search).toMatchObject({ album: 'lhr' });
    expect(notifyMock.success).toHaveBeenCalledWith('Photo details saved');
    expect(updatePatientPhoto).toHaveBeenCalledWith({
      photo: expect.objectContaining({ id: PHOTO.id, updatedAt: PHOTO.updatedAt }),
      change: {
        caption: 'Left cheek before peel',
        album: 'lhr',
        stage: 'after',
        bodyPart: 'chest',
        appointmentId: null,
      },
      idempotencyKey: expect.any(String),
    });
    expect(stored()).toMatchObject({ caption: 'Left cheek before peel', album: 'lhr' });
  });

  it('keeps the old name when the field is left blank', async () => {
    const user = userEvent.setup();
    renderPhotos(detailsUrl(PHOTO.id));
    const drawer = await screen.findByTestId('patient-photo-details');
    await user.clear(within(drawer).getByTestId('patient-photo-details-name'));
    await user.click(within(drawer).getByTestId('patient-photo-details-body-part-face'));
    await user.click(within(drawer).getByTestId('patient-photo-details-save'));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalled());
    expect(vi.mocked(updatePatientPhoto).mock.calls[0]?.[0].change).toEqual({
      bodyPart: null,
    });
    expect(stored()).toMatchObject({ caption: null, bodyPart: null });
  });

  it('outlines the field the server refuses, keeping the drawer open', async () => {
    const user = userEvent.setup();
    vi.mocked(updatePatientPhoto).mockRejectedValueOnce(
      new HttpError('Invalid', 400, '/x', 'PATCH', {
        error: {
          type: 'validation_error',
          detail: 'The date taken can’t be in the future',
          errors: [
            { field: 'taken_on', message: 'The date taken can’t be in the future' },
          ],
        },
      }),
    );
    renderPhotos(detailsUrl(PHOTO.id));
    const drawer = await screen.findByTestId('patient-photo-details');
    await user.click(within(drawer).getByTestId('patient-photo-details-stage-before'));
    await user.click(within(drawer).getByTestId('patient-photo-details-save'));
    expect(
      await within(drawer).findByText('The date taken can’t be in the future'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('patient-photo-details')).toBeInTheDocument();
  });

  it('offers "Reload" when someone saved the photo meanwhile', async () => {
    const user = userEvent.setup();
    renderPhotos(detailsUrl(PHOTO.id));
    const drawer = await screen.findByTestId('patient-photo-details');
    // Another tab saves first: the drawer's read is now stale.
    const row = storedPhotos()[0];
    if (row) row.photo = { ...row.photo, updatedAt: '2026-10-09T09:00:00.000Z' };
    await user.click(within(drawer).getByTestId('patient-photo-details-stage-after'));
    await user.click(within(drawer).getByTestId('patient-photo-details-save'));
    await waitFor(() =>
      expect(notifyMock.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ action: expect.objectContaining({ label: 'Reload' }) }),
      ),
    );
  });

  it('reads only, without the Private album, for a member without patient:update or its code', async () => {
    renderPhotos(detailsUrl(PHOTO.id), {
      codes: PHOTO_CODES.filter(
        (code) => code !== 'patient:update' && code !== 'patient:private_album:read',
      ),
    });
    const drawer = await screen.findByTestId('patient-photo-details');
    expect(
      within(drawer).queryByTestId('patient-photo-details-save'),
    ).not.toBeInTheDocument();
    expect(within(drawer).getByTestId('patient-photo-details-name')).toBeDisabled();
    expect(
      within(drawer).queryByTestId('patient-photo-details-album-private'),
    ).not.toBeInTheDocument();
  });

  it('says "Photo not found" for a photo that is gone', async () => {
    const { router } = renderPhotos(detailsUrl('pimg_gone0000000000000000'));
    await waitFor(() => expect(router.state.location.pathname).toBe(photosUrl()));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Photo not found · it may have been deleted',
    );
  });
});
