import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { uploadFileMock, notifyInfoMock } = vi.hoisted(() => ({
  uploadFileMock: vi.fn(),
  notifyInfoMock: vi.fn(),
}));
vi.mock('@/shared/api/uploads-api.ts', () => ({ uploadFile: uploadFileMock }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: { info: notifyInfoMock } }));

import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  UPLOAD_CONCURRENCY,
  UPLOAD_ROW_LEAVE_MS,
  uploadQueueSummary,
  useUploadQueueStore,
} from './useUploadQueueStore.ts';

/** One storage write the test resolves by hand. */
interface PendingUpload {
  file: File;
  organizationId: string | undefined;
  purpose: string;
  onProgress: (fraction: number) => void;
  succeed: (key: string) => void;
  fail: (error: unknown) => void;
}

let uploads: PendingUpload[] = [];

function upload(index: number): PendingUpload {
  const pending = uploads[index];
  if (!pending) throw new Error(`upload ${index} was never started`);
  return pending;
}

/** Let the promise chains behind a settled write run to their end. */
async function flush() {
  for (let hop = 0; hop < 20; hop += 1) await Promise.resolve();
}

function photo(name: string, size = 2048) {
  return new File([new Uint8Array(size)], name, { type: 'image/jpeg' });
}

function rows() {
  return useUploadQueueStore.getState().rows;
}

