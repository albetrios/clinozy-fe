#!/usr/bin/env node
/**
 * API contract-drift gate (v1: path-level).
 *
 * Verifies that every backend endpoint this frontend references exists in
 * clinozy-be's committed route catalog (`../clinozy-be/docs/routes.txt` — generated
 * by `pnpm routes:catalog` over there and kept fresh by clinozy-be's own CI
 * check), so endpoint typos and renames are caught BEFORE the auth module
 * wires real requests.
 *
 * Frontend endpoints are collected from two sources:
 *  1. `API_ENDPOINTS` in src/core/config/constants.ts (auth-domain fetchers).
 *  2. Literal/template arguments of `apiClient.<method>(...)` calls in src/
 *     (tests, mocks, and fixtures excluded). `${BASE}`/`${API_BASE_PATH}`
 *     resolve to /api/v1; any other `${...}` becomes a `:param` wildcard.
 *
 * Comparison is path-level (method-agnostic) with `:param` segments treated
 * as wildcards on both sides. Endpoints the frontend deliberately references
 * ahead of the backend live in tooling/ci/contract-drift-allowlist.json with
 * a reason — same no-silent-suppressions policy as knip.jsonc.
 *
 * This gate is LOCAL-ONLY by design: it needs the sibling clinozy-be checkout.
 * When ../clinozy-be (or $CLINOZY_BE_DIR) is absent — e.g. on CI runners — it skips
 * with a notice and exit 0. The pre-push hook runs it on every push.
 *
 * Usage: pnpm contracts:drift
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(process.cwd());
const CLINOZY_BE_DIR = process.env.CLINOZY_BE_DIR ?? resolve(REPO_ROOT, '../clinozy-be');
const ROUTES_FILE = join(CLINOZY_BE_DIR, 'docs/routes.txt');
const ALLOWLIST_FILE = resolve(REPO_ROOT, 'tooling/ci/contract-drift-allowlist.json');
const CONSTANTS_FILE = resolve(REPO_ROOT, 'src/core/config/constants.ts');
const API_BASE_PATH = '/api/v1';

/** Normalize a path for comparison: every param-ish segment becomes `:param`. */
function normalize(path) {
  return path
    .replace(/\/+$/, '')
    .split('/')
    .map((segment) =>
      segment.startsWith(':') || segment === '*param*' ? ':param' : segment,
    )
    .join('/');
}

/** True when the two normalized paths match segment-by-segment (params wild). */
function pathsMatch(left, right) {
  const a = left.split('/');
  const b = right.split('/');
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === ':param' || b[i] === ':param') continue;
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function loadBackendCatalog() {
  const rows = readFileSync(ROUTES_FILE, 'utf8').split('\n');
  const routes = [];
  for (const row of rows) {
    const match = /^\s{2}(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/.exec(row);
    if (match) routes.push({ method: match[1], path: normalize(match[2]) });
  }
  return routes;
}

/** Pulls every quoted path value out of the API_ENDPOINTS block. */
function collectConstantEndpoints() {
  const source = readFileSync(CONSTANTS_FILE, 'utf8');
  const blockStart = source.indexOf('export const API_ENDPOINTS');
  if (blockStart < 0) return [];
  const block = source.slice(blockStart, source.indexOf('} as const', blockStart));
  const endpoints = [];
  for (const match of block.matchAll(/:\s*'(\/[^']*)'/g)) {
    endpoints.push({
      path: normalize(`${API_BASE_PATH}${match[1]}`),
      source: 'src/core/config/constants.ts (API_ENDPOINTS)',
    });
  }
  return endpoints;
}

function listSourceFiles(rootPath) {
  const collected = [];
  const walk = (currentPath) => {
    for (const entry of readdirSync(currentPath)) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      const absolute = join(currentPath, entry);
      if (statSync(absolute).isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) continue;
      if (/^mock-|\.fixtures\.ts$/.test(entry)) continue;
      collected.push(absolute);
    }
  };
  walk(rootPath);
  return collected;
}

/** Extracts apiClient.<method>('…'|`…`) endpoint literals across src/. */
function collectApiClientEndpoints() {
  const endpoints = [];
  const callPattern =
    /apiClient\.(?:get|post|put|patch|delete)[^(]*\(\s*(?:'([^']+)'|`([^`]+)`)/g;
  for (const file of listSourceFiles(resolve(REPO_ROOT, 'src'))) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(callPattern)) {
      const raw = match[1] ?? match[2] ?? '';
      const resolved = raw
        .replace(/\$\{(?:BASE|API_BASE_PATH)\}/g, API_BASE_PATH)
        .replace(/\$\{[^}]+\}/g, ':param');
      // Generic data-provider style paths (fully dynamic) carry no contract.
      if (!resolved.startsWith('/api/')) continue;
      // A bare `${API_BASE_PATH}${path}` helper is fully dynamic past the
      // base — concrete paths live at its call sites, not in the template.
      if (resolved === `${API_BASE_PATH}:param`) continue;
      endpoints.push({
        path: normalize(resolved),
        source: file.slice(REPO_ROOT.length + 1),
      });
    }
  }
  return endpoints;
}

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_FILE)) return [];
  const parsed = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf8'));
  return (parsed.entries ?? []).map((entry) => ({
    path: normalize(entry.path),
    reason: entry.reason ?? '(no reason given)',
  }));
}

function main() {
  if (!existsSync(ROUTES_FILE)) {
    const required = process.env.CONTRACT_DRIFT_REQUIRED === '1';
    const message =
      `contracts:drift — ${required ? 'FAILED' : 'skipping'}: clinozy-be route catalog not found at ${ROUTES_FILE}` +
      ' (set CLINOZY_BE_DIR or clone clinozy-be next to this repo).';
    if (required) {
      console.error(message);
      process.exit(1);
    }
    console.log(message);
    return;
  }

  const backend = loadBackendCatalog();
  const allowlist = loadAllowlist();
  const frontend = [...collectConstantEndpoints(), ...collectApiClientEndpoints()];

  const missing = [];
  const allowlisted = [];
  for (const endpoint of frontend) {
    if (backend.some((route) => pathsMatch(route.path, endpoint.path))) continue;
    const allowed = allowlist.find((entry) => pathsMatch(entry.path, endpoint.path));
    if (allowed) {
      allowlisted.push({ ...endpoint, reason: allowed.reason });
      continue;
    }
    missing.push(endpoint);
  }

  const staleAllowlist = allowlist.filter((entry) =>
    backend.some((route) => pathsMatch(route.path, entry.path)),
  );

  console.log(
    `contracts:drift — ${frontend.length} frontend endpoint reference(s) vs ${backend.length} backend route(s).`,
  );
  for (const entry of allowlisted) {
    console.log(`  ALLOWLISTED ${entry.path} — ${entry.reason}`);
  }
  for (const entry of staleAllowlist) {
    console.log(
      `  STALE ALLOWLIST ${entry.path} — the backend now serves this route; remove the entry.`,
    );
  }

  if (missing.length > 0) {
    console.error('\ncontracts:drift FAILED — endpoints with no clinozy-be route:');
    for (const entry of missing) {
      console.error(`  ${entry.path}  (referenced from ${entry.source})`);
    }
    console.error(
      '\nFix the path (see ../clinozy-be/docs/routes.txt), or add an allowlist entry with a reason.',
    );
    process.exit(1);
  }
  if (staleAllowlist.length > 0) {
    console.error('\ncontracts:drift FAILED — stale allowlist entries (see above).');
    process.exit(1);
  }
  console.log('contracts:drift OK — every referenced endpoint exists in clinozy-be.');
}

main();
