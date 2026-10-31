/**
 * Derive a CSP connect-src origin from VITE_API_BASE_URL.
 * Returns null for empty, invalid, or same-origin-relative URLs.
 */
export function getCspConnectSrcOrigin(apiBaseUrl: string | undefined): string | null {
  const trimmed = apiBaseUrl?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/** CSP connect-src fragment to inject after 'self' (leading newline + spaces optional). */
export function formatCspApiConnectSrcFragment(apiBaseUrl: string | undefined): string {
  const origin = getCspConnectSrcOrigin(apiBaseUrl);
  if (!origin) return '';
  return `\n               ${origin}`;
}

/** `index.html`'s meta-CSP placeholders, each replaced at build with the sources it names. */
export const CSP_META_PLACEHOLDERS = {
  apiConnectSrc: '<!-- CSP_API_CONNECT_SRC -->',
  sentryConnectSrc: '<!-- CSP_SENTRY_CONNECT_SRC -->',
  storedFileSrc: '<!-- CSP_STORED_FILE_SRC -->',
} as const;

/** Sources as a meta fragment: each on its own indented line, as `index.html` writes them. */
const metaFragment = (sources: readonly string[]) =>
  sources.map((source) => `\n               ${source}`).join('');

/**
 * `index.html` with its meta-CSP placeholders filled the way {@link buildContentSecurityPolicy}
 * fills the header for the same inputs — the plugin's `transformIndexHtml`, and what the
 * meta ↔ header parity test compares.
 */
export function fillCspMetaPlaceholders(
  html: string,
  apiBaseUrl: string | undefined,
  named: CspNamedOrigins = {},
): string {
  return html
    .replace(
      CSP_META_PLACEHOLDERS.apiConnectSrc,
      formatCspApiConnectSrcFragment(apiBaseUrl),
    )
    .replace(
      CSP_META_PLACEHOLDERS.sentryConnectSrc,
      metaFragment(cspSentrySources(named.sentryDsn)),
    )
    .replaceAll(
      CSP_META_PLACEHOLDERS.storedFileSrc,
      metaFragment(cspStoredFileSources(named.storedFilesOrigin)),
    );
}

/**
 * Third-party origins the app must reach (observability + analytics). Kept in
 * lock step with the connect-src list in index.html's meta CSP — the static
 * security test asserts they agree on shared directives.
 *
 * **`upgrade-insecure-requests`** is header-only (`buildContentSecurityPolicy` →
 * `dist/_headers`). It is omitted from the index.html meta fallback because
 * Safari/WebKit upgrades `http://localhost` subresources to HTTPS and breaks
 * local preview; Netlify always serves over HTTPS where the header applies.
 */
/**
 * Cloudflare Turnstile origin. The invisible captcha widget loads its script from here and
 * renders the challenge in a same-origin iframe, so this host is allowlisted in both
 * `script-src` and `frame-src`. Kept in lock step with the meta CSP in index.html.
 */
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

/** Stripe.js + Payment Element (script, frames, API calls). */
const STRIPE_ORIGINS = [
  'https://js.stripe.com',
  'https://hooks.stripe.com',
  'https://api.stripe.com',
  'https://m.stripe.com',
  'https://m.stripe.network',
] as const;

/**
 * PostHog serves its analytics API from us.i.posthog.com and its remote config from
 * us-assets (`/array/<key>/config`) — fetched, so this host is in `connect-src`. It is not in
 * `script-src`: the app sets `disable_external_dependency_loading` (`src/app/analytics/posthog.ts`),
 * so PostHog loads no script from its CDN — the `config.js` it would try first is refused before
 * any request and it reads the same config as JSON — and a CDN script host is one less origin able
 * to run code in the page.
 */
const POSTHOG_ASSETS_ORIGIN = 'https://us-assets.i.posthog.com';

/**
 * Where clinozy-be's stored files live: its S3 bucket, `<bucket>.s3[.<region>].amazonaws.com`.
 * The browser sends every upload's bytes there itself — the presigned POST or PUT (`connect-src`;
 * the API never sees them) — and reads them back from there — `file_url` on a patient photo or
 * report file (clinozy-be D86), the signed avatar and organization logo (`img-src`). A build names
 * the bucket exactly ({@link CspNamedOrigins.storedFilesOrigin}, `STORED_FILES_ORIGIN` —
 * required in production by `validate:client-env`, F-7); without it (local, an unconfigured
 * development deploy) the allowance falls back to AWS's host suffix (CSP3: `*.` matches any number
 * of labels), in those two directives only. A report file opens in its own tab, outside this
 * document's policy. An S3-compatible store on another host is named the same way.
 */
const STORED_FILE_FALLBACK = 'https://*.amazonaws.com';

/**
 * The third-party hosts a build names exactly instead of by wildcard (F-7), from its env.
 */
export interface CspNamedOrigins {
  /** `STORED_FILES_ORIGIN` — clinozy-be's file store; unset: any `https://*.amazonaws.com`. */
  storedFilesOrigin?: string;
  /** `VITE_SENTRY_DSN` — its host is the one Sentry ingest the app reports to; unset: none. */
  sentryDsn?: string;
}

/** The file store's sources for `connect-src` and `img-src`: the named origin, else the fallback. */
function cspStoredFileSources(storedFilesOrigin: string | undefined): string[] {
  return [getCspConnectSrcOrigin(storedFilesOrigin) ?? STORED_FILE_FALLBACK];
}

/**
 * Sentry's source for `connect-src`: the DSN's own host (`https://o1.ingest.sentry.io`), never
 * every `*.sentry.io` project; none without a DSN (Sentry is off). A `window.__CONFIG__`
 * `SENTRY_DSN` on another host is refused by this policy — name it in the build's env instead.
 */
function cspSentrySources(sentryDsn: string | undefined): string[] {
  const origin = getCspConnectSrcOrigin(sentryDsn);
  return origin ? [origin] : [];
}

const CONNECT_SRC_THIRD_PARTY = [
  'https://us.i.posthog.com',
  POSTHOG_ASSETS_ORIGIN,
  // Have I Been Pwned range API — k-anonymity password breach check on the
  // register/reset forms (only a hash prefix is ever sent). See
  // `lib/password-breach.ts`.
  'https://api.pwnedpasswords.com',
  ...STRIPE_ORIGINS,
] as const;

/**
 * The canonical Content-Security-Policy as a single-line header value.
 *
 * This is the authoritative, header-delivered policy (index.html's meta CSP is
 * a parse-time fallback). Header delivery applies before the document parses
 * and — unlike a meta tag — can carry reporting directives. `frame-ancestors`
 * is included here because it only works as a header.
 *
 * @param apiBaseUrl - VITE_API_BASE_URL; its origin is added to connect-src.
 * @param reportUri - optional CSP violation collector; adds report-uri + report-to.
 * @param named - the file store and Sentry ingest this build names ({@link CspNamedOrigins}).
 */
export function buildContentSecurityPolicy(
  apiBaseUrl: string | undefined,
  reportUri?: string,
  named: CspNamedOrigins = {},
): string {
  const apiOrigin = getCspConnectSrcOrigin(apiBaseUrl);
  const storedFiles = cspStoredFileSources(named.storedFilesOrigin);
  const connectSrc = [
    "'self'",
    ...(apiOrigin ? [apiOrigin] : []),
    ...cspSentrySources(named.sentryDsn),
    ...CONNECT_SRC_THIRD_PARTY,
    ...storedFiles,
  ];

  const directives = [
    "default-src 'self'",
    // Cloudflare Turnstile: the challenge script is loaded from challenges.cloudflare.com
    // and renders inside an iframe from the same origin (frame-src below).
    `script-src 'self' ${TURNSTILE_ORIGIN} ${STRIPE_ORIGINS[0]}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSrc.join(' ')}`,
    `img-src 'self' data: blob: ${storedFiles.join(' ')}`,
    "font-src 'self'",
    // Cloudflare Turnstile runs its challenge in a Web Worker created from a `blob:` URL.
    // With `worker-src 'self'` the browser blocks that worker and the challenge cannot
    // complete, so the widget renders "Verification failed" and never mints a token —
    // every captcha-gated auth request then 401s with `captchaRequired`. Sentry's session
    // replay worker is created the same way.
    "worker-src 'self' blob:",
    `frame-src ${TURNSTILE_ORIGIN} ${STRIPE_ORIGINS[0]} ${STRIPE_ORIGINS[1]}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ];

  if (reportUri) {
    directives.push(`report-uri ${reportUri}`, 'report-to csp');
  }

  return directives.join('; ');
}

/**
 * Trusted Types policy, shipped **report-only** as a staged rollout.
 *
 * `require-trusted-types-for 'script'` makes the browser flag any DOM script
 * sink (`innerHTML`, `eval`, …) that receives a plain string instead of a
 * Trusted Type — a structural DOM-XSS defense layered on top of
 * `script-src 'self'`. Delivered via a `Content-Security-Policy-Report-Only`
 * header (header-only — `http-equiv` can't carry report-only), so violations
 * are COLLECTED, not enforced: React 19 is Trusted-Types-aware, but Sentry /
 * PostHog may use sinks, so we observe first. `trusted-types` policy names are
 * intentionally unconstrained while reporting — that is what we are here to
 * discover.
 *
 * Promotion to the enforcing policy needs a collector FIRST. Without
 * `reportUri` this header carries no `report-uri`/`report-to`, so the browser
 * reports violations to the visitor's own DevTools console and nowhere else —
 * real-user violations are never aggregated, and "the stream is clean" cannot
 * be established. `validate:client-env` warns on a deploy that leaves
 * `VITE_CSP_REPORT_URI` unset for exactly this reason. Runbook:
 * `docs/deployment/runbooks/csp-trusted-types-production.md`.
 *
 * @param reportUri - optional collector; adds report-uri + report-to.
 */
export function buildTrustedTypesReportOnlyPolicy(reportUri?: string): string {
  const directives = ["require-trusted-types-for 'script'"];
  if (reportUri) {
    directives.push(`report-uri ${reportUri}`, 'report-to csp');
  }
  return directives.join('; ');
}
