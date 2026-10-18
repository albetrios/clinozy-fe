---
name: fe-kickoff-iteration
description: Build an approved design iteration from its KICKOFF.md ledger, one row at a time through fe-design-ditto, verified and recorded in AS-BUILT.md. Use for kickoff or 'kickoff iteration <name>'.
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

Eligible = Status `approved` (not yet `implementing`), and Baseline `none` (from
scratch, the default) or an iteration the user named that is `done` or `frozen` —
a build never starts on an unbuilt Baseline. A **lite** fix (README Process `lite`) is
eligible in `planning` once the user gave the go on its `KICKOFF.md` (fe-iteration-planning ›
Lite mode). **Under `--both`** (the same-named iteration exists in clinozy-be) it is eligible only
once clinozy-be's `plans/routes-final.md` carries its `**Route review final — <date>.**` line
under the title: every sub-domain is confirmed, so the frontend builds on final routes — without
waiting for the backend's plan approval or build. No line yet → not eligible (Why: "route review
not final"). If the line disappears during the build (a sub-domain reopened), stop before the next
row that uses those routes and ask. Recommend the earliest-opened eligible
iteration (the launch always comes first). If the user named one, check it against
the rule. Confirm the iteration with **AskUserQuestion** — never pick silently —
and never ask about or suggest a Baseline: it is whatever planning recorded.

Once confirmed, **the gate**:

```bash
pnpm iteration:intake <iteration> --check
```

**Gate rule:** if it exits non-zero, stop now — write nothing, change no status, ask nothing
else; print the command's output and end the turn. The intake has to be fixed (and the plan
re-approved if it changed) before any build. A lite fix with no drop placed (Drop placed `—`) has
no intake to gate — the gate would only say "no intake yet" — so it is skipped; with a drop it runs.

When it passes: `pnpm iteration:status <iteration> implementing` (a lite fix moves there straight
from `planning`), and create `AS-BUILT.md` from
the skeleton below, dated today, with the Baseline's Standing deviations copied in as the starting
list (empty for an iteration from scratch).

**Offer the goal.** Show the user one `/goal` line they can set to let the build run on without a
stop after every row (Claude Code keeps working until its condition holds). Its condition is this
iteration's Close, named concretely:

```text
/goal iteration <iteration> is done: every KICKOFF.md ledger row done (or deferred with my OK) with
its AS-BUILT.md row; pnpm validate:tokens, validate:theme-axis, validate:structure,
validate:testids, type-check and lint green; the colocated tests and the full visual baseline set
green; AS-BUILT.md Summary and Standing deviations written; Status done. Stop and ask on a scope
change or a RED question.
```

Setting it is the user's choice — never set it yourself. Under a goal: a row ends with its
`AS-BUILT.md` row and a one-line report instead of a stop, its `Reviewed` cell stays `—` until
Close; a decision the plan left open is taken as the recommendation and logged in
`plans/decisions.md` as AMBER, sourced `user /goal <date>`; a scope change or a RED question still
stops and asks — a goal never widens the scope.

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
   the preset, the shell replacing the old design, `fe-route-island` /
   `fe-page-scaffolding` for islands, and so on).
2. **Verify** — the row's tests first: `pnpm test:select --run` (the tests the row's changes
   reach, with why — `pnpm test:select --why`; a change on the escalation list runs the whole
   suite), green before the comparison. Then the row's Acceptance, by the README's Intake mode:
   - **`full` / `overlay`** — a screen gets a **side-by-side comparison against
     the source at 375px and 1440px, per state** — the prototype open in the
     browser pane beside the app, or the md walked field by field — and the
     per-screen UI walk ([Adoption](../../../docs/design-workflow/process/adoption.md)).
   - **`brief`** — there is no new design source: the row meets the `BRIEF.md`
     acceptance criteria it covers, and the screens it touches still match their
     carried-forward specs except where the brief changes them.

   MODE incremental, every mode: verify the changed screens **and** re-run the
   full baseline set; an unexpected diff on an untouched screen is a finding,
   not a baseline to bless.
3. **Record** — add the row's `AS-BUILT.md` entry: planned · actually built ·
   difference · why · decision link · commit — and the test run (files and result) in its
   Actually built cell. Set the ledger row's Status. Where
   the build now differs from the design on purpose, add a **Standing
   deviation** (item · design says · built as · since iteration · decision);
   where this row resolves one, remove it.
4. **Check the impact on upcoming rows.**
   - **Small, inside the row** (a prop renamed, a component split): record it in
     the entry and continue.
   - **Scope** — a row added or removed, an Acceptance changed, the order
     changed: **stop and ask** with **AskUserQuestion**. Record the decision in
     `plans/decisions.md` (Kind `SCOPE`) and in `AS-BUILT.md` › Revisions to
     upcoming rows (the revised row text), and mark the KICKOFF ledger row
     `revised → AS-BUILT #n` — the only edit KICKOFF.md gets besides Status.
5. **Stop for the user's review** — show the comparison and the entry, and wait
   before the next row (under a `/goal`, a one-line report instead — Step 0). **This review is the row's review of record:** on the user's OK, fill the
   row's `Reviewed` cell (date · who · the commit reviewed). A change they ask for is made,
   verified and shown again before the cell is filled.

## Close

- **Verification:** the static design gates —
  `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure && pnpm validate:testids && pnpm type-check && pnpm lint`
  — the colocated tests, and the full visual baseline set
  (`fe-visual-regression`).
- **The ledger is closed:** every row `done`, or `deferred` with the user's OK
  recorded. An open row means not done — say so and keep going.
- **The goal's condition.** When a `/goal` was set, check each of its criteria now, one line each
  with its evidence (the command and its result, or the file and section), before
  `pnpm iteration:status <iteration> done`. A criterion not met is work to finish, not a note; the
  goal is met only when every line is. The rows built under it are reviewed now (next item).
- **The per-row reviews are the review of record.** Every `AS-BUILT.md` row has its `Reviewed`
  cell; a row without one is reviewed now, before close. The PR's human review then covers what
  changed after each row's reviewed commit (and the close), not the rows again.
- **`AS-BUILT.md` › Summary:** planned but not built (deferred, user OK), built
  but not planned, follow-ups for the next iteration.
- **`AS-BUILT.md` › Standing deviations:** the complete list of where the code
  now differs from the design — the Baseline's list (none from scratch), minus
  what this iteration resolved, plus its new ones. A later iteration reads it
  when the user names this one as its Baseline.
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

| # | Ledger row | Planned | Actually built | Difference | Why | Decision | Commit | Reviewed |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Revisions to upcoming rows

| # | Ledger row | Revised row | Decision |
| --- | --- | --- | --- |

## Summary

- **Planned, not built** (deferred, user OK): —
- **Built, not planned:** —
- **Follow-ups for the next iteration:** —

## Standing deviations

| Item | Design says | Built as | Since iteration | Decision |
| --- | --- | --- | --- | --- |
```

Entries are numbered `#1`, `#2`, … in the order rows are built; a revision cites
the entry that caused it.

## Failure modes this skill exists to prevent

| Failure                                                             | Prevention here                                 |
| ------------------------------------------------------------------- | ----------------------------------------------- |
| The wrong iteration built, or one built on an unbuilt Baseline      | Step 0 eligibility table + AskUserQuestion      |
| A build on an incomplete or edited intake                           | Step 0 gate (`iteration:intake --check`)        |
| A deliberate difference from the design that nobody can find later  | Standing deviations, carried forward            |
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
