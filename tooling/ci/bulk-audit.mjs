/**
 * Dependency audit against npm's BULK advisory endpoint.
 *
 * `pnpm audit` (pnpm ≤ 10) calls the legacy quick-audit endpoints, which the
 * npm registry retired on 2026-07-15 (HTTP 410 — "use the bulk advisory
 * endpoint instead"). pnpm ships bulk support only from v11; this script
 * predates the repo's move to pnpm 12 and remains the Security-audit gate
 * (swapping it for `pnpm audit` is a separate change): it collects every locked package version from `pnpm-lock.yaml`
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
 *
 * Accepted advisories. An advisory with NO fixed version published is listed in
 * `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` — the list `pnpm audit`
 * itself honours, and the only one this script reads (clinozy-be keeps the same
 * rule). Each entry carries a comment naming `Package:`, `Path:`, `No fix:` and
 * `Remove when:`; an entry without them, or with a malformed id, fails the run.
 * An accepted advisory is still REPORTED ("accepted (no fix published)") but does
 * not fail. The acceptance expires on its own: the newest published version of
 * the package is put back to the bulk endpoint, and once the advisory no longer
 * applies to it (or the advisory names `patched_versions`) a fix exists and the
 * run FAILS until the entry is removed and the package overridden or bumped. A
 * full-tree run also fails on an entry no locked package reports any more.
 * Every other advisory at or above the threshold fails exactly as before.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMain, parseCommandLine } from './script.mjs';

const REGISTRY = 'https://registry.npmjs.org';
const BULK_ENDPOINT = `${REGISTRY}/-/npm/v1/security/advisories/bulk`;
const SEVERITY_RANK = new Map([
  ['low', 0],
  ['moderate', 1],
  ['high', 2],
  ['critical', 3],
]);

/** GitHub advisory ids: `GHSA-` and three groups of four from GitHub's own alphabet. */
const GHSA_ID_PATTERN = /^GHSA(?:-[23456789cfghjmpqrvwx]{4}){3}$/;

/** The labelled comment lines every `auditConfig.ignoreGhsas` entry must carry above it. */
export const ACCEPTED_COMMENT_LABELS = ['Package:', 'Path:', 'No fix:', 'Remove when:'];

/** The bulk endpoint answers `patched_versions` (when it does at all) with this for "none". */
const NO_PATCHED_VERSIONS = '<0.0.0';

/**
 * Reads `auditConfig.ignoreGhsas` from `pnpm-workspace.yaml` text, with the comment
 * block directly above each entry. Line-based like the lockfile parser below: only
 * this one shape is needed, and the comments — which a YAML parser drops — are the
 * point. Returns the entries and every policy problem found (empty when clean).
 */
