import { API_ENDPOINTS, HTTP } from '@/core/config/constants.ts';
import { platformConfig } from '@/core/config/env.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { scrubSensitiveUrl } from '@/lib/telemetry-scrub.ts';
import {
  forceLogout,
  isRefreshUnanswered,
  refreshAccessToken,
} from '@/shared/auth/service.ts';
import { getAccessToken } from '@/shared/auth/token.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';

// ------------------------------------------------------------------
// Request ID
// ------------------------------------------------------------------
let requestCounter = 0;
function generateRequestId(): string {
  requestCounter = (requestCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `${Date.now().toString(36)}-${requestCounter.toString(36)}`;
}

// ------------------------------------------------------------------
// Config and client type
// ------------------------------------------------------------------
interface HttpClientConfig {
  baseURL: string;
  timeout: number;
  credentials: RequestCredentials;
}

const defaultConfig: HttpClientConfig = {
  baseURL: platformConfig.apiBaseUrl,
  timeout: HTTP.TIMEOUT,
  credentials: 'include',
};

// ------------------------------------------------------------------
// Response envelope — clinozy-be wraps every success as { data, meta }
// ------------------------------------------------------------------
/** Cursor-pagination block carried on list responses (inside `meta.pagination`). */
interface PaginationMeta {
  per_page: number;
  next: string | null;
  has_more: boolean;
  estimated_total?: number;
}
/** The `meta` object returned alongside every clinozy-be success response. */
export interface ResponseMeta {
  request_id?: string;
  pagination?: PaginationMeta;
}
/** What every apiClient method resolves to: the unwrapped payload + its meta. */
export interface HttpResponse<T> {
  data: T;
  meta?: ResponseMeta;
}

/**
 * clinozy-be envelopes every success body as `{ data, meta }`. Detect that shape
 * so we can unwrap to the payload; anything else passes through untouched
 * (defensive — e.g. a non-enveloped legacy or third-party response).
 */
function isEnvelope(value: unknown): value is { data: unknown; meta?: ResponseMeta } {
  return (
    typeof value === 'object' && value !== null && 'data' in value && 'meta' in value
  );
}

/**
 * The bearer token is a credential, so it must never leave the configured API
 * origin. Pin it: a request only carries `Authorization` when its resolved URL
 * targets the API origin. This stops a stray absolute URL — a future bug, a
 * server-supplied `next` cursor used verbatim, or a compromised dependency that
 * builds a URL — from exfiltrating the access token to a foreign host. (In dev
 * `apiBaseUrl` is empty → the API origin is the app's own origin.)
 */
export function isApiOriginUrl(resolvedUrl: string): boolean {
  const here =
    typeof globalThis.location === 'undefined' ? undefined : globalThis.location.origin;
  try {
    const target = new URL(resolvedUrl, here).origin;
    const apiBase = new URL(defaultConfig.baseURL || '/', here).origin;
    return target === apiBase;
  } catch {
    return false;
  }
}

// No X-Organization-ID header: the backend scopes organization context from the
// signed `org` claim in the access token (set via /auth/switch-to-organization),
// not from a header or URL segment. (The upload domain is the lone server-side
// reader of that header; the SPA never needs to send it.)
function buildHeaders(
  url: string,
  idempotencyKey?: string,
  customHeaders?: HeadersInit,
): Headers {
  const headers = new Headers(customHeaders);
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('X-Request-ID', generateRequestId());
  // The app's language, not the browser's: clinozy-be words its error `detail` and
  // validation messages in it (en and es; any other falls back to English).
  const language = i18n.language || i18n.resolvedLanguage;
  if (language && !headers.has('Accept-Language'))
    headers.set('Accept-Language', language);
  if (idempotencyKey) {
    // clinozy-be requires `X-Idempotency-Key` (min 16 chars) on its write routes.
    headers.set('X-Idempotency-Key', idempotencyKey);
  }

  const accessToken = getAccessToken();
  if (accessToken && isApiOriginUrl(url)) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return headers;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: defaultConfig.credentials,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseErrorResponse(
  response: Response,
  url: string,
  method: string,
): Promise<HttpError> {
  let data: unknown;
  const ct = response.headers.get('Content-Type');
  try {
    const text = await response.text();
    if (ct?.includes('application/json') && text) {
      data = JSON.parse(text) as unknown;
    } else {
      data = text;
    }
  } catch {
    data = undefined;
  }
  const message =
    (data as { message?: string } | undefined)?.message ??
    (response.statusText || `HTTP ${response.status}`);
  return new HttpError(message, response.status, url, method, data);
}

/** Idempotent methods: safe to retry on connection/5xx (no body or same body). */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

/**
 * Classify a thrown fetch error. Timeouts (the `fetchWithTimeout` deadline) are
 * deliberately distinguished from connection failures so they are NOT retried
 * into piled latency (audit 3.3). Anything else is non-retryable.
 */
function classifyFetchError(err: unknown): 'timeout' | 'connection' | 'other' {
  if ((err as Error)?.name === 'AbortError') return 'timeout';
  if (err instanceof TypeError) return 'connection';
  return 'other';
}

function exponentialDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30_000);
}

