# Kickoff iteration prompt

> The explicit paste-in entry point for the **`fe-kickoff-iteration`** skill
> (`agent-os/skills/fe-kickoff-iteration/SKILL.md`) — saying "kickoff iteration
> <iteration>" triggers it directly. It builds an **approved** plan; planning is
> [`iteration-planning-prompt.md`](iteration-planning-prompt.md).

**Paste this to Claude Code (here, in clinozy-fe)** once the iteration's
`KICKOFF.md` is approved (README Status `approved`). Set `ITERATION` and
`Build`; the mode comes from the iteration's README.

---

Use the **`fe-kickoff-iteration`** skill; each screen row runs
**`fe-design-ditto`**. Follow the ledger in order, one row at a time, and do not
skip the stop after each row.

## SETUP

- ITERATION: `<type>-<topic>-<YYYY-MM-DD>-<id>`, created with `pnpm iteration:new`
- Build: `<all screens | automations, contacts | just the preset | just the delta>`

---

**0. Confirm the iteration.** Run `pnpm iteration:list` and show
`| Iteration | Type | Baseline | Status | Eligible | Why |` — eligible means
Status `approved`, not yet implementing, and Baseline `none` or `done`/`frozen`.
Ask me (AskUserQuestion), then run **the gate**: `pnpm iteration:intake
<iteration> --check`. **If it exits non-zero, stop now** — write nothing,
change no status, ask nothing else; print its output and end the turn. When it
passes: `pnpm iteration:status <iteration> implementing`, and start
`AS-BUILT.md` with the Baseline's Standing deviations copied in.

## Build order — initial

**1. Preset first.** Apply the theme before any screen. Recompute every contrast
ratio yourself — do not trust ratios stated in the spec. A brand colour failing
AA keeps its true value only on non-text tokens. Register in all four places.

**2. Shell — one design per surface.** The new design replaces the old one in
the same change; no preview variant is kept beside it. Policy is **relocate,
never delete** for the platform surfaces — each keeps a home (audit the live
shell; do not trust a remembered one). Settings stays a hash modal. Report
"<surface>: one design — <file>; the old one removed."

**3. Screens.** Interaction shell → flow skeleton → regions (desktop and mobile
together, never desktop-then-retrofit) → content → states → motion.

## Build order — incremental: apply only the delta

The ledger already holds only the delta, in route order: global changes (tokens,
preset, layout) → copy → styling → structural → new screens. A token change →
recompute contrast, re-register. A structural row → the screen build order
above, scoped to that screen. Nothing outside the ledger gets touched.

## Each row

Build it → verify it → write its `AS-BUILT.md` entry (planned · built ·
difference · why · decision · commit) → check the impact on the rows still to
come. A small change inside the row: record it and continue. A scope change —
a row added or removed, an acceptance or the order changed: **stop and ask
me**, then record the decision in `plans/decisions.md` and `AS-BUILT.md`, and
mark the KICKOFF row `revised → AS-BUILT #n`.

---

## VERIFY & CLOSE

**Verify by the Intake mode.** full / overlay: side-by-side screenshots, source
vs implementation, at **375px and 1440px**, per screen, per state — functional
checks do not prove fidelity. brief: the `BRIEF.md` acceptance criteria, with
the touched screens still matching their carried-forward specs.

- initial → verify every screen built.
- incremental → verify changed screens, **and re-run the full baseline set** to
  catch ripple (a token tweak shifting a screen you didn't edit). An unexpected
  diff is a finding, not a baseline to bless.

**Static gates.** `pnpm validate:tokens && pnpm validate:theme-axis &&
pnpm validate:structure && pnpm validate:testids && pnpm type-check && pnpm lint`

**Close the ledger.** Reprint the ledger with **every row resolved** — `done`,
or `deferred` with my explicit OK. If any row is still open you are **not**
finished: say so and continue (or ask). For every screen touched, confirm the
per-screen UI walk (text, font px, colour, bg, spacing, radius, border, shadow,
icons, layout, states, motion) was done against the source.

**Recap.** Write `AS-BUILT.md`'s summary — planned but not built (deferred, my
OK), built but not planned, follow-ups for the next iteration — and its
**Standing deviations** (the Baseline's list, minus what this iteration
resolved, plus its new ones), then
`pnpm iteration:status <iteration> done`. Remind me that `frozen` goes in the
last commit before the branch merges, and that after it the folder is never
edited (a correction is a new `fix` iteration). Never push, open a PR or merge.

---

## NON-NEGOTIABLES

- **Never build from a description of a source when the source is on disk.**
  Read the file in `intake-files/`.
- **Never infer an API contract.** Read clinozy-be's actual routes and serializers.
- Project rules override the source's implementation: shadcn primitives,
  semantic tokens only, icons from `@/shared/icons`, i18n keys for every string,
  route-island structure.
- If you cannot satisfy something, say so. Do not approximate silently.

## PACING

One ledger row at a time. After each, show me the comparison and the
`AS-BUILT.md` entry, and wait. Do not batch several rows before checking in.

---

## Notes for reuse

- **Preset only:** set Build to "just the preset"; stop after the preset rows.
- **Resuming a paused build:** say "continue kickoff <iteration>" — re-read
  `KICKOFF.md`, `AS-BUILT.md` and the ledger, then continue from the first open
  row.
- **Other projects:** the same prompt works — drop the clinozy-fe specifics (hash
  modal, four registration points, the exact gate commands) and keep the shape.