function row(name: string) {
  const found = rows().find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no row for ${name}`);
  return found;
}

beforeEach(() => {
  vi.resetAllMocks();
  useUploadQueueStore.getState().clear();
  uploads = [];
  uploadFileMock.mockImplementation(
    (input: Omit<PendingUpload, 'succeed' | 'fail'>) =>
      new Promise<{ key: string }>((resolve, reject) => {
        uploads.push({
          ...input,
          succeed: (key) => resolve({ key }),
          fail: reject,
        });
      }),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useUploadQueueStore', () => {
  it('moves at most three files at once; the rest wait their turn at 0%', async () => {
    const names = ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg'];
    useUploadQueueStore.getState().add(
      names.map((name) => photo(name)),
      { onUploaded: vi.fn() },
      'org_a',
    );

    expect(UPLOAD_CONCURRENCY).toBe(3);
    expect(uploadFileMock).toHaveBeenCalledTimes(3);
    expect(rows().map((candidate) => candidate.status)).toEqual([
      'uploading',
      'uploading',
      'uploading',
      'queued',
      'queued',
    ]);
    expect(row('d.jpg').progress).toBe(0);

    upload(1).succeed('organization-files/org_a/b.jpg');
    await flush();

    // A finished file frees its slot for the oldest waiting one, never more.
    expect(uploadFileMock).toHaveBeenCalledTimes(4);
    expect(row('d.jpg').status).toBe('uploading');
    expect(row('e.jpg').status).toBe('queued');
  });

  it('uploads into the organization as an organization file', () => {
    useUploadQueueStore
      .getState()
      .add([photo('a.jpg')], { onUploaded: vi.fn() }, 'org_a');

    expect(upload(0)).toMatchObject({
      purpose: 'organization-file',
      organizationId: 'org_a',
    });
    expect(upload(0).file.name).toBe('a.jpg');
  });

  it('shows the storage write’s progress, holding 100% back until the row is done', async () => {
    useUploadQueueStore
      .getState()
      .add([photo('a.jpg')], { onUploaded: vi.fn() }, 'org_a');

    upload(0).onProgress(0.426);
    expect(row('a.jpg').progress).toBe(42);
    upload(0).onProgress(1);
    expect(row('a.jpg').progress).toBe(99);

    upload(0).succeed('organization-files/org_a/a.jpg');
    await flush();
    expect(row('a.jpg')).toMatchObject({ status: 'done', progress: 100 });
  });

  it('hands the caller the CONFIRMED key and reads done only once the attach settles', async () => {
    let attached: () => void = () => {};
    const onUploaded = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          attached = resolve;
        }),
    );
    const file = photo('a.jpg');
    useUploadQueueStore.getState().add([file], { onUploaded }, 'org_a');

    upload(0).succeed('organization-files/org_a/a.jpg');
    await flush();

    expect(onUploaded).toHaveBeenCalledWith('organization-files/org_a/a.jpg', file);
    // A success that outruns the work is the bug (house rule 3): still attaching.
    expect(row('a.jpg').status).toBe('attaching');

    attached();
    await flush();
    expect(row('a.jpg').status).toBe('done');
  });

  it('fails a row whose upload fails, and Retry runs the upload again', async () => {
    const onUploaded = vi.fn();
    useUploadQueueStore.getState().add([photo('a.jpg')], { onUploaded }, 'org_a');

    upload(0).fail(new TypeError('Network request failed'));
    await flush();
    expect(row('a.jpg')).toMatchObject({ status: 'failed', failedStep: 'upload' });
    expect(onUploaded).not.toHaveBeenCalled();

    useUploadQueueStore.getState().retry(row('a.jpg').id);
    expect(row('a.jpg')).toMatchObject({ status: 'uploading', failedStep: null });
    upload(1).succeed('organization-files/org_a/a.jpg');
    await flush();

    expect(uploadFileMock).toHaveBeenCalledTimes(2);
    expect(onUploaded).toHaveBeenCalledOnce();
    expect(row('a.jpg').status).toBe('done');
  });

  // Rule 9: the bytes are stored; only the attach failed. A retry that uploaded them again
  // would leave a duplicate object behind for nothing.
  it('fails a row whose attach fails, and Retry re-attaches the same key without re-uploading', async () => {
    const onUploaded = vi
      .fn()
      .mockRejectedValueOnce(new Error('409'))
      .mockResolvedValueOnce(undefined);
    useUploadQueueStore.getState().add([photo('a.jpg')], { onUploaded }, 'org_a');

    upload(0).succeed('organization-files/org_a/a.jpg');
    await flush();
    expect(row('a.jpg')).toMatchObject({ status: 'failed', failedStep: 'attach' });

    useUploadQueueStore.getState().retry(row('a.jpg').id);
    await flush();

    expect(uploadFileMock).toHaveBeenCalledOnce();
    expect(onUploaded).toHaveBeenCalledTimes(2);
    expect(onUploaded).toHaveBeenLastCalledWith(
      'organization-files/org_a/a.jpg',
      expect.any(File),
    );
    expect(row('a.jpg').status).toBe('done');
  });

  it('treats a second Retry press as the same press (single-flight)', async () => {
    useUploadQueueStore
      .getState()
      .add([photo('a.jpg')], { onUploaded: vi.fn() }, 'org_a');
    upload(0).fail(new Error('boom'));
    await flush();

    const { id } = row('a.jpg');
    useUploadQueueStore.getState().retry(id);
    useUploadQueueStore.getState().retry(id);

    expect(uploadFileMock).toHaveBeenCalledTimes(2);
  });

  it('lets a finished row leave after 1,400ms, still counting it toward the batch', async () => {
    vi.useFakeTimers();
    useUploadQueueStore
      .getState()
      .add([photo('a.jpg'), photo('b.jpg')], { onUploaded: vi.fn() }, 'org_a');
    upload(0).succeed('organization-files/org_a/a.jpg');
    await flush();

    expect(uploadQueueSummary(useUploadQueueStore.getState())).toEqual({
      left: 1,
      total: 2,
      failed: 0,
    });

    vi.advanceTimersByTime(UPLOAD_ROW_LEAVE_MS - 1);
    expect(rows()).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(rows().map((candidate) => candidate.name)).toEqual(['b.jpg']);
    // "Uploading 1 of 2…", not "1 of 1": the batch keeps the row that left.
    expect(uploadQueueSummary(useUploadQueueStore.getState())).toEqual({
      left: 1,
      total: 2,
      failed: 0,
    });
  });

  it('closes the tray once the last row leaves, forgetting the batch and the collapse', async () => {
    vi.useFakeTimers();
    useUploadQueueStore
      .getState()
      .add([photo('a.jpg')], { onUploaded: vi.fn() }, 'org_a');
    useUploadQueueStore.getState().setCollapsed(true);
    upload(0).succeed('organization-files/org_a/a.jpg');
    await flush();

    vi.advanceTimersByTime(UPLOAD_ROW_LEAVE_MS);

    expect(useUploadQueueStore.getState()).toMatchObject({
      rows: [],
      departed: 0,
      collapsed: false,
    });
  });

  it('removes only failed rows on dismiss, and the batch total shrinks with them', async () => {
    useUploadQueueStore
      .getState()
      .add([photo('a.jpg'), photo('b.jpg')], { onUploaded: vi.fn() }, 'org_a');
    upload(0).fail(new Error('boom'));
    await flush();

    // A moving row cannot be dropped.
    useUploadQueueStore.getState().dismiss(row('b.jpg').id);
    expect(rows()).toHaveLength(2);

    useUploadQueueStore.getState().dismiss(row('a.jpg').id);
    expect(rows().map((candidate) => candidate.name)).toEqual(['b.jpg']);
    expect(uploadQueueSummary(useUploadQueueStore.getState())).toEqual({
      left: 1,
      total: 1,
      failed: 0,
    });
  });

  it('counts failures apart from the files still to go', async () => {
    useUploadQueueStore
      .getState()
      .add([photo('a.jpg'), photo('b.jpg')], { onUploaded: vi.fn() }, 'org_a');
    upload(0).fail(new Error('boom'));
    await flush();

    expect(uploadQueueSummary(useUploadQueueStore.getState())).toEqual({
      left: 1,
      total: 2,
      failed: 1,
    });
  });

  it('hands nothing over for a row cleared while its bytes were moving', async () => {
    const onUploaded = vi.fn();
    useUploadQueueStore.getState().add([photo('a.jpg')], { onUploaded }, 'org_a');

    useUploadQueueStore.getState().clear();
    upload(0).succeed('organization-files/org_a/a.jpg');
    await flush();

    expect(onUploaded).not.toHaveBeenCalled();
    expect(rows()).toEqual([]);
  });

  it('ignores an empty hand-off', () => {
    useUploadQueueStore.getState().add([], { onUploaded: vi.fn() }, 'org_a');
    expect(rows()).toEqual([]);
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it('drops the workspace being left on a switch, never attaching its files, and says so', async () => {
    useOrganizationStore.setState({ organizationId: 'org_a' });
    const onUploaded = vi.fn();
    useUploadQueueStore.getState().add([photo('scalp.jpg')], { onUploaded }, 'org_a');
    expect(row('scalp.jpg').status).toBe('uploading');

    useOrganizationStore.setState({ organizationId: 'org_b' });
    expect(rows()).toEqual([]);
    expect(notifyInfoMock).toHaveBeenCalledWith(
      'Uploads stopped · you switched workspace',
    );

    // The bytes still land, but nothing is handed over under the new workspace.
    upload(0).succeed('k1');
    await flush();
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('keeps the uploads of the workspace switched to, and stays quiet for finished rows', async () => {
    useOrganizationStore.setState({ organizationId: 'org_a' });
    useUploadQueueStore
      .getState()
      .add([photo('a.jpg')], { onUploaded: vi.fn() }, 'org_a');
    upload(0).succeed('k1');
    await flush();
    expect(row('a.jpg').status).toBe('done');
    useUploadQueueStore
      .getState()
      .add([photo('b.jpg')], { onUploaded: vi.fn() }, 'org_b');

    useOrganizationStore.setState({ organizationId: 'org_b' });
    expect(rows().map((kept) => kept.name)).toEqual(['b.jpg']);
    expect(notifyInfoMock).not.toHaveBeenCalled();
  });
});
