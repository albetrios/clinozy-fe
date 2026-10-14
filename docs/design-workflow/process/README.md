# Design → clinozy-fe process

How a Claude Design drop becomes a faithful clinozy-fe implementation — in two
phases, **planning** (no code; it ends in your approval) and **kickoff** (the
approved plan built one ledger row at a time) — and how every iteration after
the first costs a fraction of the first.

| Page                                              | When                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| [Adoption](adoption.md)                           | Always — the skills, rules and gates both phases share                            |
| [Initial iteration](initial-iteration.md)         | Baseline `none` — the first iteration in this repo (the launch)                   |
| [Incremental iteration](incremental-iteration.md) | Every later iteration, against a Baseline you confirm                             |
| [Iteration walkthrough](iteration-walkthrough.md) | The whole flow as text diagrams, plus one incremental iteration traced end to end |

## The flow

```text
new ─► intake ─► planning ─► approval ─► kickoff ─► AS-BUILT ─► done ─► frozen
```

| #   | Step     | How                                                                                                                         | Status after         |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | New      | `pnpm iteration:new <type> [topic] [--both]` — the folder and its README                                                    | `planning`           |
| 2   | Intake   | `pnpm iteration:intake <iteration> <drop-folder> [--mode full\|overlay\|brief] [--both]` — what arrived, stored and checked | `planning`           |
| 3   | Planning | "plan iteration <iteration>" → **`fe-iteration-planning`**: the gate, then Steps 0–6, no code                               | `ready-for-approval` |
| 4   | Approval | You approve `KICKOFF.md` → `pnpm iteration:status <iteration> approved`                                                     | `approved`           |
| 5   | Kickoff  | "kickoff iteration <iteration>" → **`fe-kickoff-iteration`**: the gate, then build                                          | `implementing`       |
| 6   | AS-BUILT | One ledger row at a time: build → verify → `AS-BUILT.md` entry → review                                                     | `implementing`       |
| 7   | Done     | Gates green, every row done or deferred (your OK), AS-BUILT summary + Standing deviations                                   | `done`               |
| 8   | Frozen   | `pnpm iteration:status <iteration> frozen` in the last commit before the merge                                              | `frozen`             |

