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
| `intake-files/` | the iteration's **full snapshot** of received files, flat, never edited                                                                                     | `iteration:intake`                                              |
| `KICKOFF.md`    | the plan and its ordered ledger (the route)                                                                                                                 | fe-iteration-planning                                           |
| `plans/`        | our supporting documents: `decisions.md` (blocking-question answers and every scope decision)                                                               | fe-iteration-planning (+ scope decisions during implementation) |
| `AS-BUILT.md`   | per ledger row: planned · actually built · difference · why · decision · commit; revisions to upcoming rows; a closing summary; the **Standing deviations** | fe-kickoff-iteration                                            |

- **`intake-files/`** is always a full snapshot, whatever arrived (see Intake modes). It is locked
  once the Status is `approved` or later.
- **`KICKOFF.md`** is frozen at approval: afterwards only its ledger Status column and
  "revised → AS-BUILT #n" markers change.
- **Standing deviations** (in `AS-BUILT.md`) is the complete list of where the code differs from the
  design: the Baseline's list is copied, what this iteration resolved is removed, and its new
  deviations are added — item · design says · built as · since iteration · decision.
- `schema-routes.md` (and `PRD.md`) is the same file, byte-for-byte, in the same-named clinozy-be
  iteration — `pnpm iteration:list` shows its fingerprint in both repositories.

## Intake modes

`pnpm iteration:intake <iteration> <source-folder> [--mode full|overlay|brief]` turns what arrived
into the full snapshot in `intake-files/`; `--mode` defaults to `full`.

| Mode      | What arrived                                                                        | How the snapshot is built                                              | Needs                                            |
| --------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| `full`    | the whole drop                                                                      | the drop as received                                                   | — (the launch is always `full`)                  |
| `overlay` | only the changed files                                                              | the Baseline's `intake-files/`, then the received files laid over them | a Baseline, at least one received file           |
| `brief`   | no design files — a written change (for example "implement these kinds of screens") | the Baseline's `intake-files/` unchanged, plus the received `BRIEF.md` | a Baseline, `BRIEF.md` and no other changed file |

- **Mandatory** is the frontend core set, checked on the **resulting snapshot**: `PRD.md`,
  `schema-routes.md`, the prototype `*.html` and every `*.js` it loads, `_index.md`, one `<slug>.md`
  per Slug in `_index.md`'s table, `preset.md`, `shell.md` (and `BRIEF.md` in `brief` mode). Optional
  files — `_`-prefixed shared files (`_patterns.md`, `_report.md`), design-brief / auth /
  system-surface notes, `preset.json`, `design-overview.md` — are checked only when something
  references them, such as a file named in `_index.md`. Anything else is warned about, and so is a
  screen `.md` that `_index.md` does not list.
- **`BRIEF.md`** follows the template in `tooling/iterations/templates/BRIEF.md`: what changes · why ·
  affected screens, entities and routes · rules · acceptance criteria · out of scope.
- **Intake note** records what was received versus carried forward (for `overlay`, the overlaid
  files). **Intake hash** is the first 12 characters of a sha256 over every file in `intake-files/`
  — names in sorted order, each name then its bytes — so any later edit is detected.
- `<source-folder>` may also be a single file, such as the `BRIEF.md` itself.
- An overlay adds and replaces files but never removes one — removing a screen needs a `full` drop.
  `overlay` and `brief` build on the Baseline recorded when the intake runs (its own gate must
  pass), so confirm the Baseline first; choosing another one later means rebuilding the snapshot.
- A re-intake that would change an existing snapshot shows the difference and stops unless
  `--replace`, which works only while the Status is `planning`.

## The gate

