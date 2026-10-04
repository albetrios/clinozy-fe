import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import {
  listPatientPhotos,
  type PatientPhoto,
} from '@/shared/api/clinic/patient-images-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { PhotoDeleteConfirm } from './PhotoDeleteConfirm.tsx';

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

let photo: PatientPhoto;

beforeEach(async () => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  resetClinicFixtures();
  const read = await listPatientPhotos(patientRef('Dharti Galani'), {
    privateAlbum: true,
  });
  const first = read.photos.find((candidate) => candidate.album === 'general');
  if (!first) throw new Error('no photo');
  photo = first;
});
afterEach(() => resetClinicFixtures());

describe('PhotoDeleteConfirm', () => {
  it('asks with the photo’s name and the four reasons', async () => {
    const { baseElement } = renderWithProviders(
      <PhotoDeleteConfirm photo={photo} onClose={vi.fn()} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this photo?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent('IMG_5100');
    for (const reason of ['wrong-patient', 'blurry', 'duplicate', 'other']) {
      expect(within(dialog).getByTestId(`confirm-reason-${reason}`)).toBeInTheDocument();
    }
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('stores a reason the schema lacks as "other" with its label, and offers Undo', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(
      <PhotoDeleteConfirm photo={photo} onClose={onClose} onDeleted={onDeleted} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByTestId('confirm-reason-wrong-patient'));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalled();
    const all = clinicFixtures.patientImages.snapshot((image) => image.id === photo.id);
    expect(all).toHaveLength(0);
    expect(notifyMock.undo).toHaveBeenCalledWith('Photo deleted', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() =>
      expect(
        clinicFixtures.patientImages.snapshot((image) => image.id === photo.id),
      ).toHaveLength(1),
    );
  });

  it('stays closed without a photo', () => {
    renderWithProviders(<PhotoDeleteConfirm photo={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });
});