/**
 * Dev-only retry trace (kept out of the hot path to bound its complexity). The path only:
 * Sentry turns console warnings into breadcrumbs and logs, and the query holds a room's search.
 */
function logRetry(attempt: number, url: string, suffix = ''): void {
  if (platformConfig.debugLogging) {
    console.warn(
      `[HTTP] Retry attempt ${attempt + 1} for ${scrubSensitiveUrl(url)}${suffix}`,
    );
  }
}

/** `Retry-After` header (delta-seconds) → ms, when present and finite. */
function parseRetryAfterMs(response: Response): number | null {
  const header = response.headers.get('Retry-After');
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
}

/**
 * Backoff before retrying a 5xx or a dropped connection. A 5xx can say when to come back —
 * clinozy-be's 503s carry `Retry-After` (the overload guard and the pooled-connection deadline) — so
 * the wait is never shorter than that; a `Retry-After` beyond the cap surfaces the error instead.
 */
function backoffDelay(attempt: number, response?: Response): number | null {
  const retryAfter = response ? parseRetryAfterMs(response) : null;
  if (retryAfter === null) return exponentialDelay(attempt);
  return retryAfter <= HTTP.MAX_RETRY_AFTER_MS
    ? Math.max(exponentialDelay(attempt), retryAfter)
    : null;
}

/**
 * One unified retry budget for a logical request (audit 3.1–3.3): the delay (ms)
 * before the next attempt, or `null` to stop and surface the error. A single
 * `attempt` counter spans BOTH connection-error and bad-status retries, so the
 * total is always bounded by `MAX_RETRIES`.
 *
 * - **429** → honor `Retry-After` at most ONCE and only within the cap; never
 *   exponential-spam the limiter — otherwise surface to `RateLimitNotice` now.
 * - **timeouts / other errors** → never retried.
 * - **connection errors + 5xx** → exponential backoff, idempotent methods only; a 5xx
 *   `Retry-After` sets the floor of the wait (see {@link backoffDelay}).
 */
function nextRetryDelay(args: {
  method: string;
  attempt: number;
  status: number | null;
  errorKind: 'timeout' | 'connection' | 'other' | null;
  response?: Response;
}): number | null {
  const { method, attempt, status, errorKind, response } = args;
  if (attempt >= HTTP.MAX_RETRIES) return null;
  if (status === 429) {
    if (attempt >= 1 || !response) return null;
    const retryAfter = parseRetryAfterMs(response);
    return retryAfter !== null && retryAfter <= HTTP.MAX_RETRY_AFTER_MS
      ? retryAfter
      : null;
  }
  if (errorKind === 'timeout' || errorKind === 'other') return null;
  const retryable = errorKind === 'connection' || (status !== null && status >= 500);
  return retryable && IDEMPOTENT_METHODS.has(method)
    ? backoffDelay(attempt, response)
    : null;
}

function buildRequestUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const base = defaultConfig.baseURL.replace(/\/$/, '');
  const sep = path.startsWith('/') ? '' : '/';
  return `${base}${sep}${path}`;
}

/**
 * 401 handler: refresh once via the SHARED single-flight in shared/auth
 * (the only code path allowed to call /auth/refresh — see
 * `refreshAccessToken`'s remarks on rotation + reuse-detection), then replay
 * the original request. Concurrent 401s all await the same in-flight refresh.
 * A refresh the server refused means the session is gone: clear local auth and
 * bail. One that got no answer (offline, timed out, throttled, a server fault —
 * already retried once inside `refreshAccessToken`) says nothing about the
 * session: keep it, and fail this request as unreachable (status 0), so a slow
 * network never signs anyone out.
 */
