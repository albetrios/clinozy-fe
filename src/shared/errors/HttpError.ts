/**
 * Error thrown by the fetch-based HTTP client for non-2xx responses.
 * Used by reportError and mapApiError instead of axios.isAxiosError.
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly url: string;
  public readonly method: string;
  public readonly data: unknown;

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
    this.data = data;
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
