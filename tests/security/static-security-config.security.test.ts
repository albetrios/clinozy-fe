/**
 * Security tripwires over committed static configuration. These read files as
 * text on purpose (vite `?raw` imports): importing vite.config.ts normally
 * would execute plugin factories, and the point is to fail loudly if a
 * security-relevant line is edited away.
 */
import { describe, expect, it } from 'vitest';

import {
  buildContentSecurityPolicy,
  CSP_META_PLACEHOLDERS,
  type CspNamedOrigins,
  fillCspMetaPlaceholders,
} from '@/lib/csp-api-origin.ts';

import indexHtml from '../../index.html?raw';
import netlifyToml from '../../netlify.toml?raw';
import pkg from '../../package.json';
import pnpmWorkspace from '../../pnpm-workspace.yaml?raw';
import headers from '../../public/_headers?raw';
import offlineHtml from '../../public/offline.html?raw';
import viteConfig from '../../vite.config.ts?raw';

/** Lowest version a semver range like `^7.3.6` / `>=3.4.7` can resolve to. */
function rangeFloor(range: string): [number, number, number] {
  // Single-token /\d+/g scan — linear, unlike a chained \d+\.\d+\.\d+ pattern.
  const parts = range.match(/\d+/g);
  if (!parts || parts.length < 3) throw new Error(`unparseable version range: ${range}`);
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

/**
 * The flat `overrides:` map in pnpm-workspace.yaml — pnpm 11+ reads overrides only
 * there. Entries are `  name: 'range'` lines (keys starting with `@` are quoted).
 */
const OVERRIDES: ReadonlyMap<string, string> = (() => {
  const block = pnpmWorkspace.split(/^overrides:$/m)[1]?.split(/^\S/m)[0] ?? '';
  const unquote = (text: string): string => text.trim().replace(/^'(.*)'$/, '$1');
  return new Map(
    block
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf(': ');
        return [
          unquote(line.slice(0, separator)),
          unquote(line.slice(separator + 2)),
        ] as const;
      }),
  );
})();

function override(name: string): string {
  const range = OVERRIDES.get(name);
  if (range === undefined)
    throw new Error(`pnpm-workspace.yaml has no override for ${name}`);
  return range;
}

function atLeast(range: string, min: [number, number, number]): boolean {
  const [a, b, c] = rangeFloor(range);
  const [x, y, z] = min;
  if (a !== x) return a > x;
  if (b !== y) return b > y;
  return c >= z;
}

describe('security response headers (public/_headers)', () => {
  it.each([
    ['X-Frame-Options', /X-Frame-Options:\s*DENY/],
    // frame-ancestors only works as an HTTP header — browsers ignore it in
    // meta CSPs, so it MUST live here and not (only) in index.html.
    [
      'Content-Security-Policy frame-ancestors',
      /Content-Security-Policy:\s*frame-ancestors 'none'/,
    ],
    ['X-Content-Type-Options', /X-Content-Type-Options:\s*nosniff/],
    ['Referrer-Policy', /Referrer-Policy:\s*strict-origin-when-cross-origin/],
    ['Strict-Transport-Security', /Strict-Transport-Security:\s*max-age=\d+/],
    ['Permissions-Policy', /Permissions-Policy:\s*camera=\(\)/],
    // COOP isolates the top-level window (origin isolation). Value is
    // same-origin-allow-popups — not the stricter same-origin — so Stripe
    // 3-D Secure popups and any window.opener flow keep working.
    [
      'Cross-Origin-Opener-Policy',
      /Cross-Origin-Opener-Policy:\s*same-origin-allow-popups/,
    ],
    // Sentry's browserProfilingIntegration is inert without this header: the
    // browser refuses to start the JS self-profiler and logs a document-policy
    // violation on every page load, so every profile is silently dropped. It
    // has to reach the DOCUMENT, and Netlify matches header rules against the
    // REQUEST path — under the SPA rewrite `/dashboard` never matches an
    // `/index.html` rule — so it belongs on `/*` and nowhere narrower.
    ['Document-Policy', /Document-Policy:\s*js-profiling/],
  ])('serves %s on every route', (_name, pattern) => {
    expect(headers).toMatch(pattern);
  });

  // "Report a bug" dictates with the browser's own speech recognition (iteration
  // feat-bug-report-2026-10-13-dgnx): the microphone is allowed for this origin only — never for an
  // embedded frame — and the rest stay off.
  it('allows the microphone to this origin alone, and nothing else the policy names', () => {
    for (const config of [headers, netlifyToml]) {
      expect(config).toMatch(/microphone=\(self\)/);
      expect(config).toMatch(/camera=\(\)/);
      expect(config).toMatch(/geolocation=\(\)/);
      expect(config).not.toMatch(/microphone=\*/);
    }
  });

  it('never caches index.html (new-deployment detection depends on it)', () => {
    expect(headers).toMatch(/\/index\.html\n\s+Cache-Control:\s*no-store/);
  });

  it('never caches version.json (the poll target for reload-on-deploy)', () => {
    expect(headers).toMatch(/\/version\.json\n\s+Cache-Control:\s*no-store/);
  });
});

