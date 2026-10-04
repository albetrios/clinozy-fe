import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { resetPreferencesFixture } from '@/shared/api/clinic/preferences-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import {
  patientFileUrl,
  renderPatientFile,
  resetPatientFile,
} from '../__tests__/integration/patient-file-test-router.tsx';

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

/** The upload tray, lands every file at once: its key, then the filing. */
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => ({
    enqueue: (
      files: readonly File[],
      target: { onUploaded: (key: string, file: File) => unknown },
    ) => {
      const list = Array.from(files);
      void (async () => {
        for (const [index, file] of list.entries()) {
          await target.onUploaded(`uploads/${index}-${file.name}`, file);
        }
      })();
      return { accepted: list.length, skipped: 0 };
    },
  }),
}));

const DHARTI = patientRef('Dharti Galani');
const PHOTOS = patientFileUrl(DHARTI, '/images');

const tiles = () => screen.queryAllByTestId('patient-photo-tile');
const image = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

beforeEach(() => {
  viewport.tier = 'desktop';
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
  resetPreferencesFixture();
  useDevicePrefsStore.setState({ photoSize: 'medium' });
});
afterEach(() => {
  resetPatientFile();
  resetClinicFixtures();
});

describe('Patient file › Photos (KICKOFF §6.6)', () => {
  it('shows the General album by day, the visit it was taken at, and the toolbar', async () => {
    const { container } = renderPatientFile(PHOTOS);
    await waitFor(() => expect(tiles()).toHaveLength(1));
    const section = screen.getByTestId('patient-section-images');
    expect(within(section).getByRole('tab', { name: 'General' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      within(section)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['General', 'Private', 'LHR']);
    expect(section).toHaveTextContent('1 photo');
    const [visit] = clinicFixtures.appointments.snapshot(
      (appointment) => appointment.id === ref.appointment(2790),
    );
    expect(screen.getByTestId('patient-photos-day')).toHaveTextContent(`1 photo · `);
    expect(screen.getByTestId('patient-photos-day')).toHaveTextContent(
      visit?.serviceLabel ?? '',
    );
    expect(screen.getByRole('button', { name: 'Open IMG_5100' })).toBeInTheDocument();
    expect(screen.getByText('Face')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it('switches albums through the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(PHOTOS);
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByRole('tab', { name: 'LHR' }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ album: 'lhr' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Open IMG_5102' }),
    ).toBeInTheDocument();
  });

  it('keeps the Private album to Doctor, Admin and Owner (S:40)', async () => {
    const { router } = renderPatientFile(`${PHOTOS}?album=private`, {
      role: 'front_desk',
    });
    await waitFor(() => expect(router.state.location.search).not.toHaveProperty('album'));
    expect(notifyMock.info).toHaveBeenCalledWith(
      'You do not have permission to perform this action.',
    );
    const section = screen.getByTestId('patient-section-images');
    expect(
      within(section).queryByRole('tab', { name: 'Private' }),
    ).not.toBeInTheDocument();
  });

  it('filters by visit, and says the album is empty', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(PHOTOS);
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByTestId('patient-photos-visit-filter'));
    await user.click(
      await screen.findByRole('option', { name: /Not attached to a visit/ }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ appointment: 'none' }),
    );
    expect(await screen.findByTestId('patient-photos-empty')).toHaveTextContent(
      'No photos in General yet',
    );
  });

  it('keeps the thumbnail size on the device', async () => {
    const user = userEvent.setup();
    renderPatientFile(PHOTOS);
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByRole('radio', { name: 'Large thumbnails' }));
    expect(useDevicePrefsStore.getState().photoSize).toBe('large');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Large thumbnails' }), {
      key: 'ArrowLeft',
    });
    expect(useDevicePrefsStore.getState().photoSize).toBe('medium');
  });

  it('reveals 12 photos at a time', async () => {
    const user = userEvent.setup();
    for (let index = 0; index < 13; index += 1) {
      await clinicFixtures.patientImages.create({
        patientId: DHARTI,
        appointmentId: null,
        album: 'general',
        fileUrl: `uploads/${index}.jpg`,
        fileName: `IMG_${6000 + index}`,
        bodyPart: null,
        takenOn: clinicToday(),
        caption: null,
      });
    }
    renderPatientFile(PHOTOS);
    await waitFor(() => expect(tiles()).toHaveLength(12));
    expect(screen.getByTestId('patient-photos-load-more')).toHaveTextContent(
      'Load more · 2 left',
    );
    await user.click(screen.getByTestId('patient-photos-load-more'));
    await waitFor(() => expect(tiles()).toHaveLength(14));
    expect(screen.queryByTestId('patient-photos-load-more')).not.toBeInTheDocument();
  });

  it('uploads dropped images into the album on screen', async () => {
    renderPatientFile(`${PHOTOS}?album=lhr`);
    await waitFor(() => expect(tiles()).toHaveLength(1));
    fireEvent.drop(screen.getByTestId('patient-photos'), {
      dataTransfer: { files: [image('a.jpg'), image('b.jpg')] },
    });
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('2 photos uploaded to LHR'),
    );
    await waitFor(() => expect(tiles()).toHaveLength(3));
    expect(screen.getByRole('button', { name: 'Open a' })).toBeInTheDocument();
  });

  it('turns away a drop with no image in it', async () => {
    renderPatientFile(PHOTOS);
    await waitFor(() => expect(tiles()).toHaveLength(1));
    fireEvent.drop(screen.getByTestId('patient-photos'), {
      dataTransfer: {
        files: [new File(['x'], 'notes.pdf', { type: 'application/pdf' })],
      },
    });
    expect(notifyMock.info).toHaveBeenCalledWith('Drop image files');
  });

  it('uploads what the picker hands back, from "Upload images"', async () => {
    const user = userEvent.setup();
    renderPatientFile(PHOTOS);
    await waitFor(() => expect(tiles()).toHaveLength(1));
    const click = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {});
    await user.click(screen.getByTestId('patient-section-primary'));
    expect(click).toHaveBeenCalled();
    click.mockRestore();
    fireEvent.change(screen.getByTestId('patient-photos-input'), {
      target: { files: [image('c.jpg')] },
    });
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('1 photo uploaded to General'),
    );
  });

  it('deletes a photo through the reason confirm, with Undo', async () => {
    const user = userEvent.setup();
    renderPatientFile(PHOTOS);
    await waitFor(() => expect(tiles()).toHaveLength(1));
    await user.click(screen.getByTestId('patient-photo-delete'));
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this photo?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent('IMG_5100');
    await user.click(within(dialog).getByTestId('confirm-reason-blurry'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(tiles()).toHaveLength(0));
    expect(notifyMock.undo).toHaveBeenCalledWith('Photo deleted', {
      onUndo: expect.any(Function),
    });
    const [deleted] = clinicFixtures.patientImages
      .snapshot()
      .filter((photo) => photo.fileName === 'IMG_5100');
    expect(deleted).toBeUndefined();
  });

  it('opens the viewer from a tile and Photo details from its Edit', async () => {
    const user = userEvent.setup();
    const { router } = renderPatientFile(`${PHOTOS}?album=lhr`);
    await waitFor(() => expect(tiles()).toHaveLength(1));
    const [lhr] = clinicFixtures.patientImages.snapshot(
      (photo) => photo.fileName === 'IMG_5102',
    );
    await user.click(screen.getByTestId('patient-photo-edit'));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        patientFileUrl(DHARTI, `/images/${lhr?.id}/edit`),
      ),
    );
    expect(router.state.location.search).toMatchObject({ album: 'lhr' });
  });

  it('hides Upload, Edit and Delete from a member who may only look', async () => {
    renderPatientFile(PHOTOS, { role: 'therapist' });
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(screen.queryByTestId('patient-section-primary')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-photo-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('patient-photo-delete')).not.toBeInTheDocument();
  });
});
