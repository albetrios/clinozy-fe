/**
 * Telemetry URL scrubbing — a URL that leaves for a third-party store (PostHog,
 * Sentry) keeps its path and loses everything after it. The query string is
 * where the app writes what a person typed or was sent: a room's search (`?q=` —
 * a patient's name, mobile or #ID), a create drawer's prefill (`?name=&phone=`,
 * `?medicines=`), a reset / verify / invite link's single-use `?token=`, Stripe's
 * `*_client_secret` on the billing return, and — URL-encoded inside a signed-out
 * deep link's `/login?redirect=` — all of them again. A list of sensitive param
 * names missed every param added after it (`q`, SEC-01), so nothing after the
 * path is kept: `$pathname` and `route_viewed`'s `route_id` still say where the
 * person was. Every outgoing event passes through here (Sentry `request.url`,
 * breadcrumbs, spans, extras and contexts; PostHog `properties`, `$set` and
 * `$set_once`).
 */

/** A URL(-ish) string: absolute (`https://…`) or root-relative (`/…`). */
const URL_LIKE = /^(?:[a-z][a-z\d+.-]*:\/\/|\/)/i;

/** Drop a URL's query string and fragment; a string that is not a URL comes back unchanged. */
export function scrubSensitiveUrl(url: string): string {
  if (!URL_LIKE.test(url)) return url;
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

/**
 * Scrub every URL-ish string in a JSON-ish value, in place — objects and arrays,
 * nested — the shape of PostHog `event.properties` / `$set` / `$set_once`, where
 * URLs hide in `$current_url`, `$session_entry_url`, `$referrer` and
 * `$initial_current_url`, and of Sentry breadcrumb `data`.
 */
export function scrubObjectUrls(record: Record<string, unknown> | unknown[]): void {
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      const scrubbed = scrubSensitiveUrl(value);
      // Reflect.set instead of record[key]: keys come from Object.entries
      // (never attacker-chosen paths), and this shape keeps the static
      // object-injection lint quiet without a disable.
      if (scrubbed !== value) Reflect.set(record, key, scrubbed);
    } else if (value && typeof value === 'object') {
      scrubObjectUrls(value as Record<string, unknown> | unknown[]);
    }
  }
}

/** Anything on a Sentry event that carries a `data` bag: breadcrumbs and spans. */
type ScrubbableData = { data?: Record<string, unknown> };

/**
 * Structural slice of a Sentry event (errors AND transactions both fit).
 * Structural on purpose: `lib/` must never statically import
 * `@sentry/react` — it is a deferred chunk kept off the first-paint path.
 */
type ScrubbableEvent = {
  request?: { url?: string };
  breadcrumbs?: ScrubbableData[];
  spans?: ScrubbableData[];
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
};

/**
 * Scrub URLs on a Sentry-shaped event, in place: `request.url` (the
 * httpClient integration sets it to the failed request's full URL, past
 * `dataCollection.urlQueryParams`), breadcrumb and span data
 * (long-animation-frame spans carry the page URL as `browser.script.invoker`),
 * the extras and every context — the trace's data, and the error's own fields
 * that extraErrorData copies under its name (`contexts.HttpError.url`, the
 * failed request's full URL).
 */
export function scrubEventUrls<E extends ScrubbableEvent>(event: E): E {
  if (event.request?.url) {
    event.request.url = scrubSensitiveUrl(event.request.url);
  }
  for (const carrier of [...(event.breadcrumbs ?? []), ...(event.spans ?? [])]) {
    if (carrier?.data) scrubObjectUrls(carrier.data);
  }
  if (event.extra) scrubObjectUrls(event.extra);
  if (event.contexts) scrubObjectUrls(event.contexts);
  return event;
}