describe('content security policy (index.html meta)', () => {
  it('ships a CSP meta tag', () => {
    expect(indexHtml).toMatch(/http-equiv="Content-Security-Policy"/);
  });

  it.each([
    ["default-src 'self'", /default-src 'self'/],
    [
      "script-src 'self' + Turnstile + Stripe (no unsafe-inline/eval)",
      /script-src 'self' https:\/\/challenges\.cloudflare\.com https:\/\/js\.stripe\.com/,
    ],
    ["object-src 'none'", /object-src 'none'/],
    ["base-uri 'self'", /base-uri 'self'/],
    ["form-action 'self'", /form-action 'self'/],
    [
      'connect-src API origin placeholder (injected at build)',
      /<!-- CSP_API_CONNECT_SRC -->/,
    ],
    [
      'connect-src Sentry ingest placeholder (the DSN host, injected at build — F-7)',
      /connect-src[^;]*<!-- CSP_SENTRY_CONNECT_SRC -->/,
    ],
    [
      'connect-src file-store placeholder (STORED_FILES_ORIGIN, injected at build — F-7)',
      /connect-src[^;]*<!-- CSP_STORED_FILE_SRC -->;/,
    ],
    [
      'img-src file-store placeholder (STORED_FILES_ORIGIN, injected at build — F-7)',
      /img-src 'self' data: blob:<!-- CSP_STORED_FILE_SRC -->;/,
    ],
  ])('keeps %s', (_name, pattern) => {
    expect(indexHtml).toMatch(pattern);
  });

  it('never weakens meta script-src with unsafe-inline or unsafe-eval', () => {
    const match = indexHtml.match(
      /http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]*)"/,
    );
    expect(match?.[1]).toBeDefined();
    expect(match?.[1]).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/);
  });

  it('runs no script from PostHog’s CDN in the meta CSP either — the header’s script-src exactly', () => {
    const meta = indexHtml.match(
      /http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]*)"/,
    );
    const metaScript = /script-src ([^;]*);/.exec(meta?.[1] ?? '')?.[1]?.trim();
    const headerScript = /script-src ([^;]*)/.exec(
      buildContentSecurityPolicy(undefined),
    )?.[1];
    expect(metaScript).toBe(headerScript);
    expect(metaScript).not.toMatch(/posthog/);
  });

  it('does NOT carry a frame-ancestors directive in the meta CSP (header-only directive — it lives in public/_headers)', () => {
    expect(indexHtml).not.toMatch(/frame-ancestors\s+'/);
  });

  it('does NOT carry upgrade-insecure-requests in the meta CSP (header-only — breaks Safari on http://localhost preview)', () => {
    const match = indexHtml.match(
      /http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]*)"/,
    );
    expect(match?.[1]).toBeDefined();
    expect(match?.[1]).not.toMatch(/upgrade-insecure-requests/);
  });
});

