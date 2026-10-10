import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ImagesApiModule from '@/shared/api/clinic/patient-images-api.ts';
import { attachPatientImage } from '@/shared/api/clinic/patient-images-api.ts';

import { usePatientPhotoUpload } from './usePatientPhotoUpload.ts';

vi.mock('@/shared/api/clinic/patient-images-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ImagesApiModule>()),
  attachPatientImage: vi.fn(async () => ({})),
}));

const { notifyMock } = vi.hoisted(() => ({
  notifyMock: { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));
vi.mock('@/shared/notify/index.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  notify: notifyMock,
}));

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

const PATIENT_ID = 'pat_priya0000000000000000';
const image = (name: string, type = 'image/jpeg') => new File(['x'], name, { type });

function makeWrapper() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  return {
    invalidate,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  for (const fn of Object.values(notifyMock)) fn.mockReset();
  vi.mocked(attachPatientImage).mockClear();
  tray.pending = [];
});

describe('usePatientPhotoUpload', () => {
  it('files each JPG and PNG in the album as it lands, and says so once the last has', async () => {
    const { wrapper, invalidate } = makeWrapper();
    const { result } = renderHook(() => usePatientPhotoUpload(PATIENT_ID), { wrapper });
    act(() =>
      result.current.upload(
        [
          image('IMG_1.jpg'),
          image('notes.pdf', 'application/pdf'),
          image('IMG_2.webp', 'image/webp'),
          image('IMG_3.png', 'image/png'),
        ],
        'lhr',
      ),
    );
    expect(tray.pending).toHaveLength(2);
    await act(() => tray.pending[0]?.());
    expect(notifyMock.success).not.toHaveBeenCalled();
    await act(() => tray.pending[1]?.());
    expect(notifyMock.success).toHaveBeenCalledWith('2 photos uploaded to LHR');
    expect(attachPatientImage).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      fileKey: 'uploads/IMG_1.jpg',
      fileName: 'IMG_1.jpg',
      album: 'lhr',
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['clinic', 'patients', 'images'],
    });
  });

  it('turns away a drop with no JPG or PNG in it', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePatientPhotoUpload(PATIENT_ID), { wrapper });
    act(() =>
      result.current.upload(
        [image('notes.pdf', 'application/pdf'), image('a.webp', 'image/webp')],
        'general',
      ),
    );
    expect(notifyMock.info).toHaveBeenCalledWith('Drop image files');
    expect(tray.pending).toHaveLength(0);
  });

  it('opens the picker for an album and uploads what it hands back there', async () => {
    const { wrapper } = makeWrapper();
    function Probe() {
      const upload = usePatientPhotoUpload(PATIENT_ID);
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
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png');
    fireEvent.change(input, { target: { files: [image('IMG_3.png', 'image/png')] } });
    await act(() => tray.pending[0]?.());
    await waitFor(() =>
      expect(notifyMock.success).toHaveBeenCalledWith('1 photo uploaded to LHR'),
    );
  });
});
