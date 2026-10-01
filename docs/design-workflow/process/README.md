# Design → clinozy-fe process

How a Claude Design requirement becomes a faithful clinozy-fe implementation,
and how every iteration after the first costs a fraction of the first.

Three documents. Read **Adoption** once, then pick **Initial** or **Incremental**.

| Process                                           | When                                                   |
| ------------------------------------------------- | ------------------------------------------------------ |
| [Adoption](adoption.md)                           | Always — the skills, rules, and gates both paths share |
| [Initial iteration](initial-iteration.md)         | The launch — the one full snapshot                     |
| [Incremental iteration](incremental-iteration.md) | Every `feat`, `change` or `fix` after it               |

## Iterations

Every change to the product's design lives in its own folder under
`iterations/`. The rules are in
[`iterations/README.md`](../../../iterations/README.md); in short:

- Folders are `iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/`, opened with
  `pnpm iteration:new <type> [topic]` and listed with `pnpm iteration:list`.
  The type is `launch`, `feat`, `change` or `fix` — for example
  `launch-2026-09-30-jxmr` or `feat-pharmacy-returns-2026-10-06-kqzx`.
- The **launch** is the one full snapshot: MODE `initial`, Baseline `none`.
- Every later iteration is one person on one branch, holding **only its
  change**: a feature PRD, `schema-routes.md` scoped to the changed screens,
  the changed screens' specs and its own `KICKOFF.md`. It is MODE
  `incremental` against its Baseline — the latest iteration on `main` when it
  was opened.
- Each iteration's own `README.md` records its Type, Topic, Owner, Opened,
  Branch, Baseline, Status (`planning` → `building` → `frozen`) and Summary.
  There is no shared index file.
- Merged means frozen; a correction is a new `fix` iteration. The current
  picture is the launch plus the merged iterations, in merge order.

An iteration is a product and design iteration, not an app release — releases
are `package.json` and `CHANGELOG.md`.

---

## The loop, in one picture

```text
   1. DESIGN ──► 2. EXTRACT ──► 3. READ+GATE ──► 4. BUILD ──► 5. PIN ─┐
   (Claude       (preset once,   ("kickoff        (preset→     (verify │
    Design →      screens per      <iteration>",    shell→       ·pin·  │
    html+js)      iteration)       skill stops)     screens)     freeze)│
        ▲                                                               │
        └───────────────────────────────────────────────────────────── ┘
              the next design change is a new iteration holding only
              that change; its Baseline is the latest one on main
```

## Two prompts, two apps — don't mix them up

The one thing that trips people up: prompts go to two different places.

| Prompt                                                                                                     | Paste it to                           | You get back       |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------ |
| Extract prompts (`design-brief`, `extract-screens`, `auth-public-routes-brief`, `extract-system-surfaces`) | **Claude Design**                     | `.md` spec files   |
| [`kickoff-prompt.md`](../prompts/kickoff-prompt.md)                                                        | **Claude Code** (here, in clinozy-fe) | the implementation |

The extract prompts **produce** the specs; the kickoff prompt **consumes** them.
Open the iteration with `pnpm iteration:new`, then save the `.md` files into its
folder, `iterations/<iteration>/`. The kickoff prompt is your **start button** —
`MODE: initial` for the launch, `MODE: incremental` for every later iteration.

## Which path am I on?

| Situation                                | Path                                                               |
| ---------------------------------------- | ------------------------------------------------------------------ |
| The launch (no iteration exists yet)     | **Initial**                                                        |
| A new feature, change or fix after it    | **Incremental**, against its Baseline                              |
| Structural change to an existing screen  | **Incremental**, full RED gate on that screen                      |
| New screen in an existing design         | **Incremental** for the delta, **Initial**'s rigour for the screen |
| A correction to an iteration that merged | A new `fix` iteration — **Incremental**                            |

## The one habit that unlocks everything

Start every design change as a **new iteration** — `pnpm iteration:new` —
holding only that change, and never edit one that has merged. Freeze each
iteration (`Status: frozen` in its README) in the last commit before it merges.

Because a later iteration holds only its change, its folder is the work list —
there are no snapshots to diff — and the incremental process becomes possible.
The current picture is the launch plus the merged iterations, in merge order.

## Do this before your next iteration

Put clinozy-fe's constraints **into the Claude Design project** as standing
instructions — semantic token names not hex, shadcn component names, icon names
from the barrel, verbatim copy, separate desktop/mobile columns. Today those are
translated on every port; stated once in the project, output arrives already
portable and every future iteration benefits.

## Related

- Design prompts and briefs: [`../prompts/`](../prompts/README.md)
- The plan skill: [`fe-kickoff-planning`](../../../agent-os/skills/fe-kickoff-planning/SKILL.md)
- The build skill: [`fe-design-ditto`](../../../agent-os/skills/fe-design-ditto/SKILL.md)
- The iteration rules: [`iterations/README.md`](../../../iterations/README.md)
