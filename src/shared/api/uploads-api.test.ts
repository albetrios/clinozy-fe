import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));
vi.mock('@/core/http/fetch-client.ts', () => ({
  apiClient: { post: postMock },
}));

import { uploadFile } from './uploads-api.ts';

const PRESIGN = {
  id: 'upl_x',
  upload_url: 'https://storage.example.test/pending/organization-logos/org_a/abc.png',
  key: 'organization-logos/org_a/abc.png',
  upload_method: 'PUT' as const,
};

function logoFile(name = 'logo.png') {
  return new File(['bytes'], name, { type: 'image/png' });
}

/** How the fake storage host answers the next write. */
interface StorageReply {
  status?: number;
  /** Bytes reported through `upload` progress events, out of 100, before the answer. */
  progress?: number[];
  /** The connection drops instead of answering. */
  outcome?: 'error' | 'abort';
}

/** Every write the fake storage host received, oldest first. */
let storageWrites: FakeStorageRequest[] = [];
/** The answer the next write gets. */
let nextReply: StorageReply = {};

/**
 * Stands in for `XMLHttpRequest` — jsdom's real one would try the network. It records what the
 * client sent and answers on a later microtask, the way a browser does.
 */
class FakeStorageRequest {
  method = '';
  url = '';
  body: unknown = null;
  status = 0;
  withCredentials = false;
  readonly headers: Record<string, string> = {};
  readonly upload = new EventTarget();
  private readonly events = new EventTarget();

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  addEventListener(type: string, listener: EventListener) {
    this.events.addEventListener(type, listener);
  }

  send(body: unknown) {
    this.body = body;
    storageWrites.push(this);
    const reply = nextReply;
    queueMicrotask(() => {
      for (const loaded of reply.progress ?? []) {
        this.upload.dispatchEvent(
          new ProgressEvent('progress', { lengthComputable: true, loaded, total: 100 }),
        );
      }
      if (reply.outcome) {
        this.events.dispatchEvent(new Event(reply.outcome));
        return;
      }
      this.status = reply.status ?? 200;
      this.events.dispatchEvent(new Event('load'));
    });
  }
}

function storageWrite(): FakeStorageRequest {
  const [write] = storageWrites;
  if (!write) throw new Error('nothing was written to storage');
  return write;
}

function confirmsAs(status: string) {
  postMock
    .mockResolvedValueOnce({ data: PRESIGN })
    .mockResolvedValueOnce({ data: { id: 'upl_x', status } });
}

