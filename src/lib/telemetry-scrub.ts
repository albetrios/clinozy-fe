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
 *
 * The second leak is the clicked element. Sentry names it by a CSS-like path (its
 * `htmlTreeAsString`) that appends the element's `aria-label`, `title`, `alt` and `name` — and
 * those carry what the screen shows: a patient rail labelled with the patient's name, a chip's
 * "Remove <diagnosis>", a contact pick titled with the contact's name. That path is the message
 * of every `ui.*` breadcrumb (the SDK's and Session Replay's), the description of every
 * `ui.interaction` / `ui.webvital` span and the value of their selector attributes
 * (`browser.web_vital.inp.target`, `lcp.element`, `cls.source.<n>`), so each of those keeps the
 * attribute's name and loses its value ({@link scrubElementSelector}).
 */

/** What a removed value is replaced with — the placeholder Sentry's own scrubbing uses. */
const FILTERED = '[Filtered]';

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
  scrubObjectStrings(record, scrubSensitiveUrl);
}

/** Rewrite every string in a JSON-ish value with `scrub`, in place — objects and arrays, nested. */
function scrubObjectStrings(
  record: Record<string, unknown> | unknown[],
  scrub: (value: string) => string,
): void {
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === 'string') {
      const scrubbed = scrub(value);
      // Reflect.set instead of record[key]: keys come from Object.entries
      // (never attacker-chosen paths), and this shape keeps the static
      // object-injection lint quiet without a disable.
      if (scrubbed !== value) Reflect.set(record, key, scrubbed);
    } else if (value && typeof value === 'object') {
      scrubObjectStrings(value as Record<string, unknown> | unknown[], scrub);
    }
  }
}

/**
 * The element attributes whose values are words the screen shows. Sentry's `htmlTreeAsString`
 * appends `aria-label`, `type`, `name`, `title` and `alt` after an element's tag, id and classes;
 * `type` (`button`, `submit`) is the one that never carries what a person reads.
 */
const ELEMENT_TEXT_ATTRIBUTES: readonly string[] = ['aria-label', 'name', 'title', 'alt'];

/**
 * One `[attribute="value"]` of an {@link ELEMENT_TEXT_ATTRIBUTES} attribute in a Sentry element
 * path. The SDK does not escape the value, so it ends at the first `"]` followed by what can
 * follow it — the next appended attribute (`type`, `name`, `title`, `alt`, in that order), the
 * ` > ` before the child element, or the end — and a value cut off without its `"]` runs to the
 * end. Lazy, one quantifier, anchored on a literal: linear in the path's length.
 */
