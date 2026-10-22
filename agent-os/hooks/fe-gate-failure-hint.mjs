#!/usr/bin/env node
// Claude Code PostToolUseFailure hook (Bash) for clinozy-fe.
//
// When a known clinozy-fe gate fails, inject a concise hint with the fix command + owning skill —
// turning a raw non-zero exit into a fix path. The one non-gate rule is the pnpm flag pnpm 12
// rejects outright (`-s`), so the next try is right. Scoped to those: an ordinary failed command
// (a grep with no match, a test mid-TDD) produces no output, so this never nags.
//
// Adds context via hookSpecificOutput.additionalContext (PostToolUseFailure cannot block — the
// command already ran). Fails OPEN.
import { addModelContext, readHookPayload } from './_fe-hook.mjs';
import { recordTelemetry } from './_fe-telemetry.mjs';

/** The fix hint each failed gate implies, matched on the lowercased command, in order. */
const GATE_HINTS = [
  [
    /\bpnpm\s+-s\b/,
    'pnpm 12 has no -s shorthand → pnpm --silent <script>, or plain pnpm <script>',
  ],
  [
    /validate:tokens/,
    'raw color token → use semantic tokens (bg-background/text-success/bg-brand), never raw palette; vendored components/ui/ is exempt (frontend-design)',
  ],
  [
    /validate:structure/,
    'route-island structure → every page needs <page>.route.tsx + .manifest.ts + <Page>Page.tsx + OVERVIEW.md, and every component/hook a colocated *.test.ts(x) (fe-route-island / fe-test-generation)',
  ],
  [
    /docs:lint/,
    'markdown lint → fix MD0xx (ordered-list prefixes, fenced-code language); emphasis style follows Prettier (fe-documentation-maintenance)',
  ],
  [
    /tsdoc/,
    'TSDoc budget → add a summary to new exports; budget tooling/tsdoc-coverage/budget.json is a raise-only ratchet',
  ],
  [
    /pnpm tsc|tsc -b|tsc --noemit|type-check|typecheck/,
    'type errors → pnpm tsc for the full list; never use any (use unknown + narrow)',
  ],
  [
    /\blint\b|biome[: ]check|eslint/,
    'lint → pnpm lint:fix for autofixable; warnings via fe-lint-guard',
  ],
  [
    /format|prettier/,
    'formatting → pnpm format (Prettier + prettier-plugin-tailwindcss owns formatting)',
  ],
  [
    /vitest|pnpm test|coverage/,
    "tests → fix the failing spec; coverage is a raise-only ratchet (vitest.config.ts) — add tests, don't lower it (fe-test-generation)",
  ],
  [
    /playwright| e2e/,
    'e2e → check the trace; visual baselines update with --update-snapshots after an intentional UI change (fe-e2e-testids)',
  ],
  [
    /pnpm health/,
    'health = all phases — run the failing phase alone (tsc / lint / test / validate:*) for detail; pnpm health:fix auto-fixes (fe-project-health-check)',
  ],
];

const command = readHookPayload()?.tool_input?.command;
const lower = typeof command === 'string' ? command.toLowerCase() : '';
const hints = lower
  ? GATE_HINTS.filter(([pattern]) => pattern.test(lower)).map(([, hint]) => hint)
  : [];
if (hints.length > 0) {
  addModelContext({
    event: 'PostToolUseFailure',
    context: [
      '⚡ clinozy-fe command failed — likely fix:',
      ...hints.map((hint) => `  • ${hint}`),
      'Skill map: agent-os/docs/skill-triggers.md',
    ].join('\n'),
  });
}
recordTelemetry(
  'fe-gate-failure-hint',
  'PostToolUseFailure',
  hints.length > 0 ? 'fired' : 'silent',
);
process.exit(0);
