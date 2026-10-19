#!/usr/bin/env node
/**
 * Documentation staleness scanner — semantic docs↔code drift canary.
 *
 * The deterministic drift gates (route-islands, testids, i18n, project-tree,
 * agent-os wiring) catch STRUCTURAL drift a single commit can break, so they
 * live in the blocking PR lane. This scanner catches the OTHER class: prose in
 * docs/skills/rules that references a code path or symbol which no longer
 * exists. No single commit "breaks" it — it accretes silently across renames
 * and deletions (e.g. a doc still saying `src/stores/` after the folder became
 * `src/shared/store/`). That makes it a weekly ADVISORY canary, not a gate:
 * `sync-drift-canary.yml` runs it and files a tracked issue on findings.
 *
 * Two reference classes are checked, both extracted from Markdown inline-code
 * spans (`` `like this` ``) and fenced code blocks:
 *
 *   PATHS   — a token rooted at a known top-level dir (src/, tooling/, tests/,
 *             agent-os/, docs/, .github/, …) must resolve to a file or dir on
 *             disk. Line suffixes (`:42`), trailing slashes, and `$param`
 *             folders are handled; glob tokens resolve their literal prefix.
 *
 *   SYMBOLS — convention-scoped, high-signal only (INLINE spans only, never
 *             fenced examples): Zustand stores (`use<X>Store`), hooks
 *             (`use<X>`), and explicit call forms (`fn()`). Each must be an
 *             actual `export` somewhere in src/. Library hooks (useState,
 *             useQuery, …) are stop-listed so they are not mistaken for ours.
 *
 * Intentional references (illustrative example paths, planned-but-unbuilt
 * symbols) live in tooling/ci/doc-staleness-allowlist.json with a reason —
 * same no-silent-suppressions policy as knip.jsonc / contract-drift-allowlist.
 *
 * Usage:
 *   pnpm docs:staleness           human-readable report; exit 1 on findings
 *   node …/check-doc-staleness.mjs --json    machine-readable findings array
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git } from './git-environment.mjs';
import { parseCommandLine } from './script.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '../..');
const ALLOWLIST_FILE = join(ROOT, 'tooling/ci/doc-staleness-allowlist.json');
const SKILLS_LOCK = join(ROOT, 'agent-os/skills-lock.json');
const JSON_MODE =
  parseCommandLine(process.argv.slice(2), { options: { json: { type: 'boolean' } } })
    .values.json === true;

// ── What to scan ────────────────────────────────────────────────────────────
// The doc trees plus the root guidance files that reference code paths.
const SCAN_DIRS = ['docs', 'agent-os'];
const SCAN_ROOT_FILES = ['CLAUDE.md', 'AGENTS.md', 'README.md', 'CONTRIBUTING.md'];
// The nested CLAUDE.md files that hold sections moved out of the root one (Claude Code loads each
// when it works in that folder).
const SCAN_NESTED_GUIDES = [
  'src/pages/CLAUDE.md',
  'src/shared/CLAUDE.md',
  'src/core/CLAUDE.md',
  'src/app/CLAUDE.md',
  'iterations/CLAUDE.md',
  '.github/CLAUDE.md',
  'tests/CLAUDE.md',
];
const SCAN_EXTS = /\.(md|mdc)$/;
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'test-results']);

// Top-level dirs a repo-path token may be rooted at. A token must start with
// one of these (followed by `/`) to be treated as a path claim — this is what
// keeps relative tree-notation (`login/`, `$param/`) out of the path scan.
const PATH_ROOTS = [
  'src',
  'tooling',
  'tests',
  'agent-os',
  'docs',
  'plugins',
  'public',
  'scripts',
  '.github',
  '.husky',
  '.claude',
  '.cursor',
  '.codex',
  '.vscode',
];

// Library hooks that match our `use<X>` shape but are NOT our exports.
const HOOK_STOPLIST = new Set([
  'useState',
  'useEffect',
  'useRef',
  'useMemo',
  'useCallback',
  'useContext',
  'useReducer',
  'useId',
  'useLayoutEffect',
  'useImperativeHandle',
  'useSyncExternalStore',
  'useTransition',
  'useDeferredValue',
  'useActionState',
  'useOptimistic',
  'useFormStatus',
  'useQuery',
  'useMutation',
  'useQueryClient',
  'useInfiniteQuery',
  'useSuspenseQuery',
  'useForm',
  'useFormContext',
  'useController',
  'useFieldArray',
  'useWatch',
  'useNavigate',
  'useRouter',
  'useSearch',
  'useParams',
  'useMatch',
  'useMatches',
  'useLocation',
  'useRouterState',
  'useBlocker',
  'useLoaderData',
  'useTranslation',
  'useTheme',
  'useMediaQuery',
  'useDebounce',
  // framer-motion / react-spring / motion — match use<X> but are external libs,
  // referenced by design skills (emil-design-eng et al.), not clinozy-fe exports.
  'useSpring',
  'useSprings',
  'useInView',
  'useScroll',
  'useTransform',
  'useMotionValue',
  'useMotionValueEvent',
  'useMotionTemplate',
  'useAnimate',
  'useAnimation',
  'useAnimationControls',
  'useAnimationFrame',
  'useDragControls',
  'useReducedMotion',
  'useVelocity',
  'useTime',
  'useTrail',
  'useChain',
  'usePresence',
  'useCycle',
  'useMemoCache', // React Compiler internal, referenced in upgrade docs
]);

// ── Allowlist ───────────────────────────────────────────────────────────────
function loadAllowlist() {
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf8'));
    const paths = new Set(
      (raw.paths ?? []).map((e) => (typeof e === 'string' ? e : e.value)),
    );
    const symbols = new Set(
      (raw.symbols ?? []).map((e) => (typeof e === 'string' ? e : e.value)),
    );
    return { paths, symbols };
  } catch {
    return { paths: new Set(), symbols: new Set() };
  }
}

// ── File walking ────────────────────────────────────────────────────────────
function walk(dir, filter, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), filter, out);
    } else if (filter(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/**
 * Vendored skills (recorded in agent-os/skills-lock.json) are external — they
 * reference other libraries' paths/symbols and are not clinozy-fe's to keep in
 * sync. Excluding their directories keeps the scanner about OUR docs↔code.
 */