/**
 * Directive-level parity between the meta CSP in `index.html` and the canonical
 * header policy from `buildContentSecurityPolicy()`.
 *
 * Only the API origin is injected into the meta at build time (the
 * `<!-- CSP_API_CONNECT_SRC -->` placeholder); every other token there is
 * hand-written, while `dist/_headers` is generated wholesale from the canonical
 * source. `csp-api-origin.ts` says the two are "kept in lock step" and that
 * "the static security test asserts they agree on shared directives" — this is
 * that test. Nothing enforced it before, and `connect-src` had already drifted.
 *
 * Why it matters: a browser given both a header and a meta CSP enforces the
 * INTERSECTION, so the narrower meta is what actually binds. A directive the
 * header allows but the meta omits is blocked in production.
 */
describe('content security policy (meta ↔ canonical header parity)', () => {
  /** Directives that only work as a real header, deliberately absent from meta. */
  const HEADER_ONLY_DIRECTIVES = new Set([
    'frame-ancestors', // browsers ignore it in a meta CSP
    'upgrade-insecure-requests', // upgrades http://localhost and breaks Safari preview
    'report-uri',
    'report-to',
  ]);

  /**
   * Origins the canonical header allows in `connect-src` that the meta does not
   * list, so they are blocked in production today. Closing this gap WIDENS what
   * production permits — a deliberate decision, not a drive-by test fix.
   * Shrink this set; never grow it.
   */
  const META_CONNECT_SRC_GAP = new Set([
    'https://js.stripe.com',
    'https://hooks.stripe.com',
  ]);

  function parseDirectives(policy: string): Map<string, string[]> {
    const parsed = new Map<string, string[]>();
    for (const clause of policy.split(';')) {
      const tokens = clause.trim().split(/\s+/).filter(Boolean);
      const name = tokens[0];
      if (!name) continue;
      parsed.set(name, tokens.slice(1).sort());
    }
    return parsed;
  }

  // The meta's placeholders are filled the way the plugin fills them at build; the
  // canonical policy is built from the same inputs — none here, the named ones below.
  const metaFor = (apiBaseUrl: string | undefined, named: CspNamedOrigins = {}) =>
    fillCspMetaPlaceholders(indexHtml, apiBaseUrl, named).match(
      /http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]*)"/,
    )?.[1];
  const canonical = parseDirectives(buildContentSecurityPolicy(undefined));
  const metaContent = metaFor(undefined);
  const meta = parseDirectives(metaContent ?? '');

  const sharedDirectives = [...canonical.keys()].filter(
    (d) => !HEADER_ONLY_DIRECTIVES.has(d),
  );

  it('extracts both policies (guards the regex above from silently matching nothing)', () => {
    expect(metaContent).toBeDefined();
    expect(canonical.size).toBeGreaterThan(5);
    expect(meta.size).toBeGreaterThan(5);
  });

  it('meta declares every directive the canonical policy does, minus header-only ones', () => {
    expect([...meta.keys()].sort()).toEqual([...sharedDirectives].sort());
  });

  it.each(sharedDirectives.filter((d) => d !== 'connect-src'))(
    '%s is identical in meta and canonical header',
    (directive) => {
      expect(meta.get(directive)).toEqual(canonical.get(directive));
    },
  );

  it('connect-src differs from the canonical header only by the documented gap', () => {
    const expected = (canonical.get('connect-src') ?? [])
      .filter((origin) => !META_CONNECT_SRC_GAP.has(origin))
      .sort();
    expect(meta.get('connect-src')).toEqual(expected);
  });

  it('stays in parity when the build names its API, Sentry ingest and file store (F-7)', () => {
    const named: CspNamedOrigins = {
      storedFilesOrigin: 'https://clinozy-files.s3.ap-south-1.amazonaws.com',
      sentryDsn: 'https://k@o42.ingest.us.sentry.io/7',
    };
    const header = parseDirectives(
      buildContentSecurityPolicy('https://api.example.com', undefined, named),
    );
    const filled = parseDirectives(metaFor('https://api.example.com', named) ?? '');
    expect(filled.get('img-src')).toEqual(header.get('img-src'));
    expect(filled.get('connect-src')).toEqual(
      (header.get('connect-src') ?? []).filter(
        (origin) => !META_CONNECT_SRC_GAP.has(origin),
      ),
    );
    for (const placeholder of Object.values(CSP_META_PLACEHOLDERS)) {
      expect(metaFor('https://api.example.com', named)).not.toContain(placeholder);
    }
  });

  it('every documented gap entry is actually in the canonical policy (prunes stale entries)', () => {
    const canonicalConnectSrc = new Set(canonical.get('connect-src') ?? []);
    for (const origin of META_CONNECT_SRC_GAP) {
      expect(canonicalConnectSrc.has(origin)).toBe(true);
    }
  });
});

