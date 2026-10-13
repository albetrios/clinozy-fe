import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ImagesApiModule from '@/shared/api/app/patient-images-api.ts';
import type { ViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { axeForDialog } from '@/tests/utils/axe-for-dialog.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import {
  photoDouble,
  seedPhotos,
  storedPhotos,
} from '../../../__tests__/integration/photo-api-double.ts';
import { PhotoDeleteConfirm } from './PhotoDeleteConfirm.tsx';

vi.mock('@/shared/api/app/patient-images-api.ts', async (importOriginal) => {
  const double = await import('../../../__tests__/integration/photo-api-double.ts');
  return {
    ...(await importOriginal<typeof ImagesApiModule>()),
    deletePatientPhoto: vi.fn(double.deletePatientPhoto),
    restorePatientPhoto: vi.fn(double.restorePatientPhoto),
  };
});

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

const PHOTO = photoDouble();

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  signInTestMember();
  seedPhotos([PHOTO]);
});

describe('PhotoDeleteConfirm', () => {
  it('asks with the photo’s name and the four reasons', async () => {
    const { baseElement } = renderWithProviders(
      <PhotoDeleteConfirm photo={PHOTO} onClose={vi.fn()} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(within(dialog).getByText('Delete this photo?')).toBeInTheDocument();
    expect(within(dialog).getByTestId('confirm-record')).toHaveTextContent('IMG_5100');
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['Wrong patient', 'Blurry / retake', 'Duplicate', 'Other']);
    expect(await axeForDialog(baseElement)).toHaveNoViolations();
  });

  it('stores each reason as the API’s, and offers Undo, which restores it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderWithProviders(
      <PhotoDeleteConfirm photo={PHOTO} onClose={onClose} onDeleted={onDeleted} />,
    );
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Blurry / retake' }));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalled();
    expect(storedPhotos()[0]?.deleted).toEqual({ reason: 'not_needed', note: null });
    expect(notifyMock.undo).toHaveBeenCalledWith('Photo deleted', {
      onUndo: expect.any(Function),
    });
    const [, { onUndo }] = notifyMock.undo.mock.calls[0] as [
      string,
      { onUndo: () => void },
    ];
    onUndo();
    await waitFor(() => expect(storedPhotos()[0]?.deleted).toBeNull());
  });

  it('files "Wrong patient" as a mistake', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PhotoDeleteConfirm photo={PHOTO} onClose={vi.fn()} />);
    const dialog = await screen.findByTestId('confirm-dialog');
    await user.click(within(dialog).getByRole('radio', { name: 'Wrong patient' }));
    await user.click(within(dialog).getByTestId('confirm-accept'));
    await waitFor(() =>
      expect(storedPhotos()[0]?.deleted).toEqual({ reason: 'mistake', note: null }),
    );
  });

  it('stays closed without a photo', () => {
    renderWithProviders(<PhotoDeleteConfirm photo={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });
});
