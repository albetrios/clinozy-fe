/**
 * no-static-branch-name — fail when app runtime code (src/) hardcodes the git
 * trunk name as a string literal instead of resolving it from configuration.
 *
 * The trunk name(s) come from tooling/setup/setup.config.json (git.defaultBranch
 * + git.protectedBranches), so this linter is itself config-driven — a renamed
 * trunk is picked up automatically. It flags quoted branch literals ('main',
 * "main"), origin/<branch>, and refs/heads/<branch>. It does NOT flag bareword
 * object keys (e.g. branchEnvironmentMap) or comments, and it skips test files —
 * app code should never embed a branch name, but the branch→env map and its
 * tests legitimately name branches.
 *
 * Usage: node --import tsx tooling/validate/no-static-branch-name.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface Violation {
  file: string;
  branch: string;
  line: number;
}

/** Read the configured trunk / protected branch names (deduped). */
export function configuredBranchNames(root = ROOT): string[] {
  const config = JSON.parse(
    readFileSync(join(root, 'tooling/setup/setup.config.json'), 'utf8'),
  ) as { git?: { defaultBranch?: string; protectedBranches?: string[] } };
  const git = config.git ?? {};
  return [
    ...new Set([git.defaultBranch, ...(git.protectedBranches ?? [])].filter(Boolean)),
  ] as string[];
}

const isComment = (line: string): boolean => {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
};

/**
 * Scan a single file's text for hardcoded branch literals. Returns the matched
 * branch names with 1-based line numbers. Comment lines are skipped.
 */
export function scanText(
  text: string,
  branchNames: string[],
): Array<{ branch: string; line: number }> {
  const patterns = branchNames.map((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // quoted 'main'/"main", origin/main, or refs/heads/main (bounded so
    // 'maintenance' / origin/maintenance never match).
    return {
      name,
      regex: new RegExp(
        `(['"]${escaped}['"]|(?:origin|refs/heads)/${escaped}(?![\\w-]))`,
      ),
    };
  });
  const hits: Array<{ branch: string; line: number }> = [];
  text.split('\n').forEach((line, index) => {
    if (isComment(line)) return;
    for (const { name, regex } of patterns) {
      if (regex.test(line)) hits.push({ branch: name, line: index + 1 });
    }
  });
  return hits;
}

const isTestFile = (name: string): boolean => /\.(test|spec)\.(ts|tsx)$/.test(name);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__') continue;
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry) && !isTestFile(entry)) {
      yield full;
    }
  }
}

/** Walk src/ and collect every hardcoded-branch violation. */
export function findViolations(root = ROOT): {
  branchNames: string[];
  violations: Violation[];
} {
  const branchNames = configuredBranchNames(root);
  const violations: Violation[] = [];
  for (const file of walk(join(root, 'src'))) {
    for (const hit of scanText(readFileSync(file, 'utf8'), branchNames)) {
      violations.push({ file: file.replace(`${root}/`, ''), ...hit });
    }
  }
  return { branchNames, violations };
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { branchNames, violations } = findViolations();
  if (violations.length > 0) {
    console.error(
      `✖ Hardcoded trunk name(s) [${branchNames.join(', ')}] in app code:\n${violations
        .map((v) => `  ${v.file}:${v.line} → "${v.branch}"`)
        .join(
          '\n',
        )}\n  Resolve the branch from tooling/setup/setup.config.json (git.defaultBranch) instead.`,
    );
    process.exit(1);
  }
  console.info(
    `no-static-branch-name: OK (src/ has no hardcoded ${branchNames.join('/')} literal).`,
  );
}
