# Ditto intake — clinozy-fe appendix

**The checklist itself is global and project-agnostic:**
`~/.claude/design-intake-checklist.md`

Use it for any project. This file holds only the clinozy-fe-specific rules that
layer on top — keep project constraints here, never in the global file.

---

## Where clinozy-fe constrains the answer

| Global section  | clinozy-fe rule                                                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A3 tables/cards | shadcn primitives only — see `agent-os/skills/shadcn/SKILL.md`. Do not hand-roll a table.                                                                        |
| A5 popup shape  | Dialog and Sheet both exist as shadcn primitives. Sheet is the bottom-sheet/drawer shape.                                                                        |
| A8 icons        | Import from `@/shared/icons/index.ts` — never `lucide-react` directly (eslint-enforced). Library is swappable via one file: lucide / tabler / phosphor.          |
| A11 copy        | No hardcoded user-facing strings. Every string is an i18n key in `src/locales/<lang>/*.json` with a `*_KEYS` constant. New namespaces need a dev-server restart. |
| A12 tokens      | **Semantic tokens only** — `bg-background`, never `bg-emerald-400`. Enforced by `pnpm validate:tokens`. OKLCH, light + dark, 19 axes.                            |
| A12 fonts       | CSP is `font-src 'self'` — fonts must be self-hosted (Fontsource). A CDN font link will be blocked.                                                              |
| A2 breakpoints  | Tailwind v4 defaults; mobile shell is the `AppLayout` bottom nav.                                                                                                |

## Theme handoff

For the preset itself (tokens, axes, registration), use the contract in this
folder rather than A12 alone:

- [README.md](README.md) — the two intake paths (DesignSync MCP vs prompt)
- [design-handoff.contract.json](design-handoff.contract.json) — 19 axes, 33 semantic tokens
- [claude-theme-preset.json](claude-theme-preset.json) — worked example with verified ratios

A `tokens` preset must be registered in **four** places or it fails to paint,
flashes on load, or is unreachable from the picker. The list is in the README.

## clinozy-fe DONE gate

Replace the global "comparative DONE" with these concrete commands:

```bash
pnpm validate:tokens        # no raw palette classes
pnpm validate:theme-axis    # 18-axis compliance
pnpm validate:structure     # route-island colocation
pnpm validate:testids       # page/form/shell test ids
pnpm type-check && pnpm lint
```

Plus, per screen: **side-by-side screenshot, source vs implementation, at 375px
and 1440px, per state.** None of the commands above can detect a fidelity
defect — only the comparison can.

## Evidence base

The global checklist's Part C was derived from the 2026-07-20 Flowdm migration in
this repo. Measured from the session transcript: **13 of 34 user turns** were
repeat requests to match the source HTML. The words "wizard", "step", "sheet",
"popup", "mobile", "responsive" and "dry run" appear **zero times** in the
416-line plan at
[`../plans/2026-07-20-clinozy-fe-claude-theme-and-app-plan.md`](../plans/2026-07-20-clinozy-fe-claude-theme-and-app-plan.md).

That plan also scoped the legacy HTML to Part I (theme tokens) while treating a
different codebase as the source for Part II (screens) — so "screens come from
the HTML" was never actually written down. Name one authoritative source per
deliverable.
