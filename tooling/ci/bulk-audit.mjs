/**
 * Dependency audit against npm's BULK advisory endpoint.
 *
 * `pnpm audit` (pnpm ≤ 10) calls the legacy quick-audit endpoints, which the
 * npm registry retired on 2026-07-15 (HTTP 410 — "use the bulk advisory
 * endpoint instead"). pnpm ships bulk support only from v11, so until the
 * package-manager major lands this script keeps the Security-audit lane
 * working: it collects every locked package version from `pnpm-lock.yaml`
 * (lockfile v9), asks `/-/npm/v1/security/advisories/bulk` which advisories
 * apply to those exact versions (the endpoint does the range matching), and
 * fails when any advisory at or above the threshold severity comes back.
 *
 *   node tooling/ci/bulk-audit.mjs                 # all deps, fail on high+critical
 *   node tooling/ci/bulk-audit.mjs --prod          # only prod-reachable deps
 *   node tooling/ci/bulk-audit.mjs --level moderate
 *
 * Wired as `pnpm deps:audit` / `pnpm deps:audit:prod` (pr-ci Security audit
 * lane). Network or registry errors FAIL the run — a silent pass on a broken
 * audit would be a hole, not a gate.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BULK_ENDPOINT = 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk';
const SEVERITY_RANK = new Map([
  ['low', 0],
  ['moderate', 1],
  ['high', 2],
  ['critical', 3],
]);

const args = process.argv.slice(2);
const prodOnly = args.includes('--prod');
const levelFlag = args.includes('--level')
  ? (args[args.indexOf('--level') + 1] ?? 'high')
  : 'high';
if (!SEVERITY_RANK.has(levelFlag)) {
  console.error(
    `[bulk-audit] unknown --level "${levelFlag}" (low|moderate|high|critical)`,
  );
  process.exit(1);
}
const threshold = SEVERITY_RANK.get(levelFlag);

/** Splits `name@version` at the LAST `@` (scoped names start with one). */
function splitNameVersion(key) {
  const at = key.lastIndexOf('@');
  if (at <= 0) return undefined;
  return { name: key.slice(0, at), version: key.slice(at + 1) };
}

/** Drops the peer-dependency suffix pnpm appends to snapshot refs. */
function stripPeerSuffix(ref) {
  const paren = ref.indexOf('(');
  return paren === -1 ? ref : ref.slice(0, paren);
}

/** True for registry semver versions (skips link:/file:/workspace:/git refs). */
function isRegistryVersion(version) {
  return /^\d/.test(version);
}

/**
 * Minimal structural parse of pnpm-lock.yaml v9 — only the shapes this audit
 * needs (top-level sections, two-space keys, dependency maps). Avoids a yaml
 * dependency; the format is machine-generated and stable per lockfileVersion.
 */
