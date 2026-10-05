import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PatientImage } from '@/shared/api/clinic/clinic-schema.ts';
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
} from '../../__tests__/integration/patient-file-test-router.tsx';

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

const VARUN = patientRef('Varun Bhimani');
const DHARTI = patientRef('Dharti Galani');

/** Varun's General photos, as the viewer browses them: newest first. */
function varunGeneral(): PatientImage[] {
  return clinicFixtures.patientImages
    .snapshot((photo) => photo.patientId === VARUN && photo.album === 'general')
    .sort(
      (a, b) =>
        b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt),
    );
}

const viewerUrl = (patientId: string, imageId: string, search = '') =>
  patientFileUrl(patientId, '/images/' + imageId) + search;

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

describe('the photo viewer (KICKOFF §6.6; S:40)', () => {
  it('opens one photo over Photos, named, placed in its album', async () => {
    const [first] = varunGeneral();
    const { baseElement } = renderPatientFile(viewerUrl(VARUN, first?.id ?? ''));
    const viewer = await screen.findByTestId('patient-photo-viewer');
    expect(
      within(viewer).getByRole('heading', { name: first?.fileName }),
    ).toBeInTheDocument();
    expect(viewer).toHaveTextContent('1 of 6');
    expect(viewer).toHaveTextContent('Chest');
    expect(viewer).toHaveTextContent('General');
    // The seeded file is a sample with nothing behind it: it fails to load.
    const photo = viewer.querySelector('img');
    if (!photo) throw new Error('no image');
    fireEvent.error(photo);
    expect(viewer).toHaveTextContent('Sample photo · no file attached');
    expect(screen.getByTestId('patient-section-images')).toBeInTheDocument();
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('browses with ‹ › and the arrow keys, replacing the URL', async () => {
    const user = userEvent.setup();
    const photos = varunGeneral();
    const { router } = renderPatientFile(viewerUrl(VARUN, photos[0]?.id ?? ''));
    const viewer = await screen.findByTestId('patient-photo-viewer');
    await user.click(within(viewer).getByTestId('patient-photo-viewer-next'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(VARUN, `/images/${photos[1]?.id}`),
      ),
    );
    fireEvent.keyDown(screen.getByTestId('patient-photo-viewer'), { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(VARUN, `/images/${photos[0]?.id}`),
      ),
    );
    // Wraps: before the first is the last.
    fireEvent.keyDown(screen.getByTestId('patient-photo-viewer'), { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(VARUN, `/images/${photos[5]?.id}`),
      ),
    );
    expect(router.history).toHaveLength(1);
  });

  it('zooms with the buttons and the keys, from 100% to 600%', async () => {
    const user = userEvent.setup();
    const [first] = varunGeneral();
    renderPatientFile(viewerUrl(VARUN, first?.id ?? ''));
    const viewer = await screen.findByTestId('patient-photo-viewer');
    const reset = within(viewer).getByTestId('patient-photo-viewer-zoom-reset');
    expect(reset).toHaveTextContent('100%');
    await user.click(within(viewer).getByTestId('patient-photo-viewer-zoom-in'));
    expect(reset).toHaveTextContent('125%');
    fireEvent.keyDown(viewer, { key: '+' });
    expect(reset).toHaveTextContent('156%');
    fireEvent.keyDown(viewer, { key: '-' });
    expect(reset).toHaveTextContent('125%');
    fireEvent.keyDown(viewer, { key: '0' });
    expect(reset).toHaveTextContent('100%');
    for (let step = 0; step < 12; step += 1) fireEvent.keyDown(viewer, { key: '+' });
    expect(reset).toHaveTextContent('600%');
  });

  it('closes on Esc and ×, back to Photos — never past it to the list', async () => {
    const user = userEvent.setup();
    const [first] = varunGeneral();
    const { router } = renderPatientFile(
      viewerUrl(VARUN, first?.id ?? '', '?appointment=none'),
    );
    const viewer = await screen.findByTestId('patient-photo-viewer');
    fireEvent.keyDown(viewer, { key: 'Escape' });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(VARUN, '/images')),
    );
    expect(router.state.location.search).toMatchObject({ appointment: 'none' });
    expect(screen.queryByTestId('patient-photo-viewer')).not.toBeInTheDocument();

    await router.navigate({ to: viewerUrl(VARUN, first?.id ?? '') });
    await user.click(await screen.findByTestId('patient-photo-viewer-close'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(VARUN, '/images')),
    );
  });

  it('opens Photo details from Edit details', async () => {
    const user = userEvent.setup();
    const [first] = varunGeneral();
    const { router } = renderPatientFile(viewerUrl(VARUN, first?.id ?? ''));
    await user.click(await screen.findByTestId('patient-photo-viewer-edit'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(VARUN, `/images/${first?.id}/edit`),
      ),
    );
    expect(await screen.findByTestId('patient-photo-details')).toBeInTheDocument();
  });

  it('deletes the photo and goes back to Photos, offering Undo', async () => {
    const user = userEvent.setup();
    const [first] = varunGeneral();
    const { router } = renderPatientFile(viewerUrl(VARUN, first?.id ?? ''));
    await user.click(await screen.findByTestId('patient-photo-viewer-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-duplicate'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(VARUN, '/images')),
    );
    expect(notifyMock.undo).toHaveBeenCalledWith('Photo deleted', {
      onUndo: expect.any(Function),
    });
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('says "Photo not found" for a photo that is gone, and for a Private one it can’t open', async () => {
    const { router } = renderPatientFile(
      viewerUrl(VARUN, '00000000-0000-4000-8000-000000000000'),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(patientFileUrl(VARUN, '/images')),
    );
    expect(notifyMock.info).toHaveBeenCalledWith(
      'Photo not found · it may have been deleted',
    );
    resetPatientFile();

    const [secret] = clinicFixtures.patientImages.snapshot(
      (photo) => photo.patientId === DHARTI && photo.album === 'private',
    );
    const frontDesk = renderPatientFile(viewerUrl(DHARTI, secret?.id ?? ''), {
      role: 'front_desk',
    });
    await waitFor(() =>
      expect(frontDesk.router.state.location.pathname).toBe(
        patientFileUrl(DHARTI, '/images'),
      ),
    );
  });
});
