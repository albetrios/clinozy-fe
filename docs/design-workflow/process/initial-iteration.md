# Initial iteration

**Run once, for the launch.** Everything is new; there is no Baseline.
Assumes [Adoption](adoption.md).

Five steps. The first four are yours and already work. Step 5 is the one that
makes the _next_ iteration cheap.

## The iteration rule

The rules are in [`iterations/README.md`](../../../iterations/README.md). For
this process:

- The launch is the first and only `launch` iteration,
  `iterations/launch-<YYYY-MM-DD>-<id>/` — this repo's is
  `launch-2026-09-30-jxmr`. Open it with `pnpm iteration:new launch`.
- It is the one full snapshot — the full PRD, the full `schema-routes.md`, the
  prototype and every screen spec — MODE `initial`, Baseline `none`.
- Every later iteration holds only its change and follows
  [Incremental iteration](incremental-iteration.md).

---

## Prerequisites — have these before Step 3

Step 3 (the start button) does nothing useful until the launch folder,
`iterations/launch-<YYYY-MM-DD>-<id>/`, is populated. Steps 1–2 produce these;
confirm they exist first.

| File                            | Source                                                                                              | Required?                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `README.md`                     | `pnpm iteration:new launch`                                                                         | **Yes** — Type, Owner, Baseline `none`, Status                  |
| `PRD.md`                        | Product — the brief the design is built from                                                        | **Yes** — what the product is                                   |
| `preset.md`                     | Claude Design — [`design-brief-prompt.md`](../prompts/design-brief-prompt.md)                       | **Yes** — theme first                                           |
| `<screen>.md` (one per screen)  | Claude Design — [`extract-screens-prompt.md`](../prompts/extract-screens-prompt.md)                 | **Yes** — the screens to build                                  |
| `shell.md`                      | Claude Design — same screens prompt                                                                 | If a custom app shell is in scope                               |
| `schema-routes.md`              | Claude Design — [`schema-routes-prompt.md`](../prompts/schema-routes-prompt.md)                     | **Yes** — entities and routes; the same file goes to clinozy-be |
| `<auth/public>.md` + layout JSX | Claude Design — [`auth-public-routes-brief.md`](../prompts/auth-public-routes-brief.md)             | If auth/public routes are in scope                              |
| `<overlays/loading>.md`         | Claude Design — [`extract-system-surfaces-prompt.md`](../prompts/extract-system-surfaces-prompt.md) | If overlays/loading are in scope                                |
| `*.html`, `*.js`                | Claude Design — the prototype export                                                                | Optional, but it **outranks the md** when present               |

Everything sits **flat in the iteration folder**, next to the `README.md` that
`pnpm iteration:new launch` wrote (Type `launch`, Baseline `none`, Status
`planning` — set it to `building` when the build starts). Nothing from the
clinozy-fe repo is a prerequisite — the skills read the live codebase
themselves. If none of these exist yet, you're not ready for Step 3; do Steps
1–2 first.

Quick check:

```bash
pnpm iteration:list          # the launch, its Owner and Status
ls iterations/launch-*/
```

---

## ==== STEP 1 — Design ====

In Claude Design, build the requirement. It generates the prototype:

```text
<name>.html   +   support.js
```

Nothing to do in clinozy-fe yet. This is design work, and it should stay yours.

## ==== STEP 2 — Extract ====

Paste these prompts into Claude Design, in this order. Save every returned `.md`
**flat in the iteration folder**, alongside the prototype files.

| #   | Prompt                                                                              | Frequency                                                                   |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | [`design-brief-prompt.md`](../prompts/design-brief-prompt.md)                       | **Once, ever** — the preset. After this it never changes.                   |
| 2   | [`extract-screens-prompt.md`](../prompts/extract-screens-prompt.md)                 | **Per iteration** — shell + screens.                                        |
| 3   | [`schema-routes-prompt.md`](../prompts/schema-routes-prompt.md)                     | **Per iteration** — entities and routes; copy the result to clinozy-be too. |
| 4   | [`auth-public-routes-brief.md`](../prompts/auth-public-routes-brief.md)             | Once — auth/public layouts + routes.                                        |
| 5   | [`extract-system-surfaces-prompt.md`](../prompts/extract-system-surfaces-prompt.md) | Once — overlays + loading.                                                  |

End state — the launch folder holds:

```text
iterations/launch-2026-09-30-jxmr/
├── README.md            ← from pnpm iteration:new launch
├── PRD.md               ← the product brief
├── preset.md            ← from prompt 1
├── shell.md             ← from prompt 2
├── <screen>.md          ← from prompt 2, one per screen
├── schema-routes.md     ← from prompt 3
├── <name>.html          ← the prototype
└── support.js
```

## ==== STEP 3 — Start the build (this is the "start button") ====

**Paste [`kickoff-prompt.md`](../prompts/kickoff-prompt.md) to Claude Code (here,
in clinozy-fe)** with:

```text
MODE: initial
ITERATION: launch-2026-09-30-jxmr
Build: all screens
```

(Short form: just say **"kickoff launch-2026-09-30-jxmr"** —
`fe-kickoff-planning` auto-triggers, and "plan from legacy" still works too. The
kickoff file is the fuller version that spells out the stop points.)

> **Who gets what:** the Step 2 prompts go to **Claude Design** and produce
> `.md`. This kickoff prompt goes to **Claude Code** and consumes them. Different
> apps, different jobs.

`fe-kickoff-planning` now:

1. Inventories the folder (`ls -R iterations/<iteration>/`)
2. Reads every `.md` **and** the prototype, in full
3. Reconciles the markdown against the prototype (prototype wins)
4. Writes `iterations/<iteration>/KICKOFF.md` and **stops for your
   confirmation** before any code is written

Anything RED (see Adoption) comes back as a question. Once you confirm,
`fe-design-ditto` builds the plan.

**Do not skip the stop.** It exists because building on a summary — rather than
the source — is what produced every rebuild in this repo.

## ==== STEP 4 — Build ====

In the order from Adoption: **preset → shell → screens**.

- Preset: recompute every contrast ratio locally; register in all four places.
- Shell: new variant, relocate-never-delete.
- Screens: one at a time, desktop and mobile together.

This is where "ditto" happens — the implementation matches the design across all
screens.

## ==== STEP 5 — Verify · Pin · Freeze ====

**The step that was missing.** Its absence is why every design round used to
cost as much as the first. Three parts, in order:

### 5a. Verify by comparison

Side-by-side, source vs implementation, 375px and 1440px, per screen, per state.
Then the static gates (Adoption, DONE definition).

### 5b. Pin the result

Capture visual-regression baselines
([`fe-visual-regression`](../../../agent-os/skills/fe-visual-regression/SKILL.md)).

This is the safety net for the _next_ iteration: when a later iteration changes
a token, the diff shows every screen it touched — including the ones you weren't
editing.

### 5c. Freeze the iteration

In the last commit before the launch's branch merges to `main`, set
`Status: frozen` in its `README.md`:

```bash
git add iterations/<iteration>/ && git commit -m "chore: freeze <iteration> (as built)"
```

After the merge the folder is never edited. The next design change is a
**new** iteration holding only that change —
`pnpm iteration:new <feat|change|fix> <topic>` — with this one as its Baseline,
and its own folder is its work list. A correction to the launch is a `fix`
iteration, never an edit.

> A frozen launch is what makes the next iteration incremental instead of
> another initial build.

---

**Result:** a ditto Claude-Design implementation across all screens, pinned,
with its iteration frozen. **Next iteration →**
[Incremental iteration](incremental-iteration.md).
