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
 * breadcrumbs, spans, extras and contexts; a Session Replay segment's `urls` and
 * its recording's breadcrumbs and spans; PostHog `properties`, `$set` and
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

/** Structural slice of a Sentry Session Replay event: the pages one segment visited. */
type ScrubbableReplayEvent = ScrubbableEvent & { type?: string; urls?: string[] };

/**
 * Scrub a Session Replay event (`type: 'replay_event'`), in place: `urls` — every page the
 * segment visited, a room's search `?q=` among them — and `request.url`, which the browser SDK
 * stamps on every event from `location.href`. Replay events skip `beforeSend`, so this runs as an
 * event processor; any other event comes back untouched (`beforeSend` scrubs those).
 */
export function scrubReplayEventUrls<E extends ScrubbableReplayEvent>(event: E): E {
  if (event.type !== 'replay_event') return event;
  event.urls?.forEach((url, index, urls) => {
    urls[index] = scrubSensitiveUrl(url);
  });
  return scrubEventUrls(event);
}

/**
 * The fields of a Session Replay recording event that carry a URL: a navigation breadcrumb's
 * `from`/`to`, a slow- or multi-click breadcrumb's `url`, a span's `description` (the page or
 * request URL) and a link's `href` / an element's `src`.
 */
const RECORDING_URL_KEYS: ReadonlySet<string> = new Set([
  'href',
  'src',
  'url',
  'to',
  'from',
  'description',
]);

/**
 * Scrub the URLs in one Session Replay recording event, in place — its `beforeAddRecordingEvent`
 * (the SDK hands it the breadcrumb and span events). Only the {@link RECORDING_URL_KEYS} fields
 * are rewritten, so recorded text and styles are left as they are.
 */
export function scrubRecordingEventUrls<E extends object>(event: E): E {
  const pending: object[] = [event];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    pending.push(...scrubRecordingFields(next));
  }
  return event;
}

/** Scrub one object's URL fields in place; returns its nested objects, still to visit. */
function scrubRecordingFields(record: object): object[] {
  const nested: object[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (value && typeof value === 'object') nested.push(value);
    else if (typeof value === 'string' && RECORDING_URL_KEYS.has(key)) {
      const scrubbed = scrubSensitiveUrl(value);
      if (scrubbed !== value) Reflect.set(record, key, scrubbed);
    }
  }
  return nested;
}