function parseLockfile(text) {
  /** @type {Map<string, Set<string>>} name → locked versions (all deps) */
  const allPackages = new Map();
  /** @type {Map<string, string[]>} snapshot key (peer-stripped name@version) → dep refs */
  const snapshotDeps = new Map();
  /** @type {string[]} peer-stripped name@version roots of the '.' importer's prod deps */
  const prodRoots = [];

  let section = '';
  let importerPath = '';
  let importerBlock = '';
  let pendingDepName = '';
  let snapshotKey = '';
  let inSnapshotDeps = false;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (/^[A-Za-z]/.test(line)) {
      section = line.replace(/:.*/, '');
      continue;
    }
    if (section === 'packages') {
      const match = /^ {2}'?([^' ]+?)'?:\s*$/.exec(line);
      if (match?.[1]) {
        const parsed = splitNameVersion(match[1]);
        if (parsed && isRegistryVersion(parsed.version)) {
          const versions = allPackages.get(parsed.name) ?? new Set();
          versions.add(parsed.version);
          allPackages.set(parsed.name, versions);
        }
      }
    } else if (section === 'snapshots') {
      const keyMatch = /^ {2}'?([^' ]+?)'?:\s*(\{\})?\s*$/.exec(line);
      if (keyMatch?.[1]) {
        snapshotKey = stripPeerSuffix(keyMatch[1]);
        snapshotDeps.set(snapshotKey, snapshotDeps.get(snapshotKey) ?? []);
        inSnapshotDeps = false;
        continue;
      }
      if (/^ {4}(optionalD|d)ependencies:\s*$/.test(line)) {
        inSnapshotDeps = true;
        continue;
      }
      if (/^ {4}\S/.test(line)) {
        inSnapshotDeps = false;
        continue;
      }
      if (inSnapshotDeps && snapshotKey) {
        const dep = /^ {6}'?([^':]+)'?: (.+)$/.exec(line);
        if (dep?.[1] && dep[2]) {
          const version = stripPeerSuffix(dep[2].trim());
          if (isRegistryVersion(version)) {
            snapshotDeps.get(snapshotKey)?.push(`${dep[1]}@${version}`);
          }
        }
      }
    } else if (section === 'importers') {
      const importerMatch = /^ {2}'?([^': ]+)'?:\s*$/.exec(line);
      if (importerMatch?.[1]) {
        importerPath = importerMatch[1];
        importerBlock = '';
        pendingDepName = '';
        continue;
      }
      const blockMatch = /^ {4}(\w+):\s*$/.exec(line);
      if (blockMatch?.[1]) {
        importerBlock = blockMatch[1];
        pendingDepName = '';
        continue;
      }
      const isProdBlock =
        importerBlock === 'dependencies' || importerBlock === 'optionalDependencies';
      if (importerPath === '.' && isProdBlock) {
        const nameLine = /^ {6}'?([^': ]+)'?:\s*$/.exec(line);
        if (nameLine?.[1]) {
          pendingDepName = nameLine[1];
          continue;
        }
        const versionLine = /^ {8}version: (.+)$/.exec(line);
        if (versionLine?.[1] && pendingDepName) {
          const version = stripPeerSuffix(versionLine[1].trim());
          if (isRegistryVersion(version)) {
            prodRoots.push(`${pendingDepName}@${version}`);
          }
          pendingDepName = '';
        }
      }
    }
  }
  return { allPackages, snapshotDeps, prodRoots };
}

/** BFS over the snapshot graph from the prod roots → name → versions map. */
function prodReachable(prodRoots, snapshotDeps) {
  /** @type {Map<string, Set<string>>} */
  const reached = new Map();
  const queue = [...prodRoots];
  const seen = new Set();
  while (queue.length > 0) {
    const key = queue.pop();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const parsed = splitNameVersion(key);
    if (!parsed) continue;
    const versions = reached.get(parsed.name) ?? new Set();
    versions.add(parsed.version);
    reached.set(parsed.name, versions);
    for (const dep of snapshotDeps.get(key) ?? []) queue.push(dep);
  }
  return reached;
}

const lockText = readFileSync(resolve(process.cwd(), 'pnpm-lock.yaml'), 'utf8');
const { allPackages, snapshotDeps, prodRoots } = parseLockfile(lockText);
const audited = prodOnly ? prodReachable(prodRoots, snapshotDeps) : allPackages;

if (audited.size === 0) {
  console.error('[bulk-audit] parsed 0 packages from pnpm-lock.yaml — parser drift?');
  process.exit(1);
}

const payload = Object.fromEntries(
  [...audited.entries()].map(([name, versions]) => [name, [...versions]]),
);

const response = await fetch(BULK_ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
if (!response.ok) {
  console.error(`[bulk-audit] registry responded ${response.status} — failing loud.`);
  process.exit(1);
}
/** @type {Record<string, Array<{id: number, title: string, severity: string, url: string, vulnerable_versions: string}>>} */
const advisories = await response.json();

let failures = 0;
let reported = 0;
for (const [name, entries] of Object.entries(advisories)) {
  for (const advisory of entries) {
    reported += 1;
    const rank = SEVERITY_RANK.get(advisory.severity) ?? SEVERITY_RANK.get('critical');
    const versions = [...(audited.get(name) ?? [])].join(', ');
    const line = `${advisory.severity.toUpperCase().padEnd(8)} ${name} (locked: ${versions}; vulnerable: ${advisory.vulnerable_versions}) — ${advisory.title} ${advisory.url}`;
    if (rank >= threshold) {
      failures += 1;
      console.error(`  ${line}`);
    } else {
      console.info(`  (below threshold) ${line}`);
    }
  }
}

const scope = prodOnly ? 'prod-reachable' : 'all';
if (failures > 0) {
  console.error(
    `[bulk-audit] ${failures} advisory(ies) at ${levelFlag}+ across ${audited.size} ${scope} packages — fix or pin (pnpm.overrides).`,
  );
  process.exit(1);
}
console.info(
  `[bulk-audit] OK — ${audited.size} ${scope} packages, ${reported} advisory(ies) reported, none at ${levelFlag}+.`,
);
