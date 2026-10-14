# Adoption

**What every path uses, in every iteration.** Read this once; the Initial and
Incremental processes both assume it.

The one job of this document: the rules and assets that do not change from one
iteration to the next. The flow and the iteration rules — folders, statuses,
modes, baselines — are in [the process index](README.md).

---

## The skills

Everything runs through three skills:

- **`fe-iteration-planning`** plans — no code
  ([`agent-os/skills/fe-iteration-planning/SKILL.md`](../../../agent-os/skills/fe-iteration-planning/SKILL.md));
  say "plan iteration <iteration>".
- **`fe-kickoff-iteration`** builds the approved plan, one ledger row at a time
  ([`agent-os/skills/fe-kickoff-iteration/SKILL.md`](../../../agent-os/skills/fe-kickoff-iteration/SKILL.md));
  say "kickoff iteration <iteration>".
- **`fe-design-ditto`** builds each screen faithfully to the source
  ([`agent-os/skills/fe-design-ditto/SKILL.md`](../../../agent-os/skills/fe-design-ditto/SKILL.md));
  the kickoff drives it per row, and "ditto" / "same as the html" call it
  directly.

They enforce one loop: **read → reconcile → gate → plan → approve → build →
verify → record.** You never run the steps by hand — you place the drop with
`pnpm iteration:intake`, say "plan iteration <iteration>", approve, then say
"kickoff iteration <iteration>", and they drive.

## The assets

| Asset                                                                     | Role                                                |
| ------------------------------------------------------------------------- | --------------------------------------------------- |
| [`iteration-planning-prompt.md`](../prompts/iteration-planning-prompt.md) | Starts planning with the skill's stop points intact |
| [`kickoff-iteration-prompt.md`](../prompts/kickoff-iteration-prompt.md)   | Starts the build of an approved plan                |
| [`design-intake-checklist.md`](../prompts/design-intake-checklist.md)     | The portable checklist the gate scores against      |
| [`ditto-intake-checklist.md`](../prompts/ditto-intake-checklist.md)       | The RED / AMBER / GREEN readiness gate              |
| [`design-handoff.contract.json`](../prompts/design-handoff.contract.json) | Preset → token mapping                              |
| `shadcn`                                                                  | Which primitive to reach for                        |
| `fe-route-island`                                                         | Page structure + registrations                      |
| `frontend-design`                                                         | Craft, once fidelity is met                         |
| `fe-visual-regression`                                                    | Baselines (the pin step)                            |

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
2. **Shell** — the new design **replaces** the old one (one design per surface,
   below). Policy: **relocate, never delete** — every platform surface keeps a
   home.
3. **Screens** — one at a time: interaction shell → flow skeleton → regions
   (desktop and mobile _together_) → content → states → motion.

## One design per surface — a new design replaces the old one

**A surface has exactly one design. A restyled or new layout, shell or screen
replaces the one before it — the old design goes in the same change.** No preview
variant is kept beside it behind a store index or a shuffle switch: a second
design nobody sees is how "I don't see my design" kept happening (the default
still pointed at the old one) and how dead shells piled up.

For **any** layout or shell you restyle or replace:

1. **Build the new design in place of the old one** — edit the surface's file,
   or add the new file and delete the old one together with everything only it
   used (loaders, store fields, i18n keys, tests). In clinozy-fe the app shell
   is `src/shared/layouts/AppLayout/AppLayoutSectionBar.tsx`.
2. **Relocate, never delete, the platform surfaces** — sign-out, the settings
   entry, the switcher… each keeps a home in the new design.
3. **Verify it is what loads** — with the old design gone there is no index, no
   persisted value and no shuffle that can put it back.

The look is data, not a design fork: the one look is `THEME_ID` in `presets.ts`.

State in the recap: _"<surface>: one design — <file>; the old one removed."_

## The ledger — nothing closes with an open row

**The single biggest failure is a forgotten change: a delta item slips, the task
looks done, the process stops half-finished.** Prevent it with a written ledger,
kept from the first read to the last commit.

**Before building** — planning ends with the ledger in `KICKOFF.md`: every work
item in build order (the route), one row each, approved before any code:

```text
| # | Work item | Kind | Depends on | Skill/driver | Acceptance | Assignee | Status |
| 1 | <change>  | …    | —          | <skill>      | <how it's proved> | —  | open   |
```

**While building** — one row at a time: build it, verify it against its
Acceptance, write its `AS-BUILT.md` entry (planned · built · difference · why ·
decision · commit), and set its Status (`in progress` → `done`). Never drop a
row. A small change inside the row is recorded in its entry; a scope change — a
row added or removed, an Acceptance or the order changed — **stops for the
user**, then goes into `plans/decisions.md` and AS-BUILT's revisions, and the
KICKOFF row is marked `revised → AS-BUILT #n`.

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

Record each screen's walk in its `AS-BUILT.md` entry; a screen isn't `done` until every
box is checked against the source.

## The DONE definition (whenever you finish anything)

Functional checks cannot detect a fidelity defect — "the user can create the
thing" passes while the UI matches nothing. So DONE is comparative:

- **Ledger fully closed** — every row `done` (or `deferred` with recorded
  user OK). Reprint it in the recap. An open row means NOT done — no exceptions
  (see _The ledger_ above).
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

**Next:** [Initial iteration](initial-iteration.md) when the Baseline is `none`
(every iteration by default — from scratch), or [Incremental iteration](incremental-iteration.md)
when you named an earlier iteration to build on.