**The gate** — `pnpm iteration:intake <iteration> --check [--baseline <baseline>]` — proves the
snapshot (and the Baseline's) holds every mandatory file and that nothing changed since the intake.
Planning runs it at Step 0, the kickoff before `implementing`; when it fails, the skill stops at
once, writes nothing and prints the output.

Approval locks `intake-files/` and freezes `KICKOFF.md` (afterwards only its
ledger Status column and `revised → AS-BUILT #n` markers change). To change the
plan after that, go back first:
`pnpm iteration:status <iteration> planning --reason "<why>"` — allowed from
`ready-for-approval`, `approved` or `implementing`. A frozen iteration is never
edited; a correction is a new `fix` iteration.

## Iterations

Every design change is its own folder under `iterations/`. The rules and the
commands are in [`iterations/README.md`](../../../iterations/README.md); in short:

- Folders are `iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/` — type `launch`,
  `feat`, `change` or `fix`, e.g. `launch-2026-09-30-jxmr` or
  `feat-pharmacy-returns-2026-10-06-kqzx`. `pnpm iteration:list` lists them.
- **`intake-files/`** stores **what arrived**, and the iteration's snapshot is
  resolved from it — the Intake mode says how: `full` (the whole drop; the
  launch), `overlay` (only the changed files, laid over the Baseline's
  snapshot) or `brief` (no design files — a written `BRIEF.md`, such as
  "implement these kinds of screens", added to the Baseline's snapshot). An
  overlay or a brief takes everything it does not store from its Baseline. **`plans/decisions.md`**
  holds every blocking answer and scope decision. **`KICKOFF.md`** is the plan;
  **`AS-BUILT.md`** is what was actually built, ending with the **Standing
  deviations** — the complete list of where the code differs from the design.
- **Mode.** Baseline `none` → **initial**. Otherwise **incremental** against
  the Baseline you confirm at planning Step 0 — the suggestion is the latest
  `done` or `frozen` iteration in this repo. The delta: in `full` / `overlay`
  mode, the designer's "What changed" plus
  `pnpm iteration:diff <baseline> <iteration>`, which compares the two
  resolved intakes only; in `brief` mode, `BRIEF.md` itself, with
  nothing else changed. Either way planning reads
  the Baseline's Standing deviations. The Baseline's `intake-files/` are
  mandatory.
- Each iteration's `README.md` records Type, Topic, Owner, Opened, Branch,
  Baseline, Status, Summary, Drop placed, Drop source, Intake mode, Intake note,
  Schema-routes and Intake hash, and a History of every Status and Baseline
  change written by the commands.

An iteration is a product and design iteration, not an app release — releases
are `package.json` and `CHANGELOG.md`.

## Prompts go to two different apps — don't mix them up

| Prompt                                                                                                                                         | Paste it to                           | You get back                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------ |
| Extract prompts (`design-brief`, `extract-screens`, `schema-routes`, `design-overview`, `auth-public-routes-brief`, `extract-system-surfaces`) | **Claude Design**                     | the drop — `.md` files               |
| [`iteration-planning-prompt.md`](../prompts/iteration-planning-prompt.md)                                                                      | **Claude Code** (here, in clinozy-fe) | the plan — `KICKOFF.md`              |
| [`kickoff-iteration-prompt.md`](../prompts/kickoff-iteration-prompt.md)                                                                        | **Claude Code** (here, in clinozy-fe) | the implementation and `AS-BUILT.md` |

The extract prompts **produce** the drop; save it, with the prototype export, in
one folder and place it with `pnpm iteration:intake` (`--mode overlay` when only
the changed files were exported). A change you simply describe — no design
files — is a `BRIEF.md` from `tooling/iterations/templates/BRIEF.md`, placed
with `--mode brief`. The two Claude Code prompts
are the explicit start buttons for the skills — saying "plan iteration
<iteration>" or "kickoff iteration <iteration>" does the same.

## Which path am I on?

| Situation                                        | Path                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| The first iteration in this repo (Baseline none) | **Initial**                                                        |
| A new feature, change or fix                     | **Incremental**, against the Baseline you confirm                  |
| Structural change to an existing screen          | **Incremental**, full RED gate on that screen                      |
| New screen in an existing design                 | **Incremental** for the delta, **Initial**'s rigour for the screen |
| A correction to a frozen iteration               | A new `fix` iteration — **Incremental**                            |
| A change described in words, no design files     | **Incremental**, `--mode brief` (`BRIEF.md`)                       |

## The one habit that unlocks everything

Start every design change as a **new iteration** (`pnpm iteration:new`) whose
`intake-files/` holds **what arrived** — however little — on a Baseline that
holds the rest, and never edit a frozen one. Because every snapshot resolves
complete, `pnpm iteration:diff` (or the brief) turns the Baseline and the new
snapshot into the work list, and the incremental process costs what changed —
not what exists.

## Do this before your next iteration

Put clinozy-fe's constraints **into the Claude Design project** as standing
instructions — semantic token names not hex, shadcn component names, icon names
from the barrel, verbatim copy, separate desktop/mobile columns. Today those are
translated on every port; stated once in the project, output arrives already
portable and every future iteration benefits.

## Related

- Design prompts and briefs: [`../prompts/`](../prompts/README.md)
- The planning skill: [`fe-iteration-planning`](../../../agent-os/skills/fe-iteration-planning/SKILL.md)
- The kickoff skill: [`fe-kickoff-iteration`](../../../agent-os/skills/fe-kickoff-iteration/SKILL.md)
- The per-screen build skill: [`fe-design-ditto`](../../../agent-os/skills/fe-design-ditto/SKILL.md)
- The iteration rules and commands: [`iterations/README.md`](../../../iterations/README.md)
