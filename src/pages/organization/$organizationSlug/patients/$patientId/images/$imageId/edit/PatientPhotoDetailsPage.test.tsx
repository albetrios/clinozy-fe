import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { resetPreferencesFixture } from '@/shared/api/clinic/preferences-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../../../__tests__/integration/patient-file-test-router.tsx';

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
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const DHARTI = patientRef('Dharti Galani');

/** Dharti's General photo — IMG_5100, Face, filed under visit #2790. */
function general() {
  const [photo] = clinicFixtures.patientImages.snapshot(
    (image) => image.patientId === DHARTI && image.album === 'general',
  );
  if (!photo) throw new Error('no photo');
  return photo;
}

const detailsUrl = (imageId: string) =>
  patientFileUrl(DHARTI, '/images/' + imageId + '/edit') + '?album=lhr';

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
  resetPreferencesFixture();
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('Photo details (KICKOFF §6.6; S:42)', () => {
  it('opens over Photos with the photo’s name, date, album, body part and visit', async () => {
    const photo = general();
    const { baseElement } = renderPatientFile(detailsUrl(photo.id));
    const drawer = await screen.findByTestId('patient-photo-details');
    expect(within(drawer).getByText('Photo details')).toBeInTheDocument();
    expect(within(drawer).getByTestId('patient-photo-details-name')).toHaveValue(
      'IMG_5100',
    );
    expect(
      within(drawer).getByTestId('patient-photo-details-album-general'),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(drawer).getByTestId('patient-photo-details-body-part-face'),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(drawer).getByTestId(`patient-photo-details-visit-${photo.appointmentId}`),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('patient-section-images')).toBeInTheDocument();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('saves what changed and goes back to Photos, keeping its album', async () => {
    const user = userEvent.setup();
    const photo = general();
    const { router } = renderPatientFile(detailsUrl(photo.id));
    const drawer = await screen.findByTestId('patient-photo-details');
    const name = within(drawer).getByTestId('patient-photo-details-name');
    await user.clear(name);
    await user.type(name, 'Left cheek before peel');
    await user.click(within(drawer).getByTestId('patient-photo-details-album-lhr'));
    await user.click(within(drawer).getByTestId('patient-photo-details-body-part-chest'));
    await user.click(within(drawer).getByTestId('patient-photo-details-visit-none'));
    await user.click(within(drawer).getByTestId('patient-photo-details-save'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/images')),
    );
    expect(router.state.location.search).toMatchObject({ album: 'lhr' });
    expect(notifyMock.success).toHaveBeenCalledWith('Photo details saved');
    expect(await clinicFixtures.patientImages.get(photo.id)).toMatchObject({
      caption: 'Left cheek before peel',
      album: 'lhr',
      bodyPart: 'chest',
      appointmentId: null,
    });
  });

  it('keeps the old name when the field is left blank', async () => {
    const user = userEvent.setup();
    const photo = general();
    renderPatientFile(detailsUrl(photo.id));
    const drawer = await screen.findByTestId('patient-photo-details');
    await user.clear(within(drawer).getByTestId('patient-photo-details-name'));
    await user.click(within(drawer).getByTestId('patient-photo-details-body-part-face'));
    await user.click(within(drawer).getByTestId('patient-photo-details-save'));
    await waitFor(() => expect(notifyMock.success).toHaveBeenCalled());
    expect(await clinicFixtures.patientImages.get(photo.id)).toMatchObject({
      caption: null,
      bodyPart: null,
    });
  });

  it('reads only, without the Private album, for a member who can’t edit', async () => {
    const photo = general();
    renderPatientFile(detailsUrl(photo.id), { role: 'therapist' });
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
    const { router } = renderPatientFile(
      detailsUrl('00000000-0000-4000-8000-000000000000'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(DHARTI, '/images')),
    );
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Photo not found · it may have been deleted',
    );
  });
});