async function doRefreshAndReplay<T>(
  replay: () => Promise<HttpResponse<T>>,
  request: { url: string; method: string },
): Promise<HttpResponse<T>> {
  try {
    await refreshAccessToken();
  } catch (refreshError) {
    if (isRefreshUnanswered(refreshError)) {
      throw new HttpError(
        (refreshError as Error).message,
        0,
        request.url,
        request.method,
        undefined,
      );
    }
    forceLogout();
    throw refreshError;
  }
  return replay();
}

/** Parse a 2xx body: empty → undefined; JSON → unwrap the clinozy-be envelope. */
async function parseJsonBody<T>(
  response: Response,
  url: string,
  method: string,
): Promise<HttpResponse<T>> {
  const text = await response.text();
  if (!text) {
    return { data: undefined as T };
  }
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!(contentType.includes('application/json') || contentType.includes('+json'))) {
    throw new HttpError(
      'Expected JSON response',
      response.status,
      url,
      method,
      text.slice(0, 200),
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(
      'Invalid JSON response',
      response.status,
      url,
      method,
      text.slice(0, 200),
    );
  }
  // clinozy-be wraps every success as { data, meta }: unwrap to the payload and
  // surface meta (request_id, pagination). Non-enveloped bodies pass through.
  if (isEnvelope(parsed)) {
    return { data: parsed.data as T, meta: parsed.meta };
  }
  return { data: parsed as T };
}

/**
 * How many times one request may be replayed because the token it carried was replaced while it
 * was in flight (a refresh, a workspace switch, another tab) — bounded, so a token that keeps
 * rotating can never loop.
 */
const MAX_ROTATION_REPLAYS = 3;

/**
 * How many refreshes one request may ask for. The second covers a replay retired by a rotation
 * elsewhere (another tab) while this tab's token stayed the same; a token rejected after that is a
 * dead session.
 */
const MAX_REFRESHES_PER_REQUEST = 2;

/** Where one request stands: its retry attempt, refreshes asked for, and rotation replays. */
interface AttemptState {
  readonly attempt: number;
  readonly refreshes: number;
  readonly rotationReplays: number;
}

const FIRST_ATTEMPT: AttemptState = { attempt: 0, refreshes: 0, rotationReplays: 0 };

/** Write methods carry an auto-generated X-Idempotency-Key (server de-dupes). */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Asked before a write leaves: a refusal `reason` keeps it here, thrown as a `403` whose
 * `error.reason` is that reason, as clinozy-be would refuse it; `null` sends it. The View-as
 * preview holds the clinic's writes this way (`startViewAsWriteHold`).
 */
export type WriteHold = (write: { method: string; path: string }) => string | null;

let writeHold: WriteHold | null = null;

/**
 * Set the one {@link WriteHold} (`null` clears it).
 *
 * @returns A function that clears it again (tests).
 */
export function setWriteHold(hold: WriteHold | null): () => void {
  writeHold = hold;
  return () => {
    if (writeHold === hold) writeHold = null;
  };
}

/**
 * Per-call options. `idempotencyKey` is the caller's key for ONE user action: pass the same key
 * when the user retries that action, so clinozy-be replays its first answer instead of acting twice
 * (a create that landed but lost its response is not made again). Omitted, the call mints its own.
 */
