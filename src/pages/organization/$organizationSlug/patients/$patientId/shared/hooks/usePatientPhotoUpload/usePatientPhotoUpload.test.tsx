import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { usePatientPhotoUpload } from './usePatientPhotoUpload.ts';

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

/** The tray, landing each file in turn once the test lets it. */
const tray = vi.hoisted(() => ({
  pending: [] as (() => Promise<unknown>)[],
}));
vi.mock('@/shared/hooks/useUploadQueue/index.ts', () => ({
  useUploadQueue: () => ({
    enqueue: (
      files: readonly File[],
      target: { onUploaded: (key: string, file: File) => unknown },
    ) => {
      const list = Array.from(files);
      for (const file of list) {
        tray.pending.push(async () => target.onUploaded(`uploads/${file.name}`, file));
      }
      return { accepted: list.length, skipped: 0 };
    },
  }),
}));

const DHARTI = patientRef('Dharti Galani');
const image = (name: string, type = 'image/jpeg') => new File(['x'], name, { type });

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  tray.pending = [];
  resetClinicFixtures();
});
afterEach(() => resetClinicFixtures());

describe('usePatientPhotoUpload', () => {
  it('files each image in the album as it lands, and says so once the last has', async () => {
    const { result } = renderHook(() => usePatientPhotoUpload(DHARTI), { wrapper });
    act(() =>
      result.current.upload(
        [
          image('IMG_1.jpg'),
          image('notes.pdf', 'application/pdf'),
          image('IMG_2.png', 'image/png'),
        ],
        'lhr',
      ),
    );
    expect(tray.pending).toHaveLength(2);
    await act(() => tray.pending[0]?.());
    expect(notifyMock.success).not.toHaveBeenCalled();
    await act(() => tray.pending[1]?.());
    expect(notifyMock.success).toHaveBeenCalledWith('2 photos uploaded to LHR');
    const filed = clinicFixtures.patientImages.snapshot(
      (photo) =>
        photo.patientId === DHARTI &&
        photo.fileName.startsWith('IMG_') &&
        photo.album === 'lhr' &&
        photo.appointmentId === null,
    );
    expect(filed.map((photo) => photo.fileName)).toEqual(
      expect.arrayContaining(['IMG_1', 'IMG_2']),
    );
  });

  it('turns away a drop with no image in it', () => {
    const { result } = renderHook(() => usePatientPhotoUpload(DHARTI), { wrapper });
    act(() => result.current.upload([image('notes.pdf', 'application/pdf')], 'general'));
    expect(notifyMock.info).toHaveBeenCalledWith('Drop image files');
    expect(tray.pending).toHaveLength(0);
  });

  it('opens the picker for an album and uploads what it hands back there', async () => {
    function Probe() {
      const upload = usePatientPhotoUpload(DHARTI);
      return (
        <>
          <input {...upload.inputProps} />
          <button type="button" onClick={() => upload.pick('lhr')}>
            Pick
          </button>
        </>
      );
    }
    const click = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {});
    const { getByRole, getByTestId } = render(<Probe />, { wrapper });
    fireEvent.click(getByRole('button', { name: 'Pick' }));
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
    const input = getByTestId('patient-photos-input');
    expect(input).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
    fireEvent.change(input, { target: { files: [image('IMG_3.webp', 'image/webp')] } });
    await act(() => tray.pending[0]?.());
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('1 photo uploaded to LHR'),
    );
  });
});
