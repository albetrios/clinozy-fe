---
name: fe-kickoff-iteration
description: Implement an approved design iteration — confirm which approved iteration to build (Step 0) and move it to implementing, then follow its KICKOFF.md ledger one row at a time — build each screen through fe-design-ditto, verify side by side at 375px and 1440px per state, write the AS-BUILT.md entry, check the impact on upcoming rows (a scope change stops for the user) and stop for review before the next row. Closes with the static design gates, the AS-BUILT summary and iteration:status done. Use when the user says "kickoff", "kickoff iteration <name>", "start implementing <iteration>". Requires README Status approved.
---

# Kickoff an iteration (build an approved `KICKOFF.md`, row by row)

The build half of the iteration workflow. **`fe-iteration-planning` wrote the
plan and the user approved it; this skill implements it** — one ledger row at a
time, through the row's own skill, recording what was actually built in
`AS-BUILT.md`. **Never push, open a PR or merge** — the user raises PRs.

The flow on one page: [`docs/design-workflow/process/README.md`](../../../docs/design-workflow/process/README.md).
The rules: [`iterations/README.md`](../../../iterations/README.md).

## Step 0 — Confirm the iteration. Stop until confirmed.

Run `pnpm iteration:list` and show:

| Iteration | Type | Baseline | Status | Eligible | Why |
| --------- | ---- | -------- | ------ | -------- | --- |

Eligible = Status `approved` (not yet `implementing`), and Baseline `none` or an
iteration that is `done` or `frozen` — a build never starts on an unbuilt
Baseline. Recommend the earliest-opened eligible iteration (the launch always
comes first). If the user named one, check it against the rule. Always ask with
**AskUserQuestion** — never pick silently.

Once confirmed: `pnpm iteration:status <iteration> implementing`, and create
`AS-BUILT.md` from the skeleton below, dated today.

## Step 1 — Read the approved plan. Stop.

Read `KICKOFF.md` in full, `plans/decisions.md` and the README. For each row
about to be built, read the intake files it cites at the cited lines —
`intake-files/` is locked and never edited. Show the ledger in route order and
the first row to build. **Stop.**

## The row loop — one row at a time

Follow the ledger in its order (respecting Depends on). For each row:

1. **Do** — through the row's Skill/driver. A screen row runs
   **`fe-design-ditto`** for that screen: theme first, then interaction shell →
   flow skeleton → regions (desktop and mobile together) → content → states →
   motion. A foundation row runs the skill it names (`fe-theme-axis-audit` for
   the preset, the shell variant made live, `fe-route-island` /
   `fe-page-scaffolding` for islands, and so on).
2. **Verify** — the row's Acceptance. A screen gets a **side-by-side comparison
   against the source at 375px and 1440px, per state** — the prototype open in
   the browser pane beside the app, or the md walked field by field — and the
   per-screen UI walk ([Adoption](../../../docs/design-workflow/process/adoption.md)).
   MODE incremental: verify the changed screens **and** re-run the full
   baseline set; an unexpected diff on an untouched screen is a finding, not a
   baseline to bless.
3. **Record** — add the row's `AS-BUILT.md` entry: planned · actually built ·
   difference · why · decision link · commit. Set the ledger row's Status.
4. **Check the impact on upcoming rows.**
   - **Small, inside the row** (a prop renamed, a component split): record it in
     the entry and continue.
   - **Scope** — a row added or removed, an Acceptance changed, the order
     changed: **stop and ask** with **AskUserQuestion**. Record the decision in
     `plans/decisions.md` (Kind `SCOPE`) and in `AS-BUILT.md` › Revisions to
     upcoming rows (the revised row text), and mark the KICKOFF ledger row
     `revised → AS-BUILT #n` — the only edit KICKOFF.md gets besides Status.
5. **Stop for the user's review** — show the comparison and the entry, and wait
   before the next row.

## Close

- **Verification:** the static design gates —
  `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure && pnpm validate:testids && pnpm type-check && pnpm lint`
  — the colocated tests, and the full visual baseline set
  (`fe-visual-regression`).
- **The ledger is closed:** every row `done`, or `deferred` with the user's OK
  recorded. An open row means not done — say so and keep going.
- **`AS-BUILT.md` › Summary:** planned but not built (deferred, user OK), built
  but not planned, follow-ups for the next iteration.
- `pnpm iteration:status <iteration> done`. `frozen` goes in the last commit
  before the iteration's branch merges; after that the folder is never edited —
  a correction is a new `fix` iteration.
- Never push, open a PR or merge.

## `AS-BUILT.md` skeleton

```markdown
# <iteration> — as built

What was actually built, ledger row by ledger row, against the approved plan in
[`KICKOFF.md`](KICKOFF.md). Started <YYYY-MM-DD>.

## Rows

| # | Ledger row | Planned | Actually built | Difference | Why | Decision | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Revisions to upcoming rows

| # | Ledger row | Revised row | Decision |
| --- | --- | --- | --- |

## Summary

- **Planned, not built** (deferred, user OK): —
- **Built, not planned:** —
- **Follow-ups for the next iteration:** —
```

Entries are numbered `#1`, `#2`, … in the order rows are built; a revision cites
the entry that caused it.

## Failure modes this skill exists to prevent

| Failure                                                             | Prevention here                                 |
| ------------------------------------------------------------------- | ----------------------------------------------- |
| The wrong iteration built, or one built on an unbuilt Baseline      | Step 0 eligibility table + AskUserQuestion      |
| Rows built in a batch, a wrong turn found late                      | One row at a time, a review stop after each     |
| "Done" from a functional check while the UI matches nothing         | Side-by-side at 375 and 1440 per state          |
| A token change that silently shifts an untouched screen             | Full baseline set on incremental iterations     |
| Scope that drifted without a decision                               | Impact check → stop, `decisions.md`, revision   |
| The plan and what shipped disagree with no record                   | `AS-BUILT.md` per row + summary                 |
| "Done" claimed with open rows                                       | The close: every row done or deferred (user OK) |

## Related

- `fe-iteration-planning` — the planning half; its approval is this skill's input
- `fe-design-ditto` — builds each screen faithfully to the source
- [`kickoff-iteration-prompt.md`](../../../docs/design-workflow/prompts/kickoff-iteration-prompt.md) — the paste prompt for this skill
- `fe-visual-regression` — pins the result once it matches
- [`iterations/README.md`](../../../iterations/README.md) — the iteration rules and commands
