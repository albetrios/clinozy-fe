---
description: Run the local validate gate (lint, types, structure, tokens) and fix issues you introduced
argument-hint: '[--affected] — show what git push will run and which tests the selection picks, and why'
allowed-tools: Bash(pnpm lint*), Bash(pnpm type-check*), Bash(pnpm validate*), Bash(pnpm biome*), Bash(pnpm test:affected*)
---

With `--affected`: run `pnpm test:affected` (the base is the upstream, else `origin/<trunk>`; pass
`--base <ref>` for another) and show its two tables as they are — the steps `.husky/pre-push` will
run for the pushed commits, each with why it runs or not, and the tests `pnpm test:select` picks,
each with why. Change nothing, then stop.

Without an argument, run the clinozy-fe local validate gate in order:

1. `pnpm lint`
2. `pnpm type-check`
3. `pnpm validate:structure` (route-island layout)
4. `pnpm validate:tokens` (semantic design tokens — no raw palette in app code)
5. `pnpm validate:testids` (page/form/shell `data-testid` contracts)
6. `pnpm validate:theme-axis` (theme preset axis compliance)

If all pass, report green and stop.

If any step fails:

1. Show the failing output.
2. Fix only the issues introduced by the current working-tree changes — do not
   mass-reformat or "fix" unrelated files.
3. Re-run the failing step(s), then the full sequence, until green.

Report the final status and what you changed.
