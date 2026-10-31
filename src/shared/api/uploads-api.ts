import { z } from 'zod';

import { API_BASE_PATH } from '@/core/config/constants.ts';
import { apiClient } from '@/core/http/fetch-client.ts';
import { getAccessToken, organizationClaimOf } from '@/shared/auth/token.ts';
import { AppError } from '@/shared/errors/AppError.ts';
import { FRONTEND_ERROR_CODES } from '@/shared/errors/frontend-error-codes.ts';

const UPLOADS_API = `${API_BASE_PATH}/uploads`;

/** What clinozy-be accepts for an image upload; SVG is rejected server-side, so never offer it. */
export const UPLOAD_IMAGE_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/** One of the content types clinozy-be accepts for an image upload. */
export type UploadImageContentType = (typeof UPLOAD_IMAGE_CONTENT_TYPES)[number];

/**
 * Per-purpose size ceilings, mirroring clinozy-be's `upload.constants.ts`. An
 * `organization-file` is a clinic's own document — a patient photo, a report, a bill — and
 * its 10 MB is the one limit the clinic screens apply everywhere (KICKOFF Q-P5).
 */
export const UPLOAD_MAX_BYTES = {
  'organization-logo': 5 * 1024 * 1024,
  avatar: 2 * 1024 * 1024,
  'organization-file': 10 * 1024 * 1024,
} as const;

type UploadPurpose = keyof typeof UPLOAD_MAX_BYTES;

/** Who owns each purpose's object; clinozy-be refuses any other `{ purpose, for }` pair. */
const UPLOAD_PURPOSE_OWNER: Readonly<Record<UploadPurpose, 'organization' | 'user'>> = {
  'organization-logo': 'organization',
  avatar: 'user',
  'organization-file': 'organization',
};

const presignWire = z.object({
  id: z.string(),
  upload_url: z.string(),
  key: z.string(),
  upload_method: z.enum(['PUT', 'POST']),
  fields: z.record(z.string(), z.string()).optional(),
  /** A PUT's signed request headers (clinozy-be sends them beside `upload_method: 'PUT'`). */
  headers: z.record(z.string(), z.string()).optional(),
});

const confirmWire = z.object({
  id: z.string(),
  status: z.string(),
});

/** A file name clinozy-be will accept: no separators, no traversal, no control characters. */
function assertSafeFileName(fileName: string): void {
  // Character-code comparison rather than a regex: a control-character class in a literal is
  // both unreadable and flagged by `no-control-regex`, and this says the same thing plainly.
  const hasControlCharacter = [...fileName].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f;
  });
  if (/[\\/]|\.\./.test(fileName) || hasControlCharacter) {
    throw new AppError(
      FRONTEND_ERROR_CODES.UPLOAD_INVALID_FILE_NAME,
      400,
      FRONTEND_ERROR_CODES.UPLOAD_INVALID_FILE_NAME,
    );
  }
}

/**
 * Put a file in object storage and return the storage key the attach routes want.
 *
 * @remarks
 * - **Algorithm:** three calls, in this order. `POST /uploads` reserves a row and returns a
 *   presigned destination (`apiClient` mints the `X-Idempotency-Key` this route requires);
 *   the bytes go straight to storage; `POST /uploads/{id}/confirm` verifies them server-side
 *   (HEAD + magic bytes) and promotes `pending/<key>` to `<key>`. The returned `key` is the
 *   **final** one, which is what `PUT /tenancy/organization/logo` and `PUT /users/me/avatar`
 *   expect — never the `pending/` path the presigned URL points at.
 * - **Why a raw `XMLHttpRequest`:** step two must NOT go through `apiClient`. That client is
 *   JSON-only, and `isApiOriginUrl` deliberately refuses to attach the bearer token to a
 *   foreign origin — sending a credential to the storage host is exactly what that pin
 *   exists to prevent. This is the one call in the app that legitimately leaves the API
 *   origin, and it carries no credential of ours. It is an XHR rather than `fetch` because
 *   only XHR reports upload progress, which the upload tray shows as "<n>%".
 * - **Failure modes:** a refused presign (403 without `upload:manage` on the organization),
 *   a storage write that does not return 2xx (`UPLOAD_STORAGE_REJECTED`) or never answers
 *   (`UPLOAD_STORAGE_UNREACHABLE` — offline, or the bucket's CORS refusing this origin), or a
 *   confirm that comes back anything other than `UPLOADED` (`UPLOAD_NOT_CONFIRMED`) all throw,
 *   each said in words by `mapApiError`. Nothing is attached until confirm succeeds, so a
 *   failure leaves the existing logo/avatar in place.
 * - **Cancelling and switching (G-4):** `signal` cancels every step — the presign, the storage
 *   write (its XHR is aborted) and the confirm — and the call rejects with the signal's reason.
 *   An upload never confirms under another organization than the one it started under: when a
 *   workspace switch has moved the token's `org` claim by the time the bytes are stored, it
 *   stops with `WORKSPACE_SWITCHED` ("not saved because you switched clinic") instead.
 *
 * @param input - The file, its clinozy-be purpose (an organization-owned purpose also needs
 *   `organizationId`), an optional `onProgress` that receives the storage write's
 *   progress as a fraction from 0 to 1, and an optional `signal` that cancels it.
 */
