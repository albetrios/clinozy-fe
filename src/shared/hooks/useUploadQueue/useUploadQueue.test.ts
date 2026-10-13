import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadFileMock, warningMock } = vi.hoisted(() => ({
  uploadFileMock: vi.fn(),
  warningMock: vi.fn(),
}));
vi.mock('@/shared/api/uploads-api.ts', () => ({
  UPLOAD_MAX_BYTES: { 'organization-file': 10 * 1024 * 1024 },
  uploadFile: uploadFileMock,
}));
vi.mock('@/shared/notify/index.ts', () => ({ notify: { warning: warningMock } }));

import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUploadQueueStore } from '@/shared/store/useUploadQueueStore/index.ts';

import { useUploadQueue } from './useUploadQueue.ts';

const LIMIT = 10 * 1024 * 1024;

function file(name: string, size: number) {
  const made = new File(['x'], name, { type: 'image/jpeg' });
  Object.defineProperty(made, 'size', { value: size });
  return made;
}

function queuedNames() {
  return useUploadQueueStore.getState().rows.map((row) => row.name);
}

beforeEach(() => {
  vi.resetAllMocks();
  useUploadQueueStore.getState().clear();
  useOrganizationStore.getState().setOrganization('org_a', 'acme', 'active');
  // Writes that never finish: these tests are about what gets queued.
  uploadFileMock.mockImplementation(() => new Promise(() => {}));
});

describe('useUploadQueue', () => {
  it('skips files over 10 MB with one toast, and queues the rest', () => {
    const { result } = renderHook(() => useUploadQueue());

    let outcome = { accepted: 0, skipped: 0 };
    act(() => {
      outcome = result.current.enqueue(
        [file('a.jpg', 2048), file('big.jpg', LIMIT + 1), file('huge.jpg', 3 * LIMIT)],
        { onUploaded: vi.fn() },
      );
    });

    expect(outcome).toEqual({ accepted: 1, skipped: 2 });
    expect(queuedNames()).toEqual(['a.jpg']);
    expect(warningMock).toHaveBeenCalledOnce();
    expect(warningMock).toHaveBeenCalledWith('2 files over 10 MB skipped', {
      id: 'upload-skipped',
    });
  });

  it('says "file", not "files", for one', () => {
    const { result } = renderHook(() => useUploadQueue());

    act(() => {
      result.current.enqueue([file('big.jpg', LIMIT + 1)], { onUploaded: vi.fn() });
    });

    expect(warningMock).toHaveBeenCalledWith('1 file over 10 MB skipped', {
      id: 'upload-skipped',
    });
    expect(queuedNames()).toEqual([]);
  });

  it('takes a file of exactly 10 MB, and raises no toast when nothing is skipped', () => {
    const { result } = renderHook(() => useUploadQueue());

    act(() => {
      result.current.enqueue([file('edge.jpg', LIMIT)], { onUploaded: vi.fn() });
    });

    expect(queuedNames()).toEqual(['edge.jpg']);
    expect(warningMock).not.toHaveBeenCalled();
  });

  it('uploads into the active organization and hands back the confirmed key', async () => {
    uploadFileMock.mockResolvedValue({ key: 'organization-files/org_a/a.jpg' });
    const onUploaded = vi.fn();
    const photo = file('a.jpg', 2048);
    const { result } = renderHook(() => useUploadQueue());

    await act(async () => {
      result.current.enqueue([photo], { onUploaded });
      for (let hop = 0; hop < 20; hop += 1) await Promise.resolve();
    });

    expect(uploadFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        file: photo,
        purpose: 'organization-file',
        organizationId: 'org_a',
      }),
    );
    expect(onUploaded).toHaveBeenCalledWith('organization-files/org_a/a.jpg', photo);
  });
});
