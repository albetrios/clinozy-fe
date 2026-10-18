# Design iterations — clinozy-fe

Claude Code loads this file when it works in `iterations/`. It holds sections moved out of the root [`CLAUDE.md`](../CLAUDE.md), which keeps a pointer to each; the root rules apply here too.

## Design iterations

A design change from Claude Design is an **iteration**: `iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/`
(type `launch | feat | change | fix`; one launch, no topic). It runs in two phases — the rules are in
`iterations/README.md`, a worked example in `docs/design-workflow/process/iteration-walkthrough.md`:

1. **Planning — no code.** `pnpm iteration:new <type> [topic] [--both]` opens the folder and its
   README; `pnpm iteration:intake <iteration> <source> [--mode full|overlay|brief] [--both]` stores
   **what arrived** in `intake-files/` (exactly as delivered) and checks the required set on the
   snapshot it resolves to. "plan iteration <name>" runs **`fe-iteration-planning`** (Steps 0–6, stopping after
   each; Steps 1–3 run back to back with one stop) → `KICKOFF.md` with its ordered ledger and `plans/decisions.md` → Status `ready-for-approval`.
   The user's approval → `approved`, which locks `intake-files/` and freezes `KICKOFF.md`; the step
   reviews are the plan's review of record, so the approval confirms them, not a second full read.
2. **Kickoff — build.** "kickoff iteration <name>" runs **`fe-kickoff-iteration`**: one ledger row at a
   time through its skill (screens through **`fe-design-ditto`**), verified by Intake mode (side by side
   at 375px and 1440px, or the `BRIEF.md` acceptance criteria), recorded in `AS-BUILT.md`; a scope change
   stops for the user. The user's review of each row is its review of record (its `Reviewed` cell
   in `AS-BUILT.md`); the PR's review covers only what changed after it. Then `done` — `AS-BUILT.md` closes with its **Standing deviations**, the complete
   list of where the code differs from the design — and `frozen` in the last commit before the merge. A
   frozen iteration is never edited; a correction is a new `fix`.

A small `fix` can run **lite** (`pnpm iteration:new fix <topic> --lite`, README Process `lite`):
`fe-iteration-planning` plans it in one step — `KICKOFF.md` and `plans/decisions.md`, one stop for
the user's go — and `fe-kickoff-iteration` moves it `planning → implementing → done → frozen`, with
no `ready-for-approval` or `approved`, and no drop needed.

- **Intake modes.** `full` — the whole drop (the launch is always full). `overlay` — only the changed
  files, laid over a named Baseline's snapshot. `brief` — no design files, only a written `BRIEF.md`
  ("implement these kinds of screens"; template `tooling/iterations/templates/BRIEF.md`): on its own
  from scratch, or added to a named Baseline's snapshot. An `overlay` or a `brief` stores only what
  arrived; a brief from scratch is its own whole snapshot, and otherwise every command resolves the
  rest from the Baseline chain, the Intake hash covering that resolved snapshot. An older intake that
  still stores copies of the Baseline's files is trimmed with
  `pnpm iteration:intake <iteration> --compact`, which never changes the snapshot or its hash. The
  README records the Intake mode, an Intake note and the Intake hash.
- **The gate.** `pnpm iteration:intake <iteration> --check [--baseline <baseline>]` proves the mandatory
  files are present and each Intake hash still matches; both skills run it first. When it exits
  non-zero, **stop at once** — write nothing, change no status, ask nothing else; print its output and
  end the turn.

- **Mode — from scratch by default.** Every iteration opens with Baseline `none` (MODE initial):
  never ask for a Baseline or suggest one, and take no earlier iteration or its files into account.
  Only when the user names one ("build on <iteration>") is it recorded (`pnpm iteration:baseline`) and
  the iteration incremental: the delta is then the designer's "What changed" plus
  `pnpm iteration:diff <baseline> <iteration>`, which compares the two resolved intakes only (in
  `brief` mode, `BRIEF.md` itself) — so a named Baseline's intake is mandatory — and planning reads its
  Standing deviations. Either way planning reads the current code: what was built beats what was drawn.
- **Status** moves `planning → ready-for-approval → approved → implementing → done → frozen` (a
  lite fix: `planning → implementing → done → frozen`) only through `pnpm iteration:status` (back to
  `planning` with `--reason`); it and `iteration:baseline`
  append the README's History; PR CI's Iteration freeze lane (`pnpm iteration:freeze-check`) fails a
  PR that changes an iteration not `frozen`, or edits a merged frozen one (a `--compact` excepted). Never edit `intake-files/` or a README's values by hand (Summary
  excepted); `pnpm iteration:list` is the index.
- **One shared plan under `--both`.** clinozy-be's `plans/` own the contract (`routes-final.md`,
  routes, tables, background work); the frontend's plan links to them and adds only its screens. A
  contract change the frontend needs is a request decided there. The frontend kicks off as soon as
  clinozy-be's `plans/routes-final.md` carries its **Route review final** line (every sub-domain
  confirmed), without waiting for the backend's plan approval.
- **Both repos.** clinozy-be uses the same names, commands and README template (`--both` opens and
  fills the same-named folder there, in the same Intake mode, from scratch too unless the user names a
  Baseline there; `PRD.md` and `schema-routes.md` — and `BRIEF.md` in brief mode — stay
  byte-identical).