const ELEMENT_TEXT_SELECTOR =
  /\[(aria-label|name|title|alt)="[\s\S]*?(?:"\](?=\[(?:type|name|title|alt)="|\s>\s|$)|$)/g;

/**
 * Strip the values of the {@link ELEMENT_TEXT_ATTRIBUTES} from a Sentry element path, keeping
 * each attribute's name: `aside.bg-card[aria-label="Priya Sharma"]` →
 * `aside.bg-card[aria-label="[Filtered]"]`. A string with no such attribute comes back unchanged.
 */
export function scrubElementSelector(selector: string): string {
  return selector.replace(ELEMENT_TEXT_SELECTOR, `[$1="${FILTERED}"]`);
}

/** Structural slice of a Sentry breadcrumb — the SDK's, or one Session Replay records. */
type ScrubbableBreadcrumb = {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
};

/**
 * Scrub one `ui.*` breadcrumb, in place: a `ui.input`'s message is `[Filtered]` outright; any
 * other's message (`ui.click`, `ui.keyDown`, Replay's `ui.slowClickDetected` / `ui.multiClick`)
 * loses its element-text values ({@link scrubElementSelector}), and the attributes Session Replay
 * copies beside it (`data.node.attributes`) lose those same values. Every other breadcrumb comes
 * back untouched. Sentry's `beforeBreadcrumb`, and the error and transaction events' breadcrumbs.
 */
export function scrubUiBreadcrumb<B extends ScrubbableBreadcrumb>(breadcrumb: B): B {
  if (!breadcrumb.category?.startsWith('ui.')) return breadcrumb;
  if (typeof breadcrumb.message === 'string') {
    breadcrumb.message =
      breadcrumb.category === 'ui.input'
        ? FILTERED
        : scrubElementSelector(breadcrumb.message);
  }
  const node = breadcrumb.data?.node;
  const attributes =
    node && typeof node === 'object' ? Reflect.get(node, 'attributes') : null;
  if (attributes && typeof attributes === 'object') {
    for (const name of ELEMENT_TEXT_ATTRIBUTES) {
      if (typeof Reflect.get(attributes, name) === 'string')
        Reflect.set(attributes, name, FILTERED);
    }
  }
  return breadcrumb;
}

/** Structural slice of a Sentry span — a transaction's child, its root, or a standalone span. */
type ScrubbableSpan = {
  op?: string;
  description?: string;
  data?: Record<string, unknown>;
};

/**
 * Scrub the element paths on one span, in place: a `ui.*` span's description (an interaction's or
 * a web vital's target) and every element path in its data. Sentry's static `beforeSendSpan`,
 * which INP's standalone `ui.interaction` spans reach instead of `beforeSendTransaction`.
 */
export function scrubSpanElementText<S extends ScrubbableSpan>(span: S): S {
  if (span.op?.startsWith('ui.') && typeof span.description === 'string') {
    span.description = scrubElementSelector(span.description);
  }
  if (span.data) scrubObjectStrings(span.data, scrubElementSelector);
  return span;
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

/** Structural slice of a Sentry event for {@link scrubEventElementText}: errors and transactions. */
type ElementTextEvent = {
  breadcrumbs?: ScrubbableBreadcrumb[];
  spans?: ScrubbableSpan[];
  contexts?: Record<string, unknown>;
};

/**
 * Scrub the clicked and measured elements on a Sentry-shaped event, in place: every `ui.*`
 * breadcrumb ({@link scrubUiBreadcrumb}), every span and the transaction's root span
 * (`contexts.trace` — a pageload's `lcp.element` and `cls.source.<n>`) via
 * {@link scrubSpanElementText}. `beforeSend` and `beforeSendTransaction`, beside
 * {@link scrubEventUrls}.
 */
export function scrubEventElementText<E extends ElementTextEvent>(event: E): E {
  event.breadcrumbs?.forEach(scrubUiBreadcrumb);
  event.spans?.forEach(scrubSpanElementText);
  const trace = event.contexts?.trace;
  if (trace && typeof trace === 'object') scrubSpanElementText(trace as ScrubbableSpan);
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
 * Scrub one Session Replay recording event, in place — its `beforeAddRecordingEvent` (the SDK
 * hands it the breadcrumb and span events): the query leaves every {@link RECORDING_URL_KEYS}
 * field, and a recorded `ui.*` breadcrumb — a click's element path and the attributes Replay
 * copies beside it — loses its element text ({@link scrubUiBreadcrumb}). Nothing else is
 * rewritten, so recorded text and styles are left as they are.
 */
export function scrubRecordingEvent<E extends object>(event: E): E {
  const pending: object[] = [event];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    pending.push(...scrubRecordingFields(next));
  }
  return event;
}

/** Scrub one object's URL fields and, on a `ui.*` breadcrumb, its element text in place; returns its nested objects, still to visit. */
function scrubRecordingFields(record: object): object[] {
  if (typeof Reflect.get(record, 'category') === 'string') {
    scrubUiBreadcrumb(record as ScrubbableBreadcrumb);
  }
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

/**
 * PostHog event properties that carry what a screen showed or where a pointer went: an element's
 * text and chain (autocapture, dead and rage clicks) and heatmap coordinates. Every capture that
 * writes them is pinned off at init; this drops them should one ever be switched back on.
 */
const POSTHOG_SCREEN_KEYS: readonly string[] = [
  '$el_text',
  '$elements',
  '$elements_chain',
  '$heatmap_data',
];

/** PostHog events that exist only to report the screen (see {@link POSTHOG_SCREEN_KEYS}). */
const POSTHOG_SCREEN_EVENTS: ReadonlySet<string> = new Set([
  '$autocapture',
  '$rageclick',
  '$dead_click',
  '$$heatmap',
  '$exception',
]);

/** Structural slice of a posthog-js `CaptureResult`: lib/ never imports posthog-js. */
type ScrubbablePostHogEvent = {
  event?: string;
  properties?: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
};

/**
 * PostHog's `before_send`: drop a screen-reporting event outright, then strip element text and
 * heatmap data from the properties and the query from every URL in `properties`, `$set` and
 * `$set_once` (posthog-js carries person properties — `$initial_current_url` — beside
 * `properties`, not inside it). `null` passes through.
 */
export function scrubPostHogEvent<E extends ScrubbablePostHogEvent>(
  event: E | null,
): E | null {
  if (!event) return event;
  if (event.event !== undefined && POSTHOG_SCREEN_EVENTS.has(event.event)) return null;
  for (const key of POSTHOG_SCREEN_KEYS)
    Reflect.deleteProperty(event.properties ?? {}, key);
  for (const bag of [event.properties, event.$set, event.$set_once]) {
    if (bag) scrubObjectUrls(bag);
  }
  return event;
}
