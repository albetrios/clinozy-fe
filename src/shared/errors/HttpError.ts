/**
 * Error thrown by the fetch-based HTTP client for non-2xx responses.
 * Used by reportError and mapApiError instead of axios.isAxiosError.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly url: string;
  public readonly method: string;
  /**
   * The response body. Not enumerable: an error reporter copies an error's own fields into
   * its event (Sentry's extraErrorData), and a body may echo what a person typed.
   */
  declare public readonly data: unknown;

  constructor(
    message: string,
    status: number,
    url: string,
    method: string,
    data?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.method = method;
    Object.defineProperty(this, 'data', { value: data, enumerable: false });
  }
}

/**
 * Type guard for HTTP errors (fetch client).
 */
export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

/**
 * Check if an error is a 401 (e.g. for skipping retry or triggering refresh).
 */
export function isUnauthorized(error: unknown): boolean {
  return isHttpError(error) && error.status === 401;
}

/**
 * Whether the server answered and refused (a 4xx): asking again the same way gets the same
 * answer, so the screen says why and keeps the draft, with no Retry. A dropped connection —
 * the fetch client's status 0 — and a 5xx are failures to try again, never a refusal.
 */
export function isClientRefusal(error: unknown): error is HttpError {
  return isHttpError(error) && error.status >= 400 && error.status < 500;
}

/**
 * Check if an error is a 404 — the record is unknown or deleted, so asking
 * again won't change it (no retry; "<Record> not found"). Anything else — a
 * dropped connection, a 5xx — is a failure to show, not a missing record.
 */
export function isNotFound(error: unknown): boolean {
  return isHttpError(error) && error.status === 404;
}