beforeEach(() => {
  vi.resetAllMocks();
  storageWrites = [];
  nextReply = {};
  vi.stubGlobal('XMLHttpRequest', FakeStorageRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadFile', () => {
  it('presigns, writes the bytes to storage, confirms, and returns the FINAL key', async () => {
    confirmsAs('UPLOADED');

    const result = await uploadFile({
      file: logoFile(),
      purpose: 'organization-logo',
      organizationId: 'org_a',
    });

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/uploads'),
      expect.objectContaining({
        purpose: 'organization-logo',
        for: 'organization',
        organization_id: 'org_a',
        content_type: 'image/png',
        file_name: 'logo.png',
      }),
    );
    expect(storageWrite()).toMatchObject({ method: 'PUT', url: PRESIGN.upload_url });
    expect(storageWrite().headers).toEqual({ 'Content-Type': 'image/png' });
    expect(postMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/uploads/upl_x/confirm'),
      {},
    );
    // The attach routes want the promoted key, never the `pending/` path the presigned URL
    // points at — handing them the latter is a 400.
    expect(result.key).toBe('organization-logos/org_a/abc.png');
    expect(result.key.startsWith('pending/')).toBe(false);
  });

  // The bearer token must never reach the storage origin — `apiClient` refuses to attach it
  // there, which is exactly why this one call is a raw request instead.
  it('sends no credential of ours to the storage origin', async () => {
    confirmsAs('UPLOADED');

    await uploadFile({
      file: logoFile(),
      purpose: 'organization-logo',
      organizationId: 'org_a',
    });

    const headerNames = Object.keys(storageWrite().headers).map((name) =>
      name.toLowerCase(),
    );
    expect(headerNames).not.toContain('authorization');
    expect(storageWrite().withCredentials).toBe(false);
  });

  it('throws when storage rejects the write, so nothing is attached', async () => {
    postMock.mockResolvedValueOnce({ data: PRESIGN });
    nextReply = { status: 403 };

    await expect(
      uploadFile({
        file: logoFile(),
        purpose: 'organization-logo',
        organizationId: 'org_a',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_STORAGE_REJECTED', statusCode: 403 });
    // Confirm is never reached.
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  // A write that never answers — the connection dropped, or the bucket's CORS refused this
  // origin (the page cannot tell them apart) — is the upload's own failure, said in words; it
  // used to surface as the raw English "Network request failed".
  it('rejects as unreachable when the write never answers', async () => {
    postMock.mockResolvedValueOnce({ data: PRESIGN });
    nextReply = { outcome: 'error' };

    await expect(
      uploadFile({
        file: logoFile(),
        purpose: 'organization-logo',
        organizationId: 'org_a',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_STORAGE_UNREACHABLE', statusCode: 0 });
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  // The PUT URL signs the server-side-encryption header; a PUT that leaves it out is refused
  // with SignatureDoesNotMatch, so the client sends exactly what the presign lists.
  it('sends the headers a PUT presign lists', async () => {
    postMock
      .mockResolvedValueOnce({
        data: {
          ...PRESIGN,
          headers: {
            'content-type': 'image/png',
            'x-amz-server-side-encryption': 'AES256',
          },
        },
      })
      .mockResolvedValueOnce({ data: { id: 'upl_x', status: 'UPLOADED' } });

    await uploadFile({
      file: logoFile(),
      purpose: 'organization-logo',
      organizationId: 'org_a',
    });

    expect(storageWrite().headers).toEqual({
      'content-type': 'image/png',
      'x-amz-server-side-encryption': 'AES256',
    });
    expect(storageWrite().withCredentials).toBe(false);
  });

  it('rejects as aborted when the write is cancelled', async () => {
    postMock.mockResolvedValueOnce({ data: PRESIGN });
    nextReply = { outcome: 'abort' };

    await expect(
      uploadFile({
        file: logoFile(),
        purpose: 'organization-logo',
        organizationId: 'org_a',
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('throws when confirm comes back as anything other than UPLOADED', async () => {
    confirmsAs('FAILED');

    await expect(
      uploadFile({
        file: logoFile(),
        purpose: 'organization-logo',
        organizationId: 'org_a',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_NOT_CONFIRMED' });
  });

  it('refuses a traversing file name before it reaches the API', async () => {
    await expect(
      uploadFile({
        file: logoFile('../../etc/passwd.png'),
        purpose: 'organization-logo',
        organizationId: 'org_a',
      }),
    ).rejects.toMatchObject({ code: 'UPLOAD_INVALID_FILE_NAME' });
    expect(postMock).not.toHaveBeenCalled();
  });

  // S3 browser POST uploads take the policy fields as a multipart form, and the file MUST be
  // appended last — anything after it is ignored by S3.
  it('submits a multipart form when the presign asks for POST', async () => {
    postMock
      .mockResolvedValueOnce({
        data: {
          ...PRESIGN,
          upload_method: 'POST',
          fields: {
            key: 'organization-logos/org_a/abc.png',
            policy: 'p',
            signature: 's',
          },
        },
      })
      .mockResolvedValueOnce({ data: { id: 'upl_x', status: 'UPLOADED' } });

    await uploadFile({
      file: logoFile(),
      purpose: 'organization-logo',
      organizationId: 'org_a',
    });

    expect(storageWrite().method).toBe('POST');
    // The browser writes the multipart boundary itself; a hand-set Content-Type would lose it.
    expect(storageWrite().headers).toEqual({});
    const form = storageWrite().body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('policy')).toBe('p');
    expect(form.get('signature')).toBe('s');
    expect([...form.keys()].at(-1)).toBe('file');
  });

  it('omits organization_id for a user-scoped upload', async () => {
    postMock
      .mockResolvedValueOnce({
        data: { ...PRESIGN, key: 'avatars/usr_a/abc.png' },
      })
      .mockResolvedValueOnce({ data: { id: 'upl_x', status: 'UPLOADED' } });

    await uploadFile({ file: logoFile(), purpose: 'avatar' });

    const [, body] = postMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(body.for).toBe('user');
    expect(body).not.toHaveProperty('organization_id');
  });

  // A clinic's photos, reports and bills belong to the organization, not to whoever uploaded
  // them — clinozy-be refuses `organization-file` with `for: user`.
  it('scopes an organization file to the organization', async () => {
    confirmsAs('UPLOADED');

    await uploadFile({
      file: new File(['%PDF'], 'report.pdf', { type: 'application/pdf' }),
      purpose: 'organization-file',
      organizationId: 'org_a',
    });

    expect(postMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/uploads'),
      expect.objectContaining({
        purpose: 'organization-file',
        for: 'organization',
        organization_id: 'org_a',
        content_type: 'application/pdf',
      }),
    );
  });

  it('reports the storage write’s progress as a fraction', async () => {
    confirmsAs('UPLOADED');
    nextReply = { progress: [25, 75, 100] };
    const onProgress = vi.fn();

    await uploadFile({
      file: logoFile(),
      purpose: 'organization-file',
      organizationId: 'org_a',
      onProgress,
    });

    expect(onProgress.mock.calls).toEqual([[0.25], [0.75], [1]]);
  });
});