function vendoredSkillDirs() {
  try {
    const lock = JSON.parse(readFileSync(SKILLS_LOCK, 'utf8'));
    return Object.values(lock.skills ?? {})
      .map((s) => dirname(s.skillPath)) // agent-os/skills/<name>/SKILL.md → dir
      .filter(Boolean);
  } catch {
    return [];
  }
}

function docFiles() {
  const excluded = vendoredSkillDirs();
  const isExcluded = (full) => {
    const rel = relative(ROOT, full);
    return excluded.some((dir) => rel === dir || rel.startsWith(`${dir}/`));
  };
  const files = [];
  for (const d of SCAN_DIRS) files.push(...walk(join(ROOT, d), (n) => SCAN_EXTS.test(n)));
  for (const f of [...SCAN_ROOT_FILES, ...SCAN_NESTED_GUIDES]) {
    const full = join(ROOT, f);
    if (existsSync(full)) files.push(full);
  }
  return files.filter((full) => !isExcluded(full));
}

// ── Known symbols (exports across src/) ─────────────────────────────────────
const EXPORT_DECL =
  /export\s+(?:default\s+)?(?:async\s+)?(?:abstract\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g;
const EXPORT_LIST = /export\s*\{([^}]*)\}/g;

function collectKnownSymbols() {
  const symbols = new Set();
  const srcFiles = walk(join(ROOT, 'src'), (n) => /\.(ts|tsx)$/.test(n));
  for (const file of srcFiles) {
    const content = readFileSync(file, 'utf8');
    let m;
    while ((m = EXPORT_DECL.exec(content)) !== null) symbols.add(m[1]);
    while ((m = EXPORT_LIST.exec(content)) !== null) {
      for (const part of m[1].split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+/)
          .pop()
          ?.trim();
        if (name && /^[A-Za-z_$][\w$]*$/.test(name)) symbols.add(name);
      }
    }
  }
  return symbols;
}

