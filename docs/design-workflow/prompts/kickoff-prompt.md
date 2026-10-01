# Kickoff prompt

> **Superseded by the `fe-kickoff-planning` skill**
> (`agent-os/skills/fe-kickoff-planning/SKILL.md`) — saying "kickoff
> <iteration>" / "plan from legacy" now triggers it directly; it plans and
> stops, then `fe-design-ditto` builds. This prompt is kept as the explicit
> paste-in entry point and for other projects.

**Paste this to Claude Code (here, in clinozy-fe) to start a build**, once the specs
are in the iteration folder. One prompt for every iteration — set `MODE` and
`ITERATION`, then change the `SCOPE` lines.

The iteration rule (in full: `iterations/README.md`):

- Folders are `iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/`, opened with
  `pnpm iteration:new` — e.g. `launch-2026-09-30-jxmr`,
  `feat-pharmacy-returns-2026-10-06-kqzx`. The type is `launch`, `feat`,
  `change` or `fix`.
- The **launch** is the one full snapshot: `MODE: initial`, Baseline `none`.
- Every later iteration is `MODE: incremental` and holds **only its change** —
  a feature PRD, `schema-routes.md` scoped to the changed screens, and those
  screens' specs. The folder is the delta; its README names its Baseline, the
  latest iteration on `main` when it was opened.
- An iteration is frozen once it merges; a correction is a new `fix`
  iteration. The current state is the launch plus the merged iterations, in
  merge order.

---

Use the **`fe-design-ditto`** skill. Follow it in order; do not skip its stop points.

**First, build a delta ledger** — one numbered row per change, each with an
assignee (`—` until someone takes it) and a status. Show it to me. Update rows
to `done` as you go. **Do not report success while any row is open** — an open
row means the task is incomplete, not done.

## SETUP

- MODE: `<initial | incremental>`
- ITERATION: `<type>-<topic>-<YYYY-MM-DD>-<id>`, created with `pnpm iteration:new`
- Build: `<all screens | automations, contacts | just the preset | just the delta>`
- Reference plan: `<path to plan .md, or "none">`

---

## IF MODE = initial

Everything is new; nothing exists to diff against.

**1. Read everything first.** `ls -R iterations/<iteration>/`, then read every `.md` in full, plus
any prototype HTML/JS. Do not skim, do not grep-only. Report what you found —
theme tokens, shell structure, screens, interaction shapes, step sequences,
timings, states — **and stop for my confirmation before writing any code.**

**2. Reconcile.** Where a prototype exists and disagrees with the markdown, the
prototype wins. Give me the reconciliation table. Flag dead CSS rather than
building it.

**3. Gate.** Score each screen. **Stop and ask** on any RED — unknown popup
shape, unknown mobile behaviour, unknown conditional step sequence, unknown
table-vs-card. Do not guess; a wrong guess here is a rebuild.

**4. Preset first.** Apply the theme before any screen. Recompute every contrast
ratio yourself — do not trust ratios stated in the spec. A brand colour failing
AA keeps its true value only on non-text tokens. Register in all four places.

**5. Shell as a new variant, then MAKE IT LIVE.** Add it; never overwrite an
existing one. Policy is **relocate, never delete** — every platform surface keeps
a home (audit the live shell; do not trust a remembered one). Settings stays a
hash modal. **A variant isn't done until it's the default AND pinned:** point the
store default at it, turn off shuffle (`SHUFFLE_TEMP.<axis> = false`), and
confirm the default isn't overridden by a persisted value. Report "default = X,
pinned, not persisted."

**6. Screens.** Interaction shell → flow skeleton → regions (desktop and mobile
together, never desktop-then-retrofit) → content → states → motion.

Then go to **VERIFY & CLOSE** below.

---

## IF MODE = incremental

Only what this iteration changes. The goal is to touch nothing else.

**0. Confirm the Baseline.** Read `iterations/<iteration>/README.md`: the Type
is `feat`, `change` or `fix`, and Baseline names an iteration. Type `launch` or
Baseline `none` → **stop and tell me**; by the rule the launch runs as
`initial`.

**1. Establish the delta from two signals; don't re-read everything.**

- Read the iteration folder in full — the feature PRD, `schema-routes.md`
  (SCOPE = the changed screens) and the changed screens' specs, each opening
  with **"What changed"**. The folder **is** the delta; never diff two
  snapshots.
