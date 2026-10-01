# Paste this to Claude Design

Produces **one** file — `design-overview.md` — a complete, detailed record of the
**current design as it exists right now** in this Claude Design project: every
screen, every flow, every component, every decision. Save it into the
iteration folder, `clinozy-fe/iterations/<iteration>/`. This is the top-level map; the deep dives come from the other
prompts (`preset.md` for theme, `screens.md` for per-screen UI,
`schema-routes.md` for data + routes).

Nothing to fill in — paste as-is.

---

You are documenting **your own current design**, exactly as built, for a
developer who **cannot see it**. This is an inventory and audit, not a pitch: do
not idealise, do not describe what the design "should" or "could" do — only what
is actually on the canvas right now. If a screen is half-finished, say so. If two
screens are inconsistent, say so.

**Capture everything. Remove nothing. Assume no detail is too small.** Anything
you leave out does not exist to the developer. Err on the side of
over-documenting.

## OUTPUT

**Return exactly ONE markdown file and nothing else** — no prose before or after
it, no second file. The file is named `design-overview.md`, in this order:

```text
design-overview.md
├── # Product summary       ← what this app is, who uses it, in the design's own terms
├── # Screen inventory      ← every screen/frame that exists, no exceptions
├── # User flows            ← every path a user can take, step by step
├── # Visual language       ← the look: color, type, spacing, shape, motion — as used
├── # Component inventory   ← every reusable piece and where it appears
├── # Design decisions      ← deliberate choices and the reasoning visible in the design
└── # Gaps & inconsistencies ← what is unfinished, contradictory, or undesigned
```

Output it in one fenced block, prefixed with its filename:

````markdown
**`design-overview.md`**

```markdown
<contents>
```
````

## HARD RULES

1. **Inventory is exhaustive.** Every screen, frame, variant, and state that
   exists in the project appears in the Screen inventory — including drafts,
   duplicates, and abandoned versions (mark them as such). An uncounted screen
   is a lost screen.
2. **As-built, not as-intended.** Document what is actually drawn. If the
   design implies behaviour that is not drawn (a hover state, a mobile layout,
   an error view), list it under **Gaps**, not as if it existed.
3. **Exact values.** Colors as hex/OKLCH, sizes in px, durations in ms, fonts by
   family + weight. No adjectives where a number belongs.
4. **Exact copy.** Quote user-visible strings verbatim — do not paraphrase.
5. **Flows are step-by-step.** Every flow names its trigger, each screen it
   passes through (by inventory name), each decision point with all branches,
   and its end state. "The user completes onboarding" is not a flow.
6. **Components are cross-referenced.** Every component names the screens it
   appears on; every screen's entry in the inventory names its notable
   components. The two lists must agree.
7. **Inconsistencies are findings, not errors to hide.** Where two screens
   disagree (different button styles, different spacing, different nav), record
   both values and name both screens.
8. If something genuinely does not apply, write `n/a` and one clause saying why.
   Never leave a field silently blank.

## SECTION TEMPLATES

### `# Product summary`

```markdown
# Product summary

- Product: <name, as used in the design>
- One-line purpose: <sentence>
- Primary users: <role and setting, as the design implies>
- Platform targets designed for: <desktop / mobile / both — which widths actually exist>
- Overall structure: <e.g. "sidebar app shell with N top-level sections">
```

### `# Screen inventory` (every screen — one row each)

```markdown
# Screen inventory

| #   | Screen name | Status                                  | Breakpoints drawn | Purpose (one line) | Notable components | Variants/states drawn       |
| --- | ----------- | --------------------------------------- | ----------------- | ------------------ | ------------------ | --------------------------- |
|     |             | <final / draft / duplicate / abandoned> | <e.g. 1440 · 375> |                    |                    | <e.g. empty, error, filled> |
```

### `# User flows` (repeat for every flow)

```markdown
## Flow: <name>

- Trigger: <what starts it>
- Steps: <Screen A> → <action, verbatim button/link label> → <Screen B> → …
- Decision points: <condition → branch, for every branch>
- End state: <where the user lands; what changed>
- States drawn along the way: <loading/success/error screens that exist for this flow>
```

### `# Visual language`

```markdown
# Visual language

| Aspect               | As used in the design                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| Color palette        | <every color in use: hex/OKLCH + where it is used>                        |
| Light/dark           | <which modes exist in the design>                                         |
| Type                 | <families, weights, and the actual sizes in use, px>                      |
| Spacing              | <the spacing steps actually used, px>                                     |
| Radius               | <values in use, px, per component type>                                   |
| Elevation/shadows    | <the shadow values in use>                                                |
| Borders/dividers     | <widths + colors in use>                                                  |
| Iconography          | <library if identifiable, weight, sizes in use>                           |
| Motion               | <any animation/transition the design specifies; else n/a — static frames> |
| Imagery/illustration | <style, where used>                                                       |
```

### `# Component inventory` (every reusable piece)

```markdown
# Component inventory

| Component | Description + exact specs (px, colors, type) | Appears on | Variants drawn |
| --------- | -------------------------------------------- | ---------- | -------------- |
|           |                                              |            |                |
```

### `# Design decisions`

```markdown
# Design decisions

| Decision | What was chosen | Evidence in the design | Why (if inferable) |
| -------- | --------------- | ---------------------- | ------------------ |
|          |                 |                        |                    |
```

### `# Gaps & inconsistencies`

```markdown
# Gaps & inconsistencies

## Undesigned but implied

| What is missing | Where it is implied | Suggested resolution |
| --------------- | ------------------- | -------------------- |
|                 |                     |                      |

## Inconsistencies between screens

| Aspect | Screen A (value) | Screen B (value) | Which should win? |
| ------ | ---------------- | ---------------- | ----------------- |
|        |                  |                  |                   |
```

## BEFORE YOU RETURN — self-check

Re-read your own output and confirm each. If any is "no", fix it before
returning:

- [ ] Output is a **single** `design-overview.md` — no other files
- [ ] **Every screen that exists** is in the inventory, including drafts and abandoned frames
- [ ] Every flow is **step-by-step with all branches**, using inventory screen names
- [ ] Component inventory and screen inventory **cross-reference and agree**
- [ ] Every color, size, duration, and font is an **exact value**
- [ ] Every user-visible string is **verbatim**
- [ ] Undrawn-but-implied behaviour is under **Gaps**, not presented as existing
- [ ] Inconsistencies are **recorded with both values**, not smoothed over
- [ ] Every blank field is `n/a` **with a reason** — nothing silently removed

Report at the end: `Screens inventoried: N. Flows: N. Components: N. Gaps: N.
Inconsistencies: N.`

---

## After it returns

1. Save `design-overview.md` directly into the iteration folder,
   `clinozy-fe/iterations/<iteration>/` — one file, beside the others.
2. Use it to sanity-check the other three files (`preset.md`, `screens.md`,
   `schema-routes.md`). For the launch, every screen in this inventory must
   have a section in `screens.md` and a row in the `schema-routes.md` route
   map. For any later iteration, SCOPE is the changed screens: each of those
   must have its spec and its routes, and the rest of the inventory is context,
   not work.
3. When the change touches the backend, copy `schema-routes.md` into the
   same-named clinozy-be iteration, `clinozy-be/iterations/<iteration>/`, too;
   then say **"kickoff <iteration>"**.