/**
 * Every static page ships under the same header CSP, whose `script-src` has no
 * `'unsafe-inline'`: an inline `onclick="…"` or an inline `<script>` body is
 * blocked there, silently. The offline page's Retry was exactly that — an
 * inline `onclick` that did nothing in production.
 */
describe('static pages run under the CSP (no inline script)', () => {
  /** The inside of each tag — its name and attributes, without `<` and `>`. */
  const tags = (html: string) =>
    html
      .split('<')
      .slice(1)
      .map((chunk) => chunk.split('>', 1)[0] ?? '');

  /** A tag whose attribute runs script: `onclick=`, `onload=` … or a `javascript:` URL. */
  const runsScript = (tag: string) =>
    tag
      .split(/\s+/)
      .some(
        (token) => /^on[a-z]+=/i.test(token) || /^[a-z-]+=["']?javascript:/i.test(token),
      );

  /** Every `<script …>…</script>` element: its attributes and its body. */
  const scripts = (html: string) =>
    [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(
      ([, attributes = '', body = '']) => ({ attributes, body }),
    );

  it.each([
    ['index.html', indexHtml],
    ['public/offline.html', offlineHtml],
  ])(
    '%s carries no inline event handlers, inline scripts or javascript: URLs',
    (_page, html) => {
      expect(tags(html).filter(runsScript)).toEqual([]);
      for (const script of scripts(html)) {
        expect(script.attributes).toMatch(/\bsrc=/);
        expect(script.body.trim()).toBe('');
      }
    },
  );

  it('catches what the offline page used to carry (guards the check above)', () => {
    const old = '<button onclick="window.location.reload()">Retry</button>';
    expect(tags(old).filter(runsScript)).toHaveLength(1);
    expect(
      tags('<a href="javascript:location.reload()">').filter(runsScript),
    ).toHaveLength(1);
  });

  it("the offline page's Retry reloads without script: a link to the page itself", () => {
    expect(offlineHtml).toContain('<a class="retry" href="">Retry</a>');
  });
});

describe('vite build security config', () => {
  it('keeps assetsInlineLimit at 0 (no inlined data: URIs — CSP compliance)', () => {
    expect(viteConfig).toMatch(/assetsInlineLimit:\s*0/);
  });
});

describe('supply-chain dependency floors (no downgrade past a known CVE)', () => {
  it('pins vite at >=7.3.5 (server.fs.deny bypass — GHSA dev-server path traversal)', () => {
    expect(atLeast(pkg.devDependencies.vite, [7, 3, 5])).toBe(true);
  });

  it('keeps overrides in pnpm-workspace.yaml, not package.json (pnpm 11+ silently ignores the `pnpm` field)', () => {
    expect(pkg).not.toHaveProperty('pnpm');
    expect(OVERRIDES.size).toBeGreaterThan(0);
  });

  it('forces dompurify >=3.4.7 via pnpm override (cross-realm XSS — GHSA-76mc-f452-cxcm)', () => {
    // dompurify is a transitive of posthog-js; the override is the only floor.
    expect(atLeast(override('dompurify'), [3, 4, 7])).toBe(true);
  });

  it('forces @opentelemetry/core >=2.8.0 via pnpm override (unbounded memory allocation — GHSA-8988-4f7v-96qf)', () => {
    // @opentelemetry/core is a transitive of netlify-cli (dev-only CLI); the override is the floor.
    expect(atLeast(override('@opentelemetry/core'), [2, 8, 0])).toBe(true);
  });

  // Bounded floors (>=x.y.z <nextMajor): patches flow, the known-CVE floor holds.
  it('floors protobufjs >=7.6.4 via pnpm override (unbounded-recursion DoS — <=7.5.7)', () => {
    expect(atLeast(override('protobufjs'), [7, 6, 4])).toBe(true);
  });

  it('floors basic-ftp >=5.3.1 via pnpm override (path-traversal / DoS advisories)', () => {
    expect(atLeast(override('basic-ftp'), [5, 3, 1])).toBe(true);
  });

  it('floors minimatch >=10.2.5 via pnpm override (ReDoS on the 10.1.x line)', () => {
    expect(atLeast(override('minimatch'), [10, 2, 5])).toBe(true);
  });

  it('floors brace-expansion >=5.0.8 via pnpm override (unbounded-expansion OOM DoS — GHSA-mh99-v99m-4gvg)', () => {
    // Reached through the minimatch 10.x line the override above pins.
    expect(atLeast(override('brace-expansion'), [5, 0, 8])).toBe(true);
  });

  // netlify-cli (dev-only CLI) transitives — floors, since upstream still resolves
  // the vulnerable versions. None of these ship in the client bundle.
  it('floors @fastify/static >=10.1.2 via pnpm override (route-guard bypass + non-canonical path authz bypass)', () => {
    expect(atLeast(override('@fastify/static'), [10, 1, 2])).toBe(true);
  });

  it('floors fast-uri >=3.1.4 via pnpm override (host confusion — GHSA-v2hh-gcrm-f6hx, GHSA-4c8g-83qw-93j6)', () => {
    expect(atLeast(override('fast-uri'), [3, 1, 4])).toBe(true);
  });

  it('floors find-my-way >=9.7.0 via pnpm override (HTTP/2 DDoS — GHSA-c96f-x56v-gq3h)', () => {
    expect(atLeast(override('find-my-way'), [9, 7, 0])).toBe(true);
  });

  it('floors sharp >=0.35.1 via pnpm override (inherited libvips CVEs — GHSA-f88m-g3jw-g9cj)', () => {
    expect(atLeast(override('sharp'), [0, 35, 1])).toBe(true);
  });

  it('floors svgo >=4.0.2 via pnpm override (removeScripts leaves executable scripts — GHSA-2p49-hgcm-8545)', () => {
    expect(atLeast(override('svgo'), [4, 0, 2])).toBe(true);
  });

  it('floors the js-yaml 5.x line >=5.2.2 via pnpm override (flow-collection parsing DoS — GHSA-pm4m-ph32-ghv5)', () => {
    // Version-scoped selector: cosmiconfig's unaffected js-yaml@4 tree is untouched.
    expect(atLeast(override('js-yaml@5'), [5, 2, 2])).toBe(true);
  });

  it('floors postcss >=8.5.18 via pnpm override (sourceMappingURL path traversal — GHSA-r28c-9q8g-f849)', () => {
    expect(atLeast(override('postcss'), [8, 5, 18])).toBe(true);
  });

  it('floors seroval >=1.6.3 via pnpm override (thenable assimilation — GHSA-p6vx-979v-rg4c; TypedArray memory exhaustion — GHSA-jp82-f5mq-hwhp)', () => {
    // solid-js 1.9.15 (← @tanstack/query-devtools) still asks for the 1.5 line.
    expect(atLeast(override('seroval'), [1, 6, 3])).toBe(true);
  });

  it('floors source-map-js >=1.2.2 via pnpm override (indexed source-map offsets DoS — GHSA-68fv-2mgg-jv7q)', () => {
    expect(atLeast(override('source-map-js'), [1, 2, 2])).toBe(true);
  });

  it('floors @modelcontextprotocol/sdk >=1.31.0 via pnpm override (OAuth credentials sent to a server-chosen authorization server — GHSA-6qxp-vccf-f47h)', () => {
    // Reached through shadcn and tailwindcss-mcp-server (dev-only MCP tooling).
    expect(atLeast(override('@modelcontextprotocol/sdk'), [1, 31, 0])).toBe(true);
  });
});

/**
 * Netlify reads security headers from BOTH `netlify.toml` and `public/_headers`,
 * and merges them. Two sources for one header is fine while they agree and a
 * silent contradiction when they do not: `X-Frame-Options` was `DENY` in
 * `_headers` and `SAMEORIGIN` in `netlify.toml`, so which one a browser received
 * depended on Netlify's merge precedence rather than on anything stated here.
 * Whichever way that resolves, one of the two files was lying to whoever read it.
 *
 * This pins agreement rather than precedence — the property that makes the
 * precedence question stop mattering.
 */
describe('security headers agree across both sources (netlify.toml ↔ public/_headers)', () => {
  const EVERY_ROUTE = '/*';

  /** `/*` block of `public/_headers`: indented `Name: value` lines until a blank line. */
  function parseHeadersFile(): Map<string, string> {
    const parsed = new Map<string, string>();
    let insideBlock = false;
    for (const line of headers.split('\n')) {
      if (line.trim() === EVERY_ROUTE) {
        insideBlock = true;
        continue;
      }
      if (!insideBlock) continue;
      if (line.trim() === '') break;
      const separator = line.indexOf(':');
      if (separator === -1) continue;
      parsed.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
    return parsed;
  }

  /**
   * One `[[headers]]` block's `Name = "value"` lines. Parsed line by line rather
   * than by regex: the obvious patterns here stack adjacent unbounded
   * quantifiers, which `sonarjs/super-linear-regex` rejects for backtracking,
   * and a split on `=` is both linear and easier to read.
   */
  function parseTomlPairs(block: string): [string, string][] {
    const pairs: [string, string][] = [];

    for (const rawLine of block.split('\n')) {
      const line = rawLine.trim();
      // The final block runs to end of file, so stop at the next TOML section
      // rather than reading `[build]` keys as if they were headers.
      if (line.startsWith('[') && line !== '[headers.values]') break;
      if (line.startsWith('#')) continue;

      const separator = line.indexOf('=');
      if (separator === -1) continue;

      const value = line.slice(separator + 1).trim();
      pairs.push([
        line.slice(0, separator).trim(),
        value.startsWith('"') ? value.slice(1, -1) : value,
      ]);
    }

    return pairs;
  }

  /** The `[[headers]]` block whose `for` is `/*`, as a name → value map. */
  function parseNetlifyToml(): Map<string, string> {
    const parsed = new Map<string, string>();

    for (const block of netlifyToml.split('[[headers]]').slice(1)) {
      const pairs = parseTomlPairs(block);
      if (pairs.find(([name]) => name === 'for')?.[1] !== EVERY_ROUTE) continue;
      for (const [name, value] of pairs) {
        if (name !== 'for') parsed.set(name, value);
      }
    }

    return parsed;
  }

  it('finds a populated /* block in each file (guards the parsers above)', () => {
    expect(parseHeadersFile().size).toBeGreaterThan(0);
    expect(parseNetlifyToml().size).toBeGreaterThan(0);
    expect(parseHeadersFile().get('X-Frame-Options')).toBe('DENY');
    expect(parseNetlifyToml().get('X-Frame-Options')).toBe('DENY');
  });

  it('never gives the same header two different values', () => {
    const fromHeadersFile = parseHeadersFile();
    const conflicts = [...parseNetlifyToml()]
      .filter(([name]) => fromHeadersFile.has(name))
      .filter(([name, value]) => fromHeadersFile.get(name) !== value)
      .map(
        ([name, value]) =>
          `${name}: _headers=${fromHeadersFile.get(name)} netlify.toml=${value}`,
      );

    expect(conflicts).toEqual([]);
  });
});