`pnpm iteration:intake <iteration> --check [--baseline <iteration>]` checks, per the iteration's
Intake mode, that every mandatory file is in its `intake-files/` (and in the Baseline's, when given)
and that each recomputed Intake hash equals its README row. With `--baseline` it also checks that
this is the README's Baseline — the one an `overlay` or `brief` snapshot was built on. On a failure
it prints exactly what is missing or changed (naming the file when git can tell), in which folder,
and the command that fixes it, and exits non-zero.

**Gate rule:** whenever a skill runs the gate and it exits non-zero, it stops at once — it writes
nothing, changes no status and asks nothing else; it prints the command's output and ends the turn.
`fe-iteration-planning` runs the gate at Step 0, `fe-kickoff-iteration` before `implementing`.

## README fields

| Field         | Value                                                                                   |
| ------------- | --------------------------------------------------------------------------------------- |
| Type          | `launch`, `feat`, `change` or `fix`                                                     |
| Topic         | the kebab-case topic; `—` for launch                                                    |
| Owner         | the person driving it (`git config user.name`)                                          |
| Opened        | `YYYY-MM-DD`                                                                            |
| Branch        | the branch it is built on                                                               |
| Baseline      | `none` (initial), an earlier iteration (incremental), or `—` until the user confirms it |
| Status        | `planning`, `ready-for-approval`, `approved`, `implementing`, `done` or `frozen`        |
| Summary       | one line on what it changes — the one field you write by hand                           |
| Drop placed   | the day `iteration:intake` placed the drop                                              |
| Drop source   | where the drop came from                                                                |
| Intake mode   | `full`, `overlay` or `brief`                                                            |
| Intake note   | what was received versus carried forward                                                |
| Schema-routes | the first 12 characters of the sha256 of `intake-files/schema-routes.md`                |
| Intake hash   | the first 12 characters of the sha256 over every file in `intake-files/`                |

Below the table, a `## History` list records every Status and Baseline change, one line each:
`- <date> · <from> → <to> · <reason or —> · <git user.name>` (a Baseline change reads
`Baseline <from> → <to>`). The commands write every table value and the History — never edit those
by hand — except **Summary**, the one line you write yourself after `pnpm iteration:new`. The README
template (`tooling/iterations/templates/README.md`) is byte-identical to clinozy-be's.

## Mode and Baseline

- **Baseline `none` → MODE initial** — the first iteration in this repository: everything is new.
- **Otherwise MODE incremental**, against a Baseline **the user confirms** at planning Step 0 (saved
  with `pnpm iteration:baseline`). The suggestion is the latest `done` / `frozen` iteration in this
  repository.
- The incremental delta depends on the Intake mode:
  - `full` / `overlay` — the designer's "What changed" notes **plus**
    `pnpm iteration:diff <baseline> <iteration>`, which compares the two `intake-files/` **only**
    (never the README, `KICKOFF.md`, `plans/` or `AS-BUILT.md`). Anything the diff shows that the
    notes omit is a finding.
  - `brief` — `BRIEF.md` is the change list, and `iteration:diff` must show nothing else changed.
- Planning also reads the Baseline's Standing deviations: wherever the build differs from the drop,
  it plans against what was actually built.
- The Baseline's `intake-files/` is mandatory: `iteration:baseline` refuses a Baseline without the
  required set, and `iteration:diff` refuses an iteration without `intake-files/`.
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

## Commands

```bash
pnpm iteration:new feat pharmacy-returns --both                    # open (README only)
pnpm iteration:intake <iteration> <source-folder> --both           # place a full drop + check it
pnpm iteration:intake <iteration> <source-folder> --mode overlay   # only the changed files arrived
pnpm iteration:intake <iteration> <source-folder> --mode brief     # only BRIEF.md arrived
pnpm iteration:intake <iteration> --check [--baseline <iteration>] # the gate
pnpm iteration:baseline <iteration> <baseline|none>                # record the confirmed Baseline
pnpm iteration:diff <baseline> <iteration> [--json]                # the delta: intake-files/ only
pnpm iteration:status <iteration> <status> [--reason "<text>"]
pnpm iteration:list   # Name · Type · Owner · Opened · Baseline · Status · Intake mode · Schema-routes · Intake hash · Drop placed
```

Every command takes `--help`. `iteration:new` and `iteration:intake` take `--dry-run`; `--both` works
on the same-named folder in the sibling repository with that repository's own Baseline, sending
`PRD.md` and `schema-routes.md` (and `BRIEF.md` in `brief` mode); `--sibling <path>` overrides where
it is.
