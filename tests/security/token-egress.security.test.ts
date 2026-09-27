/**
 * Security invariant: the access token (a bearer credential) may ride on the
 * `Authorization` header ONLY for requests to the configured API origin. Any
 * stray absolute URL — a future bug, a server-supplied `next` cursor used
 * verbatim, a compromised dependency assembling a URL — must not exfiltrate the
 * token to a foreign host. `isApiOriginUrl` is the predicate the fetch client
 * gates the header on; here we hammer it with the origin-spoofing shapes an
 * attacker would reach for.
 *
 * In the test environment `apiBaseUrl` is empty, so the API origin resolves to
 * the app's own origin — positive cases derive it dynamically; negatives use
 * literal foreign hosts that can never equal it.
 */
import { describe, expect, it } from 'vitest';

import { isApiOriginUrl } from '@/core/http/fetch-client.ts';

const apiOrigin = globalThis.location.origin;
const apiHost = new URL(apiOrigin).host;

describe('bearer-token origin pin (security)', () => {
  it.each([
    '/api/v1/auth/me/context',
    '/tenancy/organizations',
    `${apiOrigin}/api/v1/tenancy/organizations`,
  ])('attaches the token for an API-origin URL: %s', (url) => {
    expect(isApiOriginUrl(url)).toBe(true);
  });

  it.each([
    ['plain foreign host', 'https://evil.example.com/steal'],
    ['foreign host, API-looking path', 'https://evil.example.com/api/v1/auth/me'],
    ['protocol-relative', '//evil.example.com/x'],
    [
      'userinfo spoof (origin is the host after @)',
      `https://${apiHost}@evil.example.com/`,
    ],
    ['lookalike subdomain', 'https://api.evil.example.com/x'],
    ['lookalike suffix', `https://${apiHost}.evil.example.com/x`],
    ['opaque scheme', 'javascript:fetch("//evil.example.com")'],
    ['data scheme', 'data:text/html,<script>1</script>'],
  ])('withholds the token from a foreign/spoofed URL — %s', (_label, url) => {
    expect(isApiOriginUrl(url)).toBe(false);
  });
});
