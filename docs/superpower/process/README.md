# Design → clinozy-fe process

How a Claude Design requirement becomes a faithful clinozy-fe implementation, and
how v2 and v3 cost a fraction of v1.

Three documents. Read **1** once, then pick **2** or **3**.

| #   | Process                                                       | When                                                  |
| --- | ------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | [Common adoption](1-common-adoption.md)                       | Always — the skill, rules, and gates both paths share |
| 2   | [Initial implementation](2-initial-implementation.md)         | First build of a surface                              |
| 3   | [Incremental implementation](3-incremental-implementation.md) | Every version after the first (v2, v3, …)             |

---

## The loop, in one picture

```text
   1. DESIGN ──► 2. EXTRACT ──► 3. READ+GATE ──► 4. BUILD ──► 5. PIN ─┐
   (Claude       (preset once,   ("implement      (preset→     (verify │
    Design →      screens per      from legacy",    shell→       ·pin·  │
    html+js)      version)         skill stops)     screens)     commit)│
        ▲                                                               │
        └───────────────────────────────────────────────────────────── ┘
                     step 5c's commit is what makes the
                     next lap an Incremental one, not a fresh Initial
```

## Two prompts, two apps — don't mix them up

The one thing that trips people up: prompts go to two different places.

| Prompt                                                                                                     | Paste it to                           | You get back       |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------ |
| Extract prompts (`design-brief`, `extract-screens`, `auth-public-routes-brief`, `extract-system-surfaces`) | **Claude Design**                     | `.md` spec files   |
| [`kickoff-prompt.md`](../design/kickoff-prompt.md)                                                         | **Claude Code** (here, in clinozy-fe) | the implementation |

The extract prompts **produce** the specs; the kickoff prompt **consumes** them.
Save the `.md` files into `legacy/`, then the kickoff prompt is your **start
button** — `MODE: initial` for v1, `MODE: incremental` for v2+.

## Which path am I on?

| Situation                                              | Path                                                   |
| ------------------------------------------------------ | ------------------------------------------------------ |
| First build of a surface                               | **2**                                                  |
| `legacy/` has no git history                           | **2** — and commit at step 5c so next time is 3        |
| Design changed, specs committed, implementation exists | **3**                                                  |
| Structural change to an existing screen                | **3**, full RED gate on that screen                    |
| New screen in an existing design                       | **3** for the delta, **2**'s rigour for the new screen |

## The one habit that unlocks everything

`git add -f legacy/ && git commit` at the end of every version (step 5c).

`legacy/` is untracked by default, so without this the previous spec is
overwritten and the delta is unrecoverable — forcing a full rebuild every time.
With it, `git diff` becomes the work list, and Process 3 becomes possible.

## Do this before your next version

Put clinozy-fe's constraints **into the Claude Design project** as standing
instructions — semantic token names not hex, shadcn component names, icon names
from the barrel, verbatim copy, separate desktop/mobile columns. Today those are
translated on every port; stated once in the project, output arrives already
portable and every future version benefits.

## Related

- Design prompts and briefs: [`../design/`](../design/README.md)
- The build skill: [`fe-legacy-ditto`](../../../agent-os/skills/fe-legacy-ditto/SKILL.md)
