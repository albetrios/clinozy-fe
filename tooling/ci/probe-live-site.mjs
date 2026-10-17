#!/usr/bin/env node
/**
 * The live CSP and HSTS check of a Netlify deploy, from outside (clinozy-be's
 * `pnpm ops:probe-live-api`, on this repository's surface): the headers the deployed site actually
 * serves on `/` and `/login`, not the ones the build meant to write. Runs after every deploy
 * (reusable-netlify-deploy.yml, preview.yml); warn-only until `EARLY_CHECKS_BLOCK_FROM`
 * (`tooling/ci/early-checks.mjs`), then a finding fails the step.
 *
 * Usage:
 *   pnpm deploy:probe-live --url https://<deploy>.netlify.app
 *
 * Checks: a `Content-Security-Policy` header (the meta fallback cannot carry `frame-ancestors`)
 * with `frame-ancestors 'none'`, `object-src 'none'` and a script policy without `'unsafe-inline'`,
 * `'unsafe-eval'`, `*`, `data:` or `http:`; `Strict-Transport-Security` of 180 days or more;
 * `X-Content-Type-Options: nosniff`.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reportEarlyCheck } from './early-checks.mjs';

/** The least HSTS max-age accepted: 180 days, in seconds. */
export const MINIMUM_HSTS_SECONDS = 180 * 24 * 60 * 60;

/** The paths probed: the app shell and a deep link the SPA rewrite serves. */
export const PROBED_PATHS = ['/', '/login'];

/** Script sources that let injected script run. */
const UNSAFE_SCRIPT_SOURCES = ["'unsafe-inline'", "'unsafe-eval'", '*', 'data:', 'http:'];

/** Each policy of a (possibly comma-joined) CSP header → its directives by name. */
function parsePolicies(header) {
  return header.split(',').map((policy) => {
    const directives = new Map();
    for (const directive of policy.split(';')) {
      const [name, ...sources] = directive.trim().split(/\s+/);
      if (name) directives.set(name.toLowerCase(), sources);
    }
    return directives;
  });
}

/**
 * What is wrong with one response's headers — empty when it passes.
 *
 * @param {{ get(name: string): string | null }} headers
 * @returns {string[]}
 */
export function checkHeaders(headers) {
  const findings = [];
  const csp = headers.get('content-security-policy');
  if (!csp)
    findings.push('no Content-Security-Policy header (the meta fallback is not enough)');
  else {
    const policies = parsePolicies(csp);
    const some = (test) => policies.some(test);
    if (!some((policy) => policy.get('frame-ancestors')?.join(' ') === "'none'"))
      findings.push("CSP: no frame-ancestors 'none'");
    if (!some((policy) => policy.get('object-src')?.join(' ') === "'none'"))
      findings.push("CSP: no object-src 'none'");
    const scriptPolicySafe = (policy) => {
      const sources = policy.get('script-src') ?? policy.get('default-src');
      return (
        sources !== undefined &&
        !sources.some((source) => UNSAFE_SCRIPT_SOURCES.includes(source.toLowerCase()))
      );
    };
    if (!some(scriptPolicySafe))
      findings.push(
        "CSP: no script policy free of 'unsafe-inline', 'unsafe-eval', *, data: and http:",
      );
  }
  const hsts = headers.get('strict-transport-security');
  const maxAge = Number(/max-age=(\d+)/i.exec(hsts ?? '')?.[1] ?? Number.NaN);
  if (!hsts) findings.push('no Strict-Transport-Security header');
  else if (!(maxAge >= MINIMUM_HSTS_SECONDS))
    findings.push(`HSTS max-age ${hsts} is under 180 days (${MINIMUM_HSTS_SECONDS} s)`);
  if (headers.get('x-content-type-options')?.toLowerCase() !== 'nosniff')
    findings.push('no X-Content-Type-Options: nosniff');
  return findings;
}

/**
 * Probe every path of a deploy; each finding names its path.
 *
 * @param {{ url: string, fetchImplementation?: typeof fetch }} options
 * @returns {Promise<string[]>}
 */
export async function probeLiveSite({ url, fetchImplementation = fetch }) {
  const base = url.replace(/\/+$/, '');
  if (!base.startsWith('https://')) return [`${url} is not an https:// URL`];
  const findings = [];
  for (const path of PROBED_PATHS) {
    try {
      const response = await fetchImplementation(`${base}${path}`, {
        redirect: 'follow',
      });
      if (!response.ok) {
        findings.push(`${path}: HTTP ${response.status}`);
        continue;
      }
      for (const finding of checkHeaders(response.headers))
        findings.push(`${path}: ${finding}`);
    } catch (error) {
      findings.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return findings;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--url');
  const url = index === -1 ? undefined : process.argv[index + 1];
  if (!url) {
    console.error('Usage: pnpm deploy:probe-live --url https://<deploy>.netlify.app');
    process.exitCode = 2;
  } else {
    const findings = await probeLiveSite({ url });
    process.exitCode = reportEarlyCheck({
      check: `Live CSP and HSTS (${url})`,
      findings,
    });
  }
}
