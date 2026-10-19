// The one copy of clinozy-fe's shell and secret-file rules, shared by the Claude guardrail
// (fe-guardrails.mjs) and its Cursor mirror (fe-cursor-shell-guard.mjs), so the two platforms can
// never block different commands.

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
