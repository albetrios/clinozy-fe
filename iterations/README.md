# Design iterations

An iteration is one product/design change, recorded as a folder under `iterations/`. It is a
product/design iteration, **not** an app release — releases are the `package.json` version and
`CHANGELOG.md`.

How an iteration is planned and built: [docs/design-workflow/process/README.md](../docs/design-workflow/process/README.md);
every step as a text diagram: [the walkthrough](../docs/design-workflow/process/iteration-walkthrough.md).
There is no shared index file — `pnpm iteration:list` is the index.

## Naming

`iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/`

| Part           | Rule                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| `<type>`       | `launch`, `feat`, `change` or `fix`                                                      |
| `<topic>`      | lowercase kebab-case words, no digits. `launch` has no topic: `launch-<YYYY-MM-DD>-<id>` |
| `<YYYY-MM-DD>` | the day the iteration was opened                                                         |
| `<id>`         | four random lowercase letters, so names stay unique across people                        |

Examples: `launch-2026-09-30-jxmr`, `feat-pharmacy-returns-2026-10-06-kqzx`. There is only ever one
launch. The date is a value (when the iteration was opened) and the only part that carries digits.

The same name is used in clinozy-fe and clinozy-be. Create the folder only in the repository the
change touches; `pnpm iteration:new <type> <topic> --both` creates it in both.

## The folder

| Path            | Holds                                                                                                                                                       | Written by                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `README.md`     | the field table, then a `## History` list                                                                                                                   | `iteration:new`, then only the commands (Summary: you)          |
| `intake-files/` | **what arrived**, flat, never edited — the whole drop (`full`), the changed files (`overlay`) or `BRIEF.md` (`brief`); the rest comes from the Baseline     | `iteration:intake`                                              |
| `KICKOFF.md`    | the plan and its ordered ledger (the route)                                                                                                                 | fe-iteration-planning                                           |
| `plans/`        | our supporting documents: `decisions.md` (blocking-question answers and every scope decision)                                                               | fe-iteration-planning (+ scope decisions during implementation) |
| `AS-BUILT.md`   | per ledger row: planned · actually built · difference · why · decision · commit; revisions to upcoming rows; a closing summary; the **Standing deviations** | fe-kickoff-iteration                                            |

- **`intake-files/`** stores only what arrived (see Intake modes); the iteration's **snapshot** is
  resolved from it — for an `overlay` or a `brief`, the Baseline's snapshot (up the Baseline chain)
  with these files laid over it. It is locked once the Status is `approved` or later.
- **`KICKOFF.md`** is frozen at approval: afterwards only its ledger Status column and
  "revised → AS-BUILT #n" markers change.
- **Standing deviations** (in `AS-BUILT.md`) is the complete list of where the code differs from the
  design: the Baseline's list is copied, what this iteration resolved is removed, and its new
  deviations are added — item · design says · built as · since iteration · decision.
- `schema-routes.md` (and `PRD.md`) is the same file, byte-for-byte, in the same-named clinozy-be
  iteration — `pnpm iteration:list` shows its fingerprint in both repositories.

## Intake modes

`pnpm iteration:intake <iteration> <source-folder> [--mode full|overlay|brief]` stores what
arrived in `intake-files/` and checks the snapshot it resolves to; `--mode` defaults to `full`.

| Mode      | What arrived                                                                        | `intake-files/` stores | The snapshot (resolved)                                                                                        | Needs                                                       |
| --------- | ----------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `full`    | the whole drop                                                                      | the drop as received   | what it stores                                                                                                 | — (the launch is always `full`)                             |
| `overlay` | only the changed files                                                              | the received files     | the Baseline's snapshot, with the received files laid over it                                                  | a Baseline the user named, at least one received file       |
| `brief`   | no design files — a written change (for example "implement these kinds of screens") | `BRIEF.md`             | from scratch (Baseline `none`): `BRIEF.md` alone; on a named Baseline: its snapshot unchanged, plus `BRIEF.md` | `BRIEF.md`; on a named Baseline, also no other changed file |

- **Resolved snapshot.** Every command reads an iteration's snapshot, never its folder alone: the
  gate, the Intake hash, `iteration:diff`, `iteration:list` and the Baseline checks. An `overlay`
  or a `brief` takes each file it does not store from its Baseline, whose snapshot may itself come
  from its own Baseline. The Baselines are frozen, so the snapshot never moves under it.