// ── Inline-span + fenced-block extraction ───────────────────────────────────
const INLINE_SPAN = /`([^`\n]+)`/g;

/**
 * Yield { code, line, fenced } for every code span in a Markdown file:
 * inline `spans` on prose lines, and each line inside ``` fenced blocks ```.
 */
function* codeSpans(content) {
  const lines = content.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceToggle = /^\s*(```|~~~)/.test(line);
    if (fenceToggle) {
      inFence = !inFence;
      continue; // the ``` line itself carries no reference
    }
    if (inFence) {
      yield { code: line, line: i + 1, fenced: true };
      continue;
    }
    let m;
    INLINE_SPAN.lastIndex = 0;
    while ((m = INLINE_SPAN.exec(line)) !== null) {
      yield { code: m[1], line: i + 1, fenced: false };
    }
  }
}

// ── Path checking ───────────────────────────────────────────────────────────
const ROOT_ALT = PATH_ROOTS.map((r) => r.replace(/\./g, '\\.')).join('|');
const PATH_TOKEN = new RegExp(`(?:^|[\\s(])((?:${ROOT_ALT})/[A-Za-z0-9._$*/-]+)`, 'g');

/**
 * References resolve against GIT-TRACKED paths, not the working directory — the
 * same determinism the project-tree generator relies on. A doc that references
 * a gitignored per-developer local file (`agent-os/mcp/mcp.json`,
 * `.claude/settings.local.json`) must not pass on a contributor's machine and
 * then fail on a fresh CI checkout; only committed paths count as "the repo".
 * The set holds every tracked file plus all of its parent directories, so both
 * file and directory references resolve. Falls back to the filesystem only when
 * git is unavailable.
 */
function loadTrackedPaths() {
  try {
    const out = git(['ls-files', '-z'], { cwd: ROOT });
    const set = new Set();
    for (const file of out.split('\0')) {
      if (!file) continue;
      set.add(file);
      let dir = file;
      let slash = dir.lastIndexOf('/');
      while (slash !== -1) {
        dir = dir.slice(0, slash);
        set.add(dir);
        slash = dir.lastIndexOf('/');
      }
    }
    return set;
  } catch {
    return null; // git unavailable → fall back to fs.existsSync
  }
}

const TRACKED = loadTrackedPaths();

function pathPresent(relPath) {
  return TRACKED ? TRACKED.has(relPath) : existsSync(join(ROOT, relPath));
}

function normalizePath(token) {
  let p = token.replace(/[.,:;)]+$/, ''); // trailing prose punctuation
  p = p.replace(/:\d+(?:-\d+)?$/, ''); // :line or :line-range suffix
  p = p.replace(/\/+$/, ''); // trailing slash (dir)
  return p;
}

function pathResolves(token) {
  const p = normalizePath(token);
  if (!p) return true;
  if (p.includes('*')) {
    // Glob: resolve the literal prefix directory only.
    const prefix = p.slice(0, p.indexOf('*')).replace(/\/[^/]*$/, '');
    return prefix ? pathPresent(prefix) : true;
  }
  return pathPresent(p);
}

/**
 * A path token is a TEMPLATE (skip it), not a concrete claim, when it holds a
 * metavariable rather than a literal path:
 *   • truncated at an angle placeholder — `src/shared/store/use<X>Store/`
 *     captures as `src/shared/store/use` with `<` as the next source char;
 *   • an UPPERCASE `$METAVAR` segment (`src/pages/$PAGE`) — real TanStack param
 *     folders are lowercase-first (`$organizationSlug`) and resolve on disk;
 *   • any leftover angle/brace placeholder inside the token.
 */
