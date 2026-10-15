# KICKOFF — fix-photo-compare-first-paint-2026-10-15-icne

> The plan and the ordered ledger for a correction from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                                                |
| ------------- | -------------------------------------------------------------------- |
| Iteration     | `fix-photo-compare-first-paint-2026-10-15-icne`                      |
| Mode          | initial — from scratch                                               |
| Baseline      | `none` ([D2](plans/decisions.md))                                    |
| Intake mode   | brief — `BRIEF.md` alone                                             |
| Intake hash   | `bb183aae7a4b` (gate passed 2026-10-15)                              |
| Schema-routes | — (no entity or route changes)                                       |
| Sources       | `intake-files/BRIEF.md`, CI's `Build verify` log, `images.search.ts` |
| Sibling       | none — clinozy-be changes nothing                                    |

## 2. Locked decisions

1. **D1** — A `fix` iteration: the two it corrects are frozen.
2. **D2** — Baseline `none`, brief mode; the same branch and pull request; approved on the user's request.
3. **D3** — The validator stops reading `compare`; the router passes it through; the page parses it.

## 3. Verification

| Criterion (`BRIEF.md`)                 | Proof                                     |
| -------------------------------------- | ----------------------------------------- |
| CI's `pnpm size` passes (`:36`)        | CI `Build verify` on the pushed head      |
| the comparison from the URL (`:37`)    | `PatientImagesPage`, `PhotoCompare` tests |
| the validator leaves `compare` (`:38`) | `images.search.test.ts`                   |

## 4. The route — the ordered ledger

| #   | Work item                                                     | Kind   | Depends on | Skill/driver           | Acceptance      | Assignee | Status |
| --- | ------------------------------------------------------------- | ------ | ---------- | ---------------------- | --------------- | -------- | ------ |
| L-1 | The validator stops reading `compare`; its test; the overview | change | —          | fe-bundle-performance  | §3 rows 2–3     | Claude   | done   |
| L-2 | Gates, push, CI green                                         | gate   | L-1        | fe-before-commit-guard | §3 row 1        | Claude   | done   |
| L-3 | Close: `AS-BUILT.md`, Status `done`, then `frozen`            | verify | L-2        | fe-kickoff-iteration   | README `frozen` | Claude   | done   |