export function readAcceptedAdvisories(workspaceText) {
  /** @type {Array<{ghsa: string, packageName: string | undefined, comment: string[]}>} */
  const entries = [];
  /** @type {string[]} */
  const problems = [];
  const lines = workspaceText.split('\n').map((line) => line.replace(/\r$/, ''));
  const start = lines.findIndex((line) => /^auditConfig:\s*$/.test(line));
  if (start === -1) return { entries, problems };

  let inList = false;
  /** @type {string[]} */
  let comment = [];
  for (const line of lines.slice(start + 1)) {
    // The next top-level key (or a column-0 comment before one) ends auditConfig.
    if (/^\S/.test(line)) break;
    const key = /^ {2}(\w+):\s*(.*)$/.exec(line);
    if (key) {
      inList = key[1] === 'ignoreGhsas' && key[2] === '';
      if (key[1] === 'ignoreGhsas' && key[2] !== '') {
        problems.push(
          'auditConfig.ignoreGhsas must be a block list: one `- GHSA-…` line per advisory, under its own comment.',
        );
      }
      comment = [];
      continue;
    }
    if (!inList) continue;
    const commentLine = /^\s+#\s?(.*)$/.exec(line);
    if (commentLine) {
      comment.push((commentLine[1] ?? '').trim());
      continue;
    }
    // A blank line detaches a comment from the entry below it.
    if (line.trim() === '') {
      comment = [];
      continue;
    }
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (!item) {
      problems.push(`auditConfig.ignoreGhsas: unexpected line "${line.trim()}".`);
      continue;
    }
    const ghsa = (item[1] ?? '')
      .replace(/\s+#.*$/, '')
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2');
    const packageLine = comment.find((text) => text.startsWith('Package:'));
    const packageName =
      packageLine?.slice('Package:'.length).trim().split(/\s/)[0] || undefined;
    if (!GHSA_ID_PATTERN.test(ghsa)) {
      problems.push(
        `auditConfig.ignoreGhsas: "${ghsa}" is not a GHSA id (GHSA-xxxx-xxxx-xxxx).`,
      );
    } else if (entries.some((entry) => entry.ghsa === ghsa)) {
      problems.push(`auditConfig.ignoreGhsas: ${ghsa} is listed twice.`);
    } else if (comment.length === 0) {
      problems.push(
        `auditConfig.ignoreGhsas: ${ghsa} has no comment above it — name its ${ACCEPTED_COMMENT_LABELS.join(' ')}`,
      );
    } else {
      const missing = ACCEPTED_COMMENT_LABELS.filter(
        (label) =>
          !comment.some((text) => text.startsWith(label) && text.length > label.length),
      );
      if (missing.length > 0) {
        problems.push(
          `auditConfig.ignoreGhsas: the comment above ${ghsa} is missing ${missing.join(' ')}`,
        );
      }
    }
    entries.push({ ghsa, packageName, comment });
    comment = [];
  }
  return { entries, problems };
}

/** The GHSA id of a bulk-endpoint advisory (its `url` ends with it). */
function ghsaOf(advisory) {
  return (
    advisory.github_advisory_id ??
    /\/(GHSA(?:-[a-z0-9]{4}){3})$/i.exec(advisory.url ?? '')?.[1]
  );
}

/** One report line per advisory, as this script has always printed them. */
function reportLine(name, advisory, audited) {
  const versions = [...(audited.get(name) ?? [])].join(', ');
  return `${advisory.severity.toUpperCase().padEnd(8)} ${name} (locked: ${versions}; vulnerable: ${advisory.vulnerable_versions}) — ${advisory.title} ${advisory.url}`;
}

/**
 * Pure verdict over one audit run — no network, so the tests feed it fixtures.
 *
 * `advisories` is the bulk endpoint's answer for the locked versions; `newest` maps
 * each package with an accepted advisory to its newest published version and the
 * GHSA ids the endpoint still reports for THAT version. An accepted advisory missing
 * from that set no longer applies to the newest release: a fix is published.
 */
export function judgeAudit({ advisories, audited, level, accepted, newest, prodOnly }) {
  const threshold = SEVERITY_RANK.get(level);
  if (threshold === undefined) throw new Error(`unknown level "${level}"`);
  const acceptedById = new Map(accepted.map((entry) => [entry.ghsa, entry]));
  const seen = new Set();
  const verdict = {
    /** @type {string[]} */ failing: [],
    /** @type {string[]} */ accepted: [],
    /** @type {string[]} */ belowThreshold: [],
    /** @type {string[]} */ acceptanceProblems: [],
  };

  for (const [name, entries] of Object.entries(advisories)) {
    for (const advisory of entries) {
      const line = reportLine(name, advisory, audited);
      const ghsa = ghsaOf(advisory);
      const entry = ghsa === undefined ? undefined : acceptedById.get(ghsa);
      if (entry !== undefined) {
        seen.add(entry.ghsa);
        const release = newest.get(name);
        const patched = advisory.patched_versions;
        const fix =
          typeof patched === 'string' && patched !== '' && patched !== NO_PATCHED_VERSIONS
            ? patched
            : release !== undefined && !release.ghsas.has(entry.ghsa)
              ? release.version
              : undefined;
        if (fix !== undefined) {
          verdict.acceptanceProblems.push(
            `${entry.ghsa} now has a fix (${fix}) — remove it from auditConfig.ignoreGhsas and override/bump instead.`,
          );
        } else if (release === undefined) {
          verdict.acceptanceProblems.push(
            `${entry.ghsa}: the newest ${name} release was not checked, so "no fix published" is unproven.`,
          );
        } else if (entry.packageName !== name) {
          verdict.acceptanceProblems.push(
            `${entry.ghsa} is reported for ${name}, but its comment names Package: ${entry.packageName ?? '(none)'} — correct the comment.`,
          );
        } else {
          verdict.accepted.push(
            `accepted (no fix published; newest ${name} is ${release.version}) ${line}`,
          );
        }
        continue;
      }
      const rank = SEVERITY_RANK.get(advisory.severity) ?? SEVERITY_RANK.get('critical');
      if (rank >= threshold) verdict.failing.push(line);
      else verdict.belowThreshold.push(line);
    }
  }

  // A prod-only run audits part of the tree, so a dev-only acceptance is simply out of
  // its view there; the full tree is where an entry nothing reports is truly stale.
  if (!prodOnly) {
    for (const entry of accepted) {
      if (!seen.has(entry.ghsa)) {
        verdict.acceptanceProblems.push(
          `${entry.ghsa} is in auditConfig.ignoreGhsas, but no locked package reports it any more — remove the entry.`,
        );
      }
    }
  }
  return verdict;
}

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

/** Asks the bulk endpoint which advisories apply to `{ name: [versions] }`; throws on any non-2xx. */
async function fetchAdvisories(payload) {
  const response = await fetch(BULK_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`registry responded ${response.status}`);
  return response.json();
}

/** The `latest` dist-tag of a package, from its abbreviated packument. */
async function fetchNewestVersion(name) {
  const path = encodeURIComponent(name).replace(/^%40/, '@');
  const response = await fetch(`${REGISTRY}/${path}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (!response.ok) throw new Error(`registry responded ${response.status} for ${name}`);
  const packument = await response.json();
  const latest = packument?.['dist-tags']?.latest;
  if (typeof latest !== 'string')
    throw new Error(`no latest version published for ${name}`);
  return latest;
}

/**
 * For every package carrying an accepted advisory: its newest published version and
 * the GHSA ids the bulk endpoint reports for that version — the same range matching
 * the audit itself relies on, so no semver logic is reimplemented here.
 */
async function checkNewestReleases(advisories, accepted) {
  const acceptedIds = new Set(accepted.map((entry) => entry.ghsa));
  const names = Object.entries(advisories)
    .filter(([, entries]) =>
      entries.some((advisory) => acceptedIds.has(ghsaOf(advisory))),
    )
    .map(([name]) => name);
  /** @type {Map<string, {version: string, ghsas: Set<string>}>} */
  const newest = new Map();
  if (names.length === 0) return newest;
  const versions = new Map(
    await Promise.all(names.map(async (name) => [name, await fetchNewestVersion(name)])),
  );
  const answer = await fetchAdvisories(
    Object.fromEntries([...versions].map(([name, version]) => [name, [version]])),
  );
  for (const [name, version] of versions) {
    newest.set(name, {
      version,
      ghsas: new Set((answer[name] ?? []).map((advisory) => ghsaOf(advisory))),
    });
  }
  return newest;
}

async function main() {
  const { values } = parseCommandLine(process.argv.slice(2), {
    options: { prod: { type: 'boolean' }, level: { type: 'string' } },
  });
  const prodOnly = values.prod === true;
  const level = values.level ?? 'high';
  if (!SEVERITY_RANK.has(level)) {
    console.error(`[bulk-audit] unknown --level "${level}" (low|moderate|high|critical)`);
    process.exit(1);
  }

  const { entries: accepted, problems } = readAcceptedAdvisories(
    readFileSync(resolve(process.cwd(), 'pnpm-workspace.yaml'), 'utf8'),
  );
  if (problems.length > 0) {
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      `[bulk-audit] auditConfig.ignoreGhsas in pnpm-workspace.yaml breaks the accepted-advisory policy (${problems.length} problem(s)).`,
    );
    process.exit(1);
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

  let advisories;
  let newest;
  try {
    /** @type {Record<string, Array<{id: number, title: string, severity: string, url: string, vulnerable_versions: string}>>} */
    advisories = await fetchAdvisories(payload);
    newest = await checkNewestReleases(advisories, accepted);
  } catch (error) {
    console.error(
      `[bulk-audit] ${error instanceof Error ? error.message : String(error)} — failing loud.`,
    );
    process.exit(1);
  }

  const verdict = judgeAudit({ advisories, audited, level, accepted, newest, prodOnly });
  for (const line of verdict.failing) console.error(`  ${line}`);
  for (const line of verdict.belowThreshold) console.info(`  (below threshold) ${line}`);
  for (const line of verdict.accepted) console.info(`  ${line}`);
  for (const problem of verdict.acceptanceProblems) console.error(`  ${problem}`);

  const scope = prodOnly ? 'prod-reachable' : 'all';
  const reported = Object.values(advisories).reduce(
    (sum, entries) => sum + entries.length,
    0,
  );
  if (verdict.failing.length > 0) {
    console.error(
      `[bulk-audit] ${verdict.failing.length} advisory(ies) at ${level}+ across ${audited.size} ${scope} packages — fix or pin (overrides in pnpm-workspace.yaml).`,
    );
  }
  if (verdict.acceptanceProblems.length > 0) {
    console.error(
      `[bulk-audit] auditConfig.ignoreGhsas in pnpm-workspace.yaml is out of date (${verdict.acceptanceProblems.length} entry problem(s)) — an accepted advisory must have no fix published.`,
    );
  }
  if (verdict.failing.length > 0 || verdict.acceptanceProblems.length > 0)
    process.exit(1);
  const acceptedNote =
    verdict.accepted.length > 0
      ? `, ${verdict.accepted.length} accepted (no fix published, auditConfig.ignoreGhsas)`
      : '';
  const none = verdict.accepted.length > 0 ? 'none other' : 'none';
  console.info(
    `[bulk-audit] OK — ${audited.size} ${scope} packages, ${reported} advisory(ies) reported${acceptedNote}, ${none} at ${level}+.`,
  );
}

if (isMain(import.meta.url)) {
  await main();
}
