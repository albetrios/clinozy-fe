import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { HTTP } from '@/core/config/constants.ts';
import { platformConfig } from '@/core/config/env.ts';
import { isUnauthorized } from '@/core/http/fetch-client.ts';
import {
  apiErrorReason,
  notifyError,
  notifyQueryError,
  reportError,
} from '@/shared/errors/errorHandler.ts';
import {
  type HttpError,
  isClientRefusal,
  isHttpError,
} from '@/shared/errors/HttpError.ts';

/**
 * The `error.reason`s of a clinozy-be 403 that question the caller's access to the active
 * organization itself: a permission the member's role does not hold (any more), or no
 * membership at all. A step-up, an MFA policy or a read-only plan is not one.
 */
const ORGANIZATION_ACCESS_REFUSALS = new Set(['missing_permission', 'not_a_member']);

/** Whether clinozy-be refused this read or write for the caller's access to the organization. */
export function isOrganizationAccessRefusal(error: unknown): error is HttpError {
  return (
    isHttpError(error) &&
    error.status === 403 &&
    ORGANIZATION_ACCESS_REFUSALS.has(apiErrorReason(error) ?? '')
  );
}

type OrganizationAccessRefusedListener = (error: HttpError) => void;

let accessRefusedListener: OrganizationAccessRefusedListener | null = null;

/**
 * Hear every query or mutation clinozy-be refuses with an organization-access 403
 * ({@link isOrganizationAccessRefusal}) — the one listener, set by the tenancy layer, which
 * the kernel may not import (`shared/tenancy/organization-access.ts`).
 *
 * @returns A function that stops listening.
 */
export function onOrganizationAccessRefused(
  listener: OrganizationAccessRefusedListener,
): () => void {
  accessRefusedListener = listener;
  return () => {
    if (accessRefusedListener === listener) accessRefusedListener = null;
  };
}

/** Tell the listener, if the error is an organization-access refusal. Never throws. */
function noticeAccessRefusal(error: unknown): void {
  if (!isOrganizationAccessRefusal(error)) return;
  try {
    accessRefusedListener?.(error);
  } catch {
    /* the cache's own error handling must run regardless */
  }
}

/**
 * What Sentry hears of a query or mutation key: its leading words (`app,contacts`), never
 * what follows them — an organization, an id, a filter, or a typed search
 * (`contactQueryKeys.search` ends with what the person typed).
 */
export function keyHead(key: readonly unknown[] | undefined): string {
  const words: string[] = [];
  for (const part of key ?? []) {
    if (typeof part !== 'string' || !/^[a-z][a-z-]*$/.test(part)) break;
    words.push(part);
  }
  return words.join(',') || 'unknown';
}

/**
 * TanStack Query client.
 *
 * IMPORTANT: 401 refresh logic lives ONLY in the fetch client (fetch-client.ts).
 * The QueryCache/MutationCache onError callbacks handle non-auth errors
 * (logging, toasts, Sentry reporting) to avoid a race condition with the client.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: HTTP.STALE_TIME,
      retry: (failureCount, error) => {
        // Don't retry 401s — handled by fetch client
        if (isUnauthorized(error)) return false;
        // Nor any other 4xx: no access, not found, a filter the API refuses — asking
        // again gets the same answer (a 429 already waited once inside apiClient).
        if (isClientRefusal(error)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // A role downgraded or a membership ended since this screen loaded (E-3).
      noticeAccessRefusal(error);
      // Only handle non-auth errors here — fetch client owns 401s
      if (!isUnauthorized(error)) {
        if (platformConfig.debugLogging) {
          console.error(`[Query Error] ${query.queryKey.toString()}:`, error.message);
        }
        reportError(error, { queryKey: keyHead(query.queryKey) });
        // Queries that set meta.notifyOnError surface ONE toast (de-duped by
        // query hash) carrying a Retry that refetches this exact query. This is
        // the failure surface for anything that must not move the layout it
        // lives in — app chrome above all: the header keeps its switcher, the
        // banner keeps its shape, and the news arrives beside them (X-1).
        if (query.meta?.notifyOnError === true) {
          notifyQueryError(error, {
            id: `q:${query.queryHash}`,
            onRetry: () => {
              void queryClient.refetchQueries({ queryKey: query.queryKey });
            },
          });
        }
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      noticeAccessRefusal(error);
      if (!isUnauthorized(error)) {
        if (platformConfig.debugLogging) {
          const key = mutation.options.mutationKey?.toString() ?? 'unknown';
          console.error(`[Mutation Error] ${key}:`, error.message);
        }
        reportError(error, { mutationKey: keyHead(mutation.options.mutationKey) });
        // Opt-in: mutations that set meta.notifyOnError surface a toast (hooks
        // that already toast inline simply omit the flag — no double toast).
        if (mutation.options.meta?.notifyOnError === true) {
          notifyError(error);
        }
      }
    },
  }),
});