- **Mandatory** is the frontend core set, checked on the **resolved snapshot**: `PRD.md`,
  `schema-routes.md`, the prototype `*.html` and every `*.js` it loads, `_index.md`, one `<slug>.md`
  per Slug in `_index.md`'s table, `preset.md`, `shell.md` (and `BRIEF.md` in `brief` mode). A
  brief from scratch has no design files to carry, so its whole mandatory set is `BRIEF.md`. Optional
  files — `_`-prefixed shared files (`_patterns.md`, `_report.md`), design-brief / auth /
  system-surface notes, `preset.json`, `design-overview.md` — are checked only when something
  references them, such as a file named in `_index.md`. Anything else is warned about, and so is a
  screen `.md` that `_index.md` does not list.
- **`BRIEF.md`** follows the template in `tooling/iterations/templates/BRIEF.md`: what changes · why ·
  affected screens, entities and routes · rules · acceptance criteria · out of scope.
- **Intake note** records what was received versus carried forward from the Baseline (for
  `overlay`, the overlaid files; for a brief from scratch, `1 received (BRIEF.md) · from scratch`).
  **Intake hash** is the first 12 characters of a sha256 over every file of the resolved snapshot —
  names in sorted order, each name then its bytes — so any later edit is detected, in the
  iteration's own files or anywhere in its Baseline chain.
- `<source-folder>` may also be a single file, such as the `BRIEF.md` itself.
- An overlay adds and replaces files but never removes one — removing a screen needs a `full` drop.
  `overlay`, and a `brief` on a named Baseline, build on the Baseline recorded when the intake runs
  (its own gate must pass), so record the Baseline the user named first; choosing another one later
  means rebuilding the snapshot.
- A re-intake that would change an existing snapshot shows the difference and stops unless
  `--replace`, which works only while the Status is `planning`.
- **Compacting.** Intakes placed before this rule copied the Baseline's files into `intake-files/`.
  `pnpm iteration:intake <iteration> --compact [--dry-run]` removes each copy that is byte-identical
  to the Baseline's and keeps what was received (the Intake note's list). The resolved snapshot and
  its Intake hash do not change — the command refuses otherwise — so it works at any Status, a
  frozen iteration included, and never writes the README.

## The gate

`pnpm iteration:intake <iteration> --check [--baseline <iteration>]` checks, per the iteration's
Intake mode, that every mandatory file is in its resolved snapshot (and in the Baseline's, when
given) and that each recomputed Intake hash equals its README row. With `--baseline` it also checks that
this is the README's Baseline — the one an `overlay` or `brief` snapshot was built on (a brief from
scratch was built on none). On a failure
it prints exactly what is missing or changed (naming the file when git can tell), in which folder,
and the command that fixes it, and exits non-zero.

**Gate rule:** whenever a skill runs the gate and it exits non-zero, it stops at once — it writes
nothing, changes no status and asks nothing else; it prints the command's output and ends the turn.
`fe-iteration-planning` runs the gate at Step 0, `fe-kickoff-iteration` before `implementing`.

## README fields

| Field         | Value                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------- |
| Type          | `launch`, `feat`, `change` or `fix`                                                      |
| Process       | `full`, or `lite` — a `fix` planned in one step (`--lite`); no row means `full`          |
| Topic         | the kebab-case topic; `—` for launch                                                     |
| Owner         | the person driving it (`git config user.name`)                                           |
| Opened        | `YYYY-MM-DD`                                                                             |
| Branch        | the branch it is built on                                                                |
| Baseline      | `none` (from scratch, the default), or an earlier iteration the user named (incremental) |
| Status        | `planning`, `ready-for-approval`, `approved`, `implementing`, `done` or `frozen`         |
| Summary       | one line on what it changes — the one field you write by hand                            |
| Drop placed   | the day `iteration:intake` placed the drop                                               |
| Drop source   | where the drop came from                                                                 |
| Intake mode   | `full`, `overlay` or `brief`                                                             |
| Intake note   | what was received versus carried forward                                                 |
| Schema-routes | the first 12 characters of the sha256 of `intake-files/schema-routes.md`                 |
| Intake hash   | the first 12 characters of the sha256 over every file in `intake-files/`                 |

Below the table, a `## History` list records every Status and Baseline change, one line each:
`- <date> · <from> → <to> · <reason or —> · <git user.name>` (a Baseline change reads
`Baseline <from> → <to>`). The commands write every table value and the History — never edit those
by hand — except **Summary**, the one line you write yourself after `pnpm iteration:new`. The README
template (`tooling/iterations/templates/README.md`) is byte-identical to clinozy-be's.

## Mode and Baseline

