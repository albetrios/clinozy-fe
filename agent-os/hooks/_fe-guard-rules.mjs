// The one copy of clinozy-fe's guard rules: the shell and secret-file rules, shared by the Claude
// guardrail (fe-guardrails.mjs) and its Cursor mirror (fe-cursor-shell-guard.mjs), so the two
// platforms can never block different commands, and the edit rules the edit guard
// (fe-guard-edits.mjs) enforces — the shape of clinozy-be's _be-guard-rules.mjs.

/**
 * A gitignored env file that holds real values: `.env`, `.env.local`, `.env.<environment>`, … —
 * never the committed template `.env.example`.
 */
export function isSecretEnvPath(path) {
  if (!path) return false;
  if (/(^|\/)\.env\.example$/.test(path)) return false;
  return /(^|\/)\.env(\.[\w.-]+)?$/.test(path);
}

/** `command` with heredoc bodies and quoted strings blanked out. */
export function withoutQuotedText(command) {
  return command
    .replace(/<<-?\s*['"]?[A-Za-z_]\w*['"]?[\s\S]*$/, ' ')
    .replace(/'[^']*'/g, ' ')
    .replace(/"[^"]*"/g, ' ');
}

/**
 * Why `command` must not run, or `''`: a recursive force delete, a force push, a fork bomb, a
 * filesystem-destroying command, or a skip of the git hooks.
 *
 * Quoted strings and heredoc bodies are removed first, so a pattern that merely appears in a
 * message (a commit message, an echo) never blocks.
 */
export function destructiveShellReason(command) {
  const scan = withoutQuotedText(command);
  if (/\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i.test(scan)) {
    return 'recursive force delete (rm -rf)';
  }
  if (
    /\bgit\s+push\b/i.test(scan) &&
    (/--force(?!-with-lease)/i.test(scan) || /\s-f(?:\s|$)/.test(scan))
  ) {
    return 'git push --force (use --force-with-lease, or push it yourself)';
  }
  if (/:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/.test(scan)) return 'fork bomb';
  if (/\bmkfs\b|\bdd\s+if=/i.test(scan)) return 'filesystem-destroying command';
  if (
    /\bgit(?:\s+-[cC]\s+\S+)*\s+(?:commit|push)\b[^;&|]*--no-verify\b/i.test(scan) ||
    /\bgit(?:\s+-[cC]\s+\S+)*\s+commit\b[^;&|]*\s-[a-zA-Z]*n[a-zA-Z]*(?=\s|$)/.test(
      scan,
    ) ||
    /(?:^|[\s;&|])HUSKY=0\b/.test(scan)
  ) {
    return 'skipping the git hooks (--no-verify, git commit -n, HUSKY=0) — the before-commit and pre-push gates are mandatory; fix what they report';
  }
  return '';
}

/** Generated files: change the source and regenerate instead (rule R1). */
const GENERATED_FILE = /(pnpm-lock\.yaml|skills-lock\.json)$|(^|\/)dist\//;

/** Application source, the only files rules R2–R4 judge. */
const SOURCE_FILE = /(^|\/)src\/.*\.tsx?$/;

/** Vendored shadcn primitives own the exceptions (raw colors, direct lucide-react). */
const VENDORED_INTERFACE = /\/components\/ui\/|^src\/components\/ui\//;

/**
 * The @/shared/icons surface, the one place allowed to import icon libraries directly (mirrors
 * eslint's src/shared/icons/** exemption and CLAUDE.md).
 */
const ICON_SURFACE = /\/shared\/icons\/|^src\/shared\/icons\//;

/**
 * Page islands are the inverse of R2: eslint's no-restricted-imports bans `@/pages/**` inside
 * src/pages, and its message mandates relative imports WITHIN an island.
 */
const PAGE_ISLAND = /\/src\/pages\/|^src\/pages\//;

// The content checks match within one line (whitespace other than a line break), as the grep
// that used to run them did.
const PARENT_RELATIVE_IMPORT = /(from|require|import)[^\S\n]*\(?[^\S\n]*['"]\.\.\//;
const LUCIDE_IMPORT = /(from|import|require)[^\S\n]*\(?[^\S\n]*['"]lucide-react['"]/;
const RAW_PALETTE_CLASS =
  /\b(bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow|caret|accent)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)\b/;

/**
 * The hard rules an edit breaks, in the order they are checked: `{ rule, decision, reason }`,
 * every `decision` a `deny`. Each mirrors a rule ESLint, a validator or CI already enforces, and
 * is mechanically unambiguous, so a normal edit is never blocked:
 *
 * - R1 a generated / do-not-edit file
 * - R2 a `../` parent-relative import added under src/ (use the @/ alias; page islands exempt)
 * - R3 a direct `lucide-react` import in app code (use @/shared/icons)
 * - R4 a raw Tailwind palette class in app code (use semantic tokens)
 *
 * They are clinozy-fe's conventions, so they judge only files in this repository
 * (`inRepository`); a session holding several repositories runs every repository's hooks on every
 * edit (tooling/agent-os/session-hooks.ts).
 */
export function editRuleViolations({ filePath, content, inRepository }) {
  const violations = [];
  if (!inRepository || !filePath) return violations;
  const base = filePath.split('/').pop();
  if (GENERATED_FILE.test(filePath)) {
    violations.push({
      rule: 'R1',
      decision: 'deny',
      reason: `'${base}' is generated — do not hand-edit it. Change the source and regenerate (lockfile via pnpm; dist/ via pnpm build; skills-lock via the skills CLI).`,
    });
  }
  if (!SOURCE_FILE.test(filePath)) return violations;
  const vendored = VENDORED_INTERFACE.test(filePath);
  if (!PAGE_ISLAND.test(filePath) && PARENT_RELATIVE_IMPORT.test(content)) {
    violations.push({
      rule: 'R2',
      decision: 'deny',
      reason:
        "Relative parent import ('../') is banned under src/ — use the '@/' alias with an explicit .ts/.tsx extension (CLAUDE.md → Import Conventions; enforced by ESLint).",
    });
  }
  if (!vendored && !ICON_SURFACE.test(filePath) && LUCIDE_IMPORT.test(content)) {
    violations.push({
      rule: 'R3',
      decision: 'deny',
      reason:
        "Import icons from '@/shared/icons/index.ts', not 'lucide-react' directly (CLAUDE.md → Import Conventions; eslint-enforced; vendored components/ui/ is exempt).",
    });
  }
  if (!vendored && RAW_PALETTE_CLASS.test(content)) {
    violations.push({
      rule: 'R4',
      decision: 'deny',
      reason:
        'Raw Tailwind palette class detected — use semantic tokens (bg-background, text-success, bg-brand, …), never raw palette colors (CLAUDE.md → Styling; enforced by pnpm validate:tokens; vendored components/ui/ is exempt).',
    });
  }
  return violations;
}
