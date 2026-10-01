# Adoption

**What every path uses, in every iteration.** Read this once; the Initial and
Incremental processes both assume it.

The one job of this document: the rules and assets that do not change from one
iteration to the next. The iteration rule itself — folders, modes, baselines —
is in [the process index](README.md#iterations).

---

## The skills

Everything runs through two skills: **`fe-kickoff-planning`** plans
([`agent-os/skills/fe-kickoff-planning/SKILL.md`](../../../agent-os/skills/fe-kickoff-planning/SKILL.md)),
and **`fe-design-ditto`** builds
([`agent-os/skills/fe-design-ditto/SKILL.md`](../../../agent-os/skills/fe-design-ditto/SKILL.md)).
They auto-trigger on "kickoff", "ditto", "same as the html", "from legacy", or
an `iterations/` path.

They enforce one loop: **read → reconcile → gate → build → verify.** You never
run the steps by hand — you drop specs in `iterations/<iteration>/` and say
"kickoff <iteration>", and they drive.

## The assets

| Asset                                                                     | Role                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------- |
| [`kickoff-prompt.md`](../prompts/kickoff-prompt.md)                       | Starts a build with the skill's stop points intact |
| [`design-intake-checklist.md`](../prompts/design-intake-checklist.md)     | The portable checklist the gate scores against     |
| [`ditto-intake-checklist.md`](../prompts/ditto-intake-checklist.md)       | The RED / AMBER / GREEN readiness gate             |
| [`design-handoff.contract.json`](../prompts/design-handoff.contract.json) | Preset → token mapping                             |
| `shadcn`                                                                  | Which primitive to reach for                       |
| `fe-route-island`                                                         | Page structure + registrations                     |
| `frontend-design`                                                         | Craft, once fidelity is met                        |
| `fe-visual-regression`                                                    | Baselines (the pin step)                           |

## The four rules that never change

Break one of these and you get a rebuild. They apply on every path, in every
iteration.

1. **Never build from a description of a source when the source is on disk.**
   Read the file. This is the single most expensive mistake available — it
   produced the wrong wizard _and_ the wrong API contract in this repo's history.
2. **Never infer an API contract.** Read clinozy-be's routes and serializers.
3. **The prototype outranks the spec.** A spec is someone's reading of the
   prototype; the prototype is the truth. When they disagree, prototype wins —
   and say so.
4. **Project rules override the source's implementation.** Its hand-rolled markup
   specifies _appearance and behaviour_, not what to import. That becomes shadcn
   primitives, semantic tokens, i18n keys, and icons from the barrel.

## The four RED blockers

On any path, **stop and ask** rather than guess when any of these is unknown.
Each forces a rebuild, not a tweak, if guessed wrong:

- Popup **shape** — dialog ≠ sheet
- **Mobile** behaviour
- Conditional **step sequence** — linear ≠ branching
- **Table vs card**

Everything else (missing copy, icon names, exact ms) is AMBER: build the
structure, resolve before "done".

## The build order (whenever you build anything)

Front-loads the expensive-to-change decisions:

1. **Preset** — tokens first. Screens on the wrong tokens look wrong even when
   structurally right; re-theming later means re-screenshotting everything.
2. **Shell** — as a **new variant**, never overwriting an existing one. Policy:
   **relocate, never delete** — every platform surface keeps a home.
3. **Screens** — one at a time: interaction shell → flow skeleton → regions
   (desktop and mobile _together_) → content → states → motion.

## Making a variant live — the two-step nobody remembers

**A restyled or new layout/shell variant is not done when the code is written. It
is done when it is the default AND pinned.** Skipping either is why "I don't see
my design as the default" keeps happening.

For **any** layout, shell, or theme variant you add or restyle, do all three:

1. **Write the variant** (the code).
2. **Point the default at it** — set the store default index / preset id to the
   new variant. In clinozy-fe: `authVariant` / `publicVariant` in
   `useThemeStore`, `DEFAULT_PRESET` in `presets.ts`.
3. **Pin it** — turn OFF any shuffle/preview cycling so it can't rotate away. In
   clinozy-fe: `SHUFFLE_TEMP.<axis> = false` in `presets.ts`.

Verify the default actually resolves to your variant — check it isn't overridden
by a persisted value (is the field in `partialize`? does `migrate` reset it?).
State in the recap: _"default = <variant>, pinned, not persisted."_ If you can't
say that sentence, the variant isn't live.

## The delta ledger — nothing closes with an open row

**The single biggest failure is a forgotten change: a delta item slips, the task
looks done, the process stops half-finished.** Prevent it with a written ledger,
kept from the first read to the last commit.

**Before building** — turn the iteration's change into an explicit numbered
list, one row per change, each with an assignee (`—` until someone takes it)
and a status. Show it to the user:

```text
Delta ledger — <iteration>
[ ] 1. <change>            — <file/surface>        — <assignee>   — not started
[ ] 2. <change>            — <file/surface>        — <assignee>   — not started
...
```

**While building** — update the row (`in progress` → `done`) as each lands.
Never drop a row; if something turns out bigger than expected, split it into
sub-rows rather than silently deferring it.

**Closing is blocked while any row is open.** The build is not done until **every
row is `done`** — or explicitly `deferred` _with the user's OK recorded in the
ledger_. "I think that's everything" is not allowed; the ledger is the authority,
not memory. The final recap **must reprint the ledger** with every row resolved.

If you reach the end and a row is still `not started`, you are not finished —
say so plainly and keep going (or ask), never report success. A stopped process
with an open row is an incomplete task, not a completed one.

## Match the exact values, not the vibe

"Ditto" means the **numbers**, not the impression. Approximating typography and
spacing is why a build reads as "close but not the same." For every surface,
port the source's **exact** values — as semantic tokens, never raw classes:

| Axis                     | Extract from the source                                                  | Don't                                                       |
| ------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Type                     | family, **px size**, weight, line-height, letter-spacing, transform      | "looks like a heading"                                      |
| Colour / bg              | the token or hex behind every surface, border, text — **light and dark** | reuse `bg-background` when the source has a distinct canvas |
| Spacing                  | exact padding/gap/margins in px/rem                                      | eyeballed `p-6`                                             |
| Radius / shadow / border | the actual radius, shadow spec, border colour + width                    | the component default                                       |
| Copy                     | **verbatim** strings                                                     | paraphrase                                                  |

The prototype's CSS is the source of truth for these — read it, don't recall it.
A value you didn't read is a value you invented. If the source hardcodes a hex
that must become a token, port it as a token (light + dark) and recompute
contrast; never ship the raw value or a guess.

### Walk this list on EVERY screen you touch

Don't eyeball a screen and move on — walk it property by property against the
source. Missing one of these is what makes a screen read as "not quite it":

- [ ] **Text content** — every string verbatim (headings, labels, buttons,
      placeholders, helper text, empty states, errors, tooltips)
- [ ] **Font** — family, **exact px size**, weight, line-height, letter-spacing,
      text-transform, per text element
- [ ] **Colour** — text, icon, and link colours (light + dark)
- [ ] **Background** — page, section, card, and input backgrounds — is the source
      using a distinct canvas, or the plain background?
- [ ] **Spacing** — padding, gap, margin — exact px/rem, not a rounded utility
- [ ] **Radius** — per element (cards, inputs, buttons, chips)
- [ ] **Border** — colour, width, which sides
- [ ] **Shadow / elevation** — exact spec
- [ ] **Icons** — correct name, size, weight
- [ ] **Layout** — column widths, alignment, order, desktop **and** mobile
- [ ] **States** — hover, active, focus, disabled, loading, empty, error
- [ ] **Motion** — transitions and durations

Record each screen's walk in the delta ledger; a screen isn't `done` until every
box is checked against the source.

## The DONE definition (whenever you finish anything)

Functional checks cannot detect a fidelity defect — "the user can create the
thing" passes while the UI matches nothing. So DONE is comparative:

- **Delta ledger fully closed** — every row `done` (or `deferred` with recorded
  user OK). Reprint it in the recap. An open row means NOT done — no exceptions
  (see _The delta ledger_ above).
- **Per-screen UI checklist walked** — for every screen touched, each box in
  _Walk this list on EVERY screen_ checked against the source.
- **Side-by-side** screenshot, source vs implementation, at **375px and 1440px**,
  per screen, per state.
- **Variant is live** — for any layout/shell/preset touched, the recap says
  "default = X, pinned, not persisted" (see _Making a variant live_ above).
- **Exact values** — type sizes, colours, spacing, radii, and copy match the
  source's numbers, not an approximation (see _Match the exact values_ above).
- Then the static gates:

```bash
pnpm validate:tokens && pnpm validate:theme-axis &&
pnpm validate:structure && pnpm validate:testids &&
pnpm type-check && pnpm lint
```

---

**Next:** [Initial iteration](initial-iteration.md) for the launch, or
[Incremental iteration](incremental-iteration.md) for every `feat`, `change` or
`fix` after it.