export async function uploadFile(input: {
  file: File;
  purpose: UploadPurpose;
  organizationId?: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<{ key: string }> {
  assertSafeFileName(input.file.name);
  const { signal } = input;
  // The organization the upload is made in: the one the token it starts with names.
  const startedUnder = tokenOrganization();

  const presignRes = await apiClient.post<unknown>(
    UPLOADS_API,
    {
      purpose: input.purpose,
      for: UPLOAD_PURPOSE_OWNER[input.purpose],
      ...(input.organizationId ? { organization_id: input.organizationId } : {}),
      content_type: input.file.type,
      file_name: input.file.name,
      file_size: input.file.size,
    },
    { signal },
  );
  const presign = presignWire.parse(presignRes.data);

  await putBytes(presign, input.file, { onProgress: input.onProgress, signal });

  if (tokenOrganization() !== startedUnder) {
    throw new AppError(
      FRONTEND_ERROR_CODES.WORKSPACE_SWITCHED,
      409,
      FRONTEND_ERROR_CODES.WORKSPACE_SWITCHED,
    );
  }
  const confirmRes = await apiClient.post<unknown>(
    `${UPLOADS_API}/${encodeURIComponent(presign.id)}/confirm`,
    {},
    { signal },
  );
  const confirmed = confirmWire.parse(confirmRes.data);
  if (confirmed.status !== 'UPLOADED') {
    throw new AppError(
      FRONTEND_ERROR_CODES.UPLOAD_NOT_CONFIRMED,
      502,
      FRONTEND_ERROR_CODES.UPLOAD_NOT_CONFIRMED,
    );
  }

  return { key: presign.key };
}

/**
 * Write the bytes to the presigned destination.
 *
 * @remarks
 * A PUT carries exactly the headers clinozy-be signed into its URL (`headers` — the content
 * type and the server-side-encryption header; without the latter S3 answers
 * `SignatureDoesNotMatch`), falling back to the content type alone; a POST carries none. Either
 * way `withCredentials` stays off, so neither a token nor a cookie of ours reaches the storage
 * host. A write that never answers — the connection dropped, or the bucket's CORS refused this
 * origin, which the page cannot tell apart — rejects with `UPLOAD_STORAGE_UNREACHABLE`.
 * An `upload` progress listener makes the browser preflight a cross-origin POST, so it is
 * registered only when someone is listening. The caller's `signal` aborts the XHR, and the write
 * rejects with the signal's reason.
 */
function putBytes(
  presign: z.infer<typeof presignWire>,
  file: File,
  {
    onProgress,
    signal,
  }: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReasonOf(signal));
      return;
    }
    const request = new XMLHttpRequest();
    const abortRequest = () => request.abort();
    signal?.addEventListener('abort', abortRequest, { once: true });
    request.addEventListener('loadend', () =>
      signal?.removeEventListener('abort', abortRequest),
    );
    request.open(presign.upload_method, presign.upload_url);
    if (onProgress) {
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(event.loaded / event.total);
        }
      });
    }
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
        return;
      }
      reject(
        new AppError(
          FRONTEND_ERROR_CODES.UPLOAD_STORAGE_REJECTED,
          request.status,
          FRONTEND_ERROR_CODES.UPLOAD_STORAGE_REJECTED,
        ),
      );
    });
    request.addEventListener('error', () => {
      reject(
        new AppError(
          FRONTEND_ERROR_CODES.UPLOAD_STORAGE_UNREACHABLE,
          0,
          FRONTEND_ERROR_CODES.UPLOAD_STORAGE_UNREACHABLE,
        ),
      );
    });
    request.addEventListener('abort', () => {
      reject(
        signal?.aborted
          ? abortReasonOf(signal)
          : new DOMException('The upload was aborted', 'AbortError'),
      );
    });
    if (presign.upload_method === 'POST') {
      request.send(toMultipart(presign.fields ?? {}, file));
      return;
    }
    const headers = presign.headers ?? { 'Content-Type': file.type };
    for (const [name, value] of Object.entries(headers))
      request.setRequestHeader(name, value);
    request.send(file);
  });
}

/** The organization the current token names (its `org` claim); `null` without one. */
function tokenOrganization(): string | null {
  const token = getAccessToken();
  return token === null ? null : organizationClaimOf(token);
}

/** What a cancelled upload rejects with: the signal's reason, else an `AbortError`. */
function abortReasonOf(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The upload was aborted', 'AbortError');
}

/** The file must be appended last — S3 ignores any form field that follows it. */
function toMultipart(fields: Record<string, string>, file: File): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  form.append('file', file);
  return form;
}