- **Every iteration starts from scratch: Baseline `none` → MODE initial.** `pnpm iteration:new`
  writes `none`, and nothing suggests a Baseline or asks for one — no earlier iteration and none of
  its files are taken into account unless the user asks for it.
- **MODE incremental only when the user names a Baseline** — "build on <iteration>", "the last
  iteration", a specific earlier drop. Record it with `pnpm iteration:baseline <iteration>
<baseline>`; that is the only way an iteration gets one.
- With a Baseline the user named, the incremental delta depends on the Intake mode:
  - `full` / `overlay` — the designer's "What changed" notes **plus**
    `pnpm iteration:diff <baseline> <iteration>`, which compares the two resolved intakes **only**
    (never the README, `KICKOFF.md`, `plans/` or `AS-BUILT.md`). Anything the diff shows that the
    notes omit is a finding.
  - `brief` — `BRIEF.md` is the change list, and `iteration:diff` must show nothing else changed.
- Planning then also reads the Baseline's Standing deviations: wherever the build differs from the
  drop, it plans against what was actually built. From scratch, planning reads the current code
  instead — what is built is still the truth for anything the iteration touches.
- A named Baseline's intake is mandatory: `iteration:baseline` refuses a Baseline whose resolved
  snapshot lacks the required set, and `iteration:diff` refuses an iteration without
  `intake-files/` or whose snapshot cannot be resolved.
- Parallel branches are fine. Before merging, if another iteration reached `main` meanwhile, check
  overlap — the same screen, entity or route changed by both — and resolve it in review.

## Lifecycle

Status moves one step at a time with `pnpm iteration:status <iteration> <status>`:

| Status               | Set by                           | When                                                                                     |
| -------------------- | -------------------------------- | ---------------------------------------------------------------------------------------- |
| `planning`           | `pnpm iteration:new`             | the folder is opened; the drop is placed and planned                                     |
| `ready-for-approval` | fe-iteration-planning            | `KICKOFF.md` passes the self-check                                                       |
| `approved`           | the user's go-ahead              | `KICKOFF.md` and `intake-files/` freeze                                                  |
| `implementing`       | fe-kickoff-iteration             | the user confirms the iteration and the gate passes                                      |
| `done`               | fe-kickoff-iteration             | every ledger row is closed and `AS-BUILT.md` is summarized, Standing deviations included |
| `frozen`             | the last commit before the merge | the iteration merges to `main`                                                           |

`ready-for-approval`, `approved` or `implementing` may go back to `planning` with
`--reason "<why>"`; nothing else is allowed. Never edit a frozen iteration — a correction is a new
`fix` iteration.

A **lite** fix (Process `lite`, opened with `pnpm iteration:new fix <topic> --lite`) moves
`planning → implementing → done → frozen`: fe-iteration-planning plans it in one step — `KICKOFF.md`
and `plans/decisions.md`, one stop for the user's go — and fe-kickoff-iteration moves it to
`implementing`, with no `ready-for-approval` or `approved`. It needs no drop; when one is placed, the
gate runs as usual. `implementing` or `done` may go back to `planning` with `--reason`.

## Commands

```bash
pnpm iteration:new feat pharmacy-returns --both                    # open (README only)
pnpm iteration:new fix rounding --lite                             # a fix planned in one step
pnpm iteration:intake <iteration> <source-folder> --both           # place a full drop + check it
pnpm iteration:intake <iteration> <source-folder> --mode overlay   # only the changed files arrived (named Baseline)
pnpm iteration:intake <iteration> <source-folder> --mode brief     # only BRIEF.md arrived
pnpm iteration:intake <iteration> --check [--baseline <iteration>] # the gate
pnpm iteration:intake <iteration> --compact [--dry-run]            # drop stored copies of the Baseline's files
pnpm iteration:baseline <iteration> <baseline|none>                # record the Baseline the user named
pnpm iteration:diff <baseline> <iteration> [--json]                # the delta: the two resolved intakes only
pnpm iteration:status <iteration> <status> [--reason "<text>"]
pnpm iteration:list   # Name · Type · Owner · Opened · Baseline · Status · Intake mode · Schema-routes · Intake hash · Drop placed
```

Every command takes `--help`. `iteration:new` and `iteration:intake` take `--dry-run`; `--both` works
on the same-named folder in the sibling repository with that repository's own Baseline (`none` by
default), sending
`PRD.md` and `schema-routes.md` (and `BRIEF.md` in `brief` mode); `--sibling <path>` overrides where
it is.
