/**
 * The live CSP and HSTS check (`probe-live-site.mjs`): each header rule, the fetch path, and — so
 * the probe never flags what this repository means to ship — the header policy the build writes
 * (`buildContentSecurityPolicy`) with `netlify.toml`'s HSTS and nosniff passes it.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test } from 'node:test';
import { buildContentSecurityPolicy } from '../../src/lib/csp-api-origin.ts';
import { checkHeaders, MINIMUM_HSTS_SECONDS, probeLiveSite } from './probe-live-site.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const SAFE_CSP =
  "default-src 'self'; script-src 'self' https://js.stripe.com; object-src 'none'; frame-ancestors 'none'";

const headersOf = (values) => {
  const map = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return { get: (name) => map.get(name.toLowerCase()) ?? null };
};

const shipped = (overrides = {}) =>
  headersOf({
    'Content-Security-Policy': SAFE_CSP,
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    ...overrides,
  });

describe('checkHeaders', () => {
  test('passes a safe CSP, two years of HSTS and nosniff', () => {
    assert.deepEqual(checkHeaders(shipped()), []);
  });

  test('flags a missing CSP header, and each missing or unsafe directive', () => {
    assert.match(
      checkHeaders(shipped({ 'Content-Security-Policy': null }))[0],
      /no Content-Security/,
    );
    for (const [policy, finding] of [
      ["default-src 'self'; object-src 'none'", /frame-ancestors/],
      ["default-src 'self'; frame-ancestors 'none'", /object-src/],
      [
        "script-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'",
        /script policy/,
      ],
      ["script-src *; object-src 'none'; frame-ancestors 'none'", /script policy/],
      ["object-src 'none'; frame-ancestors 'none'", /script policy/],
    ]) {
      const findings = checkHeaders(shipped({ 'Content-Security-Policy': policy }));
      assert.ok(
        findings.some((text) => finding.test(text)),
        policy,
      );
    }
  });

  test('a second, stricter policy satisfies the rule a looser one breaks', () => {
    const joined = `script-src 'self' 'unsafe-inline', ${SAFE_CSP}`;
    assert.deepEqual(checkHeaders(shipped({ 'Content-Security-Policy': joined })), []);
  });

  test('flags HSTS that is missing or under 180 days, and a missing nosniff', () => {
    assert.match(
      checkHeaders(shipped({ 'Strict-Transport-Security': null }))[0],
      /no Strict/,
    );
    const short = `max-age=${MINIMUM_HSTS_SECONDS - 1}`;
    assert.match(
      checkHeaders(shipped({ 'Strict-Transport-Security': short }))[0],
      /under 180/,
    );
    assert.deepEqual(
      checkHeaders(
        shipped({ 'Strict-Transport-Security': `max-age=${MINIMUM_HSTS_SECONDS}` }),
      ),
      [],
    );
    assert.match(checkHeaders(shipped({ 'X-Content-Type-Options': null }))[0], /nosniff/);
  });
});

describe('probeLiveSite', () => {
  test('probes / and /login, names the path of each finding, and refuses plain http', async () => {
    const asked = [];
    const fetchImplementation = async (url) => {
      asked.push(url);
      return url.endsWith('/login')
        ? { ok: true, status: 200, headers: shipped({ 'X-Content-Type-Options': null }) }
        : { ok: true, status: 200, headers: shipped() };
    };
    const findings = await probeLiveSite({
      url: 'https://site.example/',
      fetchImplementation,
    });
    assert.deepEqual(asked, ['https://site.example/', 'https://site.example/login']);
    assert.deepEqual(findings, ['/login: no X-Content-Type-Options: nosniff']);
    assert.deepEqual(await probeLiveSite({ url: 'http://site.example' }), [
      'http://site.example is not an https:// URL',
    ]);
  });

  test('an error status or a network failure is a finding', async () => {
    const findings = await probeLiveSite({
      url: 'https://site.example',
      fetchImplementation: async (url) => {
        if (url.endsWith('/login')) throw new Error('getaddrinfo ENOTFOUND');
        return { ok: false, status: 503, headers: shipped() };
      },
    });
    assert.deepEqual(findings, ['/: HTTP 503', '/login: getaddrinfo ENOTFOUND']);
  });
});

describe('what this repository ships', () => {
  test("the build's header policy with netlify.toml's HSTS and nosniff passes the probe", () => {
    const netlify = readFileSync(join(ROOT, 'netlify.toml'), 'utf8');
    const hsts = /Strict-Transport-Security = "([^"]+)"/.exec(netlify)?.[1];
    const nosniff = /X-Content-Type-Options = "([^"]+)"/.exec(netlify)?.[1];
    assert.ok(hsts && nosniff, 'netlify.toml sets HSTS and nosniff for /*');
    const headers = headersOf({
      'Content-Security-Policy': buildContentSecurityPolicy('https://api.example.com'),
      'Strict-Transport-Security': hsts,
      'X-Content-Type-Options': nosniff,
    });
    assert.deepEqual(checkHeaders(headers), []);
  });
});