function isTemplateToken(raw, code, matchEnd) {
  // Truncation at an angle/brace placeholder: `use<X>Store/`, `use{List,One}/`.
  if (code[matchEnd] === '<' || code[matchEnd] === '{') return true;
  if (raw.split('/').some((seg) => /^\$[A-Z]/.test(seg))) return true;
  return /[<>{}]/.test(raw);
}

function scanPaths(code, allowPaths) {
  const hits = [];
  let m;
  PATH_TOKEN.lastIndex = 0;
  while ((m = PATH_TOKEN.exec(code)) !== null) {
    const raw = m[1];
    if (isTemplateToken(raw, code, m.index + m[0].length)) continue;
    const p = normalizePath(raw);
    if (allowPaths.has(p) || allowPaths.has(raw)) continue;
    if (!pathResolves(raw)) hits.push({ kind: 'path', token: p });
  }
  return hits;
}

// ── Symbol checking (inline spans only) ─────────────────────────────────────
// Convention-scoped and high-signal by design: only our Zustand stores
// (`use<X>Store`) and hooks (`use<X>`) are verified against real src/ exports.
// A generic `fn()` call-form scan was tried and dropped — in prose it matched
// every CSS function (`clamp()`, `translate()`) and library call (`clsx()`,
// `toast()`) with no true positives. Library hooks are stop-listed above.
const STORE_RE = /^use[A-Z][A-Za-z0-9]*Store$/;
const HOOK_RE = /^use[A-Z][A-Za-z0-9]+$/;

function scanSymbols(code, known, allowSymbols) {
  const hits = [];
  // Only WHOLE-span tokens are treated as symbol claims (high-signal).
  const token = code.trim();
  const bare = token.replace(/\(\)$/, ''); // tolerate a trailing () on a ref

  if (allowSymbols.has(token) || allowSymbols.has(bare)) return hits;

  if (STORE_RE.test(bare) || HOOK_RE.test(bare)) {
    if (HOOK_STOPLIST.has(bare)) return hits;
    if (!known.has(bare)) hits.push({ kind: 'symbol', token: bare });
  }
  return hits;
}

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
  const allow = loadAllowlist();
  const known = collectKnownSymbols();
  const findings = [];
  const seen = new Set(); // dedupe identical (file, token) pairs

  for (const file of docFiles()) {
    const rel = relative(ROOT, file);
    const content = readFileSync(file, 'utf8');
    for (const span of codeSpans(content)) {
      const hits = [
        ...scanPaths(span.code, allow.paths),
        ...(span.fenced ? [] : scanSymbols(span.code, known, allow.symbols)),
      ];
      for (const hit of hits) {
        const key = `${rel}::${hit.kind}::${hit.token}`;
        if (seen.has(key)) continue;
        seen.add(key);
        findings.push({ file: rel, line: span.line, ...hit });
      }
    }
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  if (JSON_MODE) {
    process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
    process.exit(findings.length > 0 ? 1 : 0);
  }

  if (findings.length === 0) {
    console.log('Doc staleness OK — every referenced path and symbol resolves.');
    process.exit(0);
  }

  console.error(`Doc staleness: ${findings.length} stale reference(s):\n`);
  let lastFile = '';
  for (const f of findings) {
    if (f.file !== lastFile) {
      console.error(`  ${f.file}`);
      lastFile = f.file;
    }
    console.error(
      `    ${f.line}:  ${f.kind === 'path' ? 'dead path  ' : 'dead symbol'}  ${f.token}`,
    );
  }
  console.error(
    '\nFix the reference, or if it is intentional (illustrative example, planned symbol)' +
      '\nadd it with a reason to tooling/ci/doc-staleness-allowlist.json.',
  );
  process.exit(1);
}

main();