export interface RequestOptions {
  skip401?: boolean;
  idempotencyKey?: string;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<HttpResponse<T>> {
  const url = buildRequestUrl(path);
  const held = WRITE_METHODS.has(method) ? writeHold?.({ method, path }) : null;
  if (held) throw new HttpError(held, 403, url, method, { error: { reason: held } });
  const isRefreshUrl =
    path === API_ENDPOINTS.AUTH.REFRESH || url.endsWith(API_ENDPOINTS.AUTH.REFRESH);
  // One key per logical request (or the caller's per-action key): retries and the post-refresh
  // replay all send the SAME key, so the server can collapse duplicates.
  const idempotencyKey = WRITE_METHODS.has(method)
    ? (options?.idempotencyKey ?? crypto.randomUUID())
    : undefined;

  function fetchOnce(): Promise<Response> {
    const headers = buildHeaders(url, idempotencyKey);
    const init: RequestInit = {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    };
    return fetchWithTimeout(url, init, defaultConfig.timeout);
  }

  /** A dropped connection: retried on the shared budget, or surfaced as a status-0 HttpError. */
  async function retryOrThrowNetworkError(
    err: unknown,
    state: AttemptState,
  ): Promise<HttpResponse<T>> {
    const message = (err as Error)?.message;
    const errorKind = classifyFetchError(err);
    const delay = nextRetryDelay({
      method,
      attempt: state.attempt,
      status: null,
      errorKind,
    });
    if (delay === null) {
      throw new HttpError(message ?? 'Network error', 0, url, method, undefined);
    }
    await new Promise((r) => setTimeout(r, delay));
    logRetry(state.attempt, url, `: ${message ?? ''}`);
    return run({ ...state, attempt: state.attempt + 1 });
  }

  /**
   * A 401 is about the token the request carried. clinozy-be keeps one live access token per
   * session, so every refresh, workspace switch or other tab's refresh retires the token before it
   * — and a request can be rejected for a token replaced while it was in flight. Then it is replayed
   * with the current token and nothing rotates again (another rotation would retire tokens other
   * requests are carrying). Otherwise the token is refreshed and the request replayed, at most
   * {@link MAX_REFRESHES_PER_REQUEST} times: only a token still rejected after that, or a refresh
   * the server refuses, is a dead session.
   */
  async function handleUnauthorized(
    response: Response,
    sentToken: string | null,
    state: AttemptState,
  ): Promise<HttpResponse<T>> {
    const currentToken = getAccessToken();
    if (
      currentToken !== null &&
      currentToken !== sentToken &&
      state.rotationReplays < MAX_ROTATION_REPLAYS
    ) {
      return run({ ...state, attempt: 0, rotationReplays: state.rotationReplays + 1 });
    }
    if (state.refreshes >= MAX_REFRESHES_PER_REQUEST) {
      // A token refreshed and replayed twice is still rejected: the session is
      // genuinely dead (revoked / logout-all / expiry). Never refresh-loop — clear
      // local auth and surface the error.
      forceLogout();
      throw await parseErrorResponse(response, url, method);
    }
    return doRefreshAndReplay(
      () => run({ ...state, attempt: 0, refreshes: state.refreshes + 1 }),
      { url, method },
    );
  }

  // Single attempt budget shared by connection-error AND bad-status retries.
  const run = async (state: AttemptState = FIRST_ATTEMPT): Promise<HttpResponse<T>> => {
    // `buildHeaders` reads the same token synchronously when `fetchOnce` starts.
    const sentToken = getAccessToken();
    let response: Response;
    try {
      response = await fetchOnce();
    } catch (err) {
      return retryOrThrowNetworkError(err, state);
    }

    if (response.status === 401 && !options?.skip401 && !isRefreshUrl) {
      return handleUnauthorized(response, sentToken, state);
    }

    if (!response.ok) {
      const delay = nextRetryDelay({
        method,
        attempt: state.attempt,
        status: response.status,
        errorKind: null,
        response,
      });
      if (delay !== null) {
        await new Promise((r) => setTimeout(r, delay));
        logRetry(state.attempt, url, ` (${response.status})`);
        return run({ ...state, attempt: state.attempt + 1 });
      }
      throw await parseErrorResponse(response, url, method);
    }

    return parseJsonBody<T>(response, url, method);
  };

  return run();
}

// ------------------------------------------------------------------
// Public API (axios-like: .get().then(r => r.data))
// ------------------------------------------------------------------
export interface HttpClient {
  get: <T>(url: string, options?: RequestOptions) => Promise<HttpResponse<T>>;
  post: <T>(
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ) => Promise<HttpResponse<T>>;
  put: <T>(
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ) => Promise<HttpResponse<T>>;
  patch: <T>(
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ) => Promise<HttpResponse<T>>;
  delete: <T>(url: string, options?: RequestOptions) => Promise<HttpResponse<T>>;
}

function createHttpClient(_overrides?: Partial<HttpClientConfig>): HttpClient {
  return {
    get: <T>(path: string, options?: RequestOptions) =>
      request<T>('GET', path, undefined, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('POST', path, body, options),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('PUT', path, body, options),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
      request<T>('PATCH', path, body, options),
    delete: <T>(path: string, options?: RequestOptions) =>
      request<T>('DELETE', path, undefined, options),
  };
}

export const apiClient = createHttpClient();

export { isUnauthorized } from '@/shared/errors/HttpError.ts';