- For each changed screen, read its current spec — the latest one among the
  launch and the merged iterations, in merge order — and its current code:
  `git log main --reverse --diff-filter=A --name-only --format= -- 'iterations/*/README.md'`
  lists the merged iterations in that order.

If a changed spec moves something the PRD doesn't state, **that's a finding** —
surface it, don't silently build it. **The reconciled delta is the work list.**
Do **not** re-read screens outside it — that re-reading is the cost we're
avoiding.

**2. Classify every change** and show me the table before building:

| Change                                              | Cost    | Blast radius                               |
| --------------------------------------------------- | ------- | ------------------------------------------ |
| Token values                                        | Trivial | **Every screen** — re-screenshot all       |
| Copy                                                | Trivial | Locale files only                          |
| Component styling                                   | Low     | Contained                                  |
| Structural (popup shape, step sequence, table↔card) | High    | Rebuild — full RED gate                    |
| New screen / surface                                | High    | New island + registrations — full RED gate |

**3. Gate the risky rows.** For structural or new-screen changes, run the same
RED gate as initial step 3 — scoped to just those screens. Stop and ask on any
RED. Batch the trivial rows.

**3b. Preset or layout changed? Write a scoped kickoff first.** A preset/layout
change re-tones or re-frames the whole app, not one screen. Before code: list the
exact value moves (type, colour, bg, spacing, radius — read from the prototype
CSS), and for a layout, **make it live** (default + pinned + not persisted).
Blast radius = every screen (preset) or every route the shell owns (layout).
Show me the scoped kickoff and stop.

**4. Apply only the delta.** Token change → recompute contrast, re-register.
Structural → build order from initial step 6, scoped to the changed screen.
Nothing outside the diff gets touched.

Then go to **VERIFY & CLOSE** below.

---

## VERIFY & CLOSE (both modes)

**Verify by comparison.** Side-by-side screenshots, source vs implementation, at
**375px and 1440px**, per screen, per state. Functional checks do not prove
fidelity.

- initial → verify every screen built.
- incremental → verify changed screens, **and re-run the full baseline set** to
  catch ripple (a token tweak shifting a screen you didn't edit). An unexpected
  diff is a finding, not a baseline to bless.

**Static gates.** `pnpm validate:tokens && pnpm validate:theme-axis &&
pnpm validate:structure && pnpm validate:testids && pnpm type-check && pnpm lint`

**Close the ledger.** Reprint the delta ledger with **every row resolved** —
`done`, or `deferred` with my explicit OK. If any row is still open you are
**not** finished: say so and continue (or ask). For every screen touched, confirm
the per-screen UI walk (text, font px, colour, bg, spacing, radius, border,
shadow, icons, layout, states, motion) was done against the source.

**Recap.** The closed ledger · what was built · **what still differs from the
source and why** · what you could not verify.

**Then remind me to freeze the iteration** before its branch merges: if newer
iterations reached `main` meanwhile, update its Baseline and check for overlap
(the same screen, entity or route changed by both); then set `Status: frozen`
in its README in the last commit before the merge. After that the folder is
never edited — a correction is a new `fix` iteration:

```bash
git add iterations/<iteration>/ && git commit -m "chore: freeze <iteration> (as built)"
```

---

## NON-NEGOTIABLES (both modes)

- **Never build from a description of a source when the source is on disk.**
  Read the file.
- **Never infer an API contract.** Read clinozy-be's actual routes and serializers.
- Project rules override the source's implementation: shadcn primitives,
  semantic tokens only, icons from `@/shared/icons`, i18n keys for every string,
  route-island structure.
- If you cannot satisfy something, say so. Do not approximate silently.

## PACING (both modes)

Work screen by screen. After each, show me the comparison and wait. Do not batch
several screens before checking in.

---

## Notes for reuse

- **Preset only:** set Build to "just the preset", MODE initial, stop after the
  preset step.
- **Resuming a paused build:** MODE initial, but replace step 1 with _"Re-read
  `iterations/<iteration>/` and the recap from last session, then continue from
  `<screen>`."_
- **Other projects:** the same prompt works — drop the clinozy-fe specifics (hash
  modal, four registration points, the exact gate commands) and keep the shape.
