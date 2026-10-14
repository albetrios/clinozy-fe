# Iteration planning prompt

> The explicit paste-in entry point for the **`fe-iteration-planning`** skill
> (`agent-os/skills/fe-iteration-planning/SKILL.md`) — saying "plan iteration
> <iteration>" triggers it directly. Planning writes no code; it ends with the
> plan waiting for your approval. The build is
> [`kickoff-iteration-prompt.md`](kickoff-iteration-prompt.md).

**Paste this to Claude Code (here, in clinozy-fe)** once the drop is in the
iteration's `intake-files/` — `pnpm iteration:intake <iteration> <folder>` with
`--mode full` (the whole drop), `overlay` (only the changed files) or `brief`
(only a `BRIEF.md`, e.g. "implement these kinds of screens"). Set `ITERATION`
and `Build`; everything else comes from the iteration's README — Baseline
`none` is initial, anything else is incremental against that Baseline, and the
Intake mode says how the delta is found.

---

Use the **`fe-iteration-planning`** skill. Follow it in order and stop after
every step. **Write no code** — no component, token, route or test.

## SETUP

- ITERATION: `<type>-<topic>-<YYYY-MM-DD>-<id>`, created with `pnpm iteration:new`
- Build: `<all screens | automations, contacts | just the preset | just the delta>`

---

**0. Confirm the iteration.** Run `pnpm iteration:list` and show
`| Iteration | Type | Baseline | Status | Eligible | Why |` — eligible means
Status `planning`. Recommend the earliest-opened eligible one (the launch
first), and ask me (AskUserQuestion) before going on. Do not ask me for a
Baseline and do not suggest one: the iteration starts from scratch (Baseline
`none`). Only if I have named an earlier iteration to build on, save it with
`pnpm iteration:baseline <iteration> <baseline>`.
Then run **the gate**: `pnpm iteration:intake <iteration> --check` (add
`--baseline <baseline>` when I named one). **If it exits non-zero, stop now** —
write nothing, change no status, ask nothing else; print its output and end the
turn.

**1. Read everything first.** Read every file in `intake-files/` in full —
every `.md` (`BRIEF.md` first in brief mode), the prototype HTML and its JS. Do not
skim, do not grep-only. Give me the coverage matrix and what you found — theme
tokens, shell structure, screens, interaction shapes, step sequences, timings,
states — **and stop.**

**2. The delta (incremental only)**, by the README's Intake mode:

- **full / overlay** — run `pnpm iteration:diff <baseline> <iteration>` (it
  compares the two `intake-files/` folders) and read the designer's **"What
  changed"** notes. Anything the diff shows that the notes omit is a finding:
  surface it, don't silently plan it.
- **brief** — `BRIEF.md` is the change list, and `iteration:diff` must show
  nothing but `BRIEF.md` added.
- **always** — read the Baseline's `AS-BUILT.md` › Standing deviations and the
  current code of the affected parts: where the build differs from the design,
  plan against what was built. List the deviations this change touches in
  KICKOFF.md.

Classify every change and show me the table:

| Change                                              | Cost    | Blast radius                               |
| --------------------------------------------------- | ------- | ------------------------------------------ |
| Token values                                        | Trivial | **Every screen** — re-screenshot all       |
| Copy                                                | Trivial | Locale files only                          |
| Component styling                                   | Low     | Contained                                  |
| Structural (popup shape, step sequence, table↔card) | High    | Rebuild — full RED gate                    |
| New screen / surface                                | High    | New island + registrations — full RED gate |

**Preset or layout changed?** That re-tones or re-frames the whole app, not one
screen. Write a scoped section first: the exact value moves (type, colour, bg,
spacing, radius — read from the prototype CSS, light and dark), and for a
layout, the routes the shell owns and how it is made live (default + pinned +
not persisted). **Stop** and show me.

**3. Reconcile.** Where a prototype exists and disagrees with the markdown, the
prototype wins. Give me the reconciliation table, every verdict with file:line
evidence. Flag dead CSS rather than planning it; record md-only additions as
deviations. In brief mode, reconcile `BRIEF.md` against the current screens'
specs and code instead.

**4. Gate.** Score each screen on the intake checklists. **Stop and ask** on any
RED — unknown popup shape, unknown mobile behaviour, unknown conditional step
sequence, unknown table-vs-card. Do not guess; a wrong guess here is a rebuild.
Record every answer in `plans/decisions.md`; AMBER gets a safe default, logged
as open.

**5. Write KICKOFF.md** with every required section and the ordered ledger —
`| # | Work item | Kind | Depends on | Skill/driver | Acceptance | Assignee |
Status |` — in route order: initial = foundation (preset, shell made live,
stores, icons) then screens; incremental = global changes → copy → styling →
structural → new screens.

**6. Self-check**, then `pnpm iteration:status <iteration> ready-for-approval`
and stop. When I approve: `pnpm iteration:status <iteration> approved`.

---

## Notes for reuse

- **Preset only:** set Build to "just the preset"; the ledger then covers only
  the preset rows.
- **Other projects:** the same prompt works — drop the clinozy-fe specifics (the
  intake commands, four registration points, the exact gate commands) and keep
  the shape.
