# Paste this to Claude Design

Produces **one** file — `screens.md` — holding the shell, a screen index, and
every screen spec. Save it into `clinozy-fe/legacy/`, then say **"implement from
legacy"**. (The theme preset comes from the separate `design-brief-prompt.md` as
`preset.md`; do **not** produce a preset here.)

Fill in the two lines under **SCOPE**. Everything else is paste-as-is.

---

You are writing an implementation specification for a developer who **cannot see
your design**. They will build from your markdown alone. Anything you leave out,
they will invent — and it will be wrong.

Do not summarise, do not paraphrase, do not describe the design in prose. Fill
the template.

## COMPLETENESS MANDATE — read first, applies to every screen

**Capture everything. Remove nothing. Assume no detail is too small.** The
developer has only this file; a detail you consider "obvious" or "minor" does not
exist to them until you write it down. Err on the side of over-specifying.

- **Every screen gets the FULL template.** Do not abbreviate a screen because it
  "looks simple", do not write "same as above", and do not collapse two screens
  into one. Repeat the entire screen section for each screen, every field filled.
- **Every interactive element** must have its **default, hover, focus, active,
  disabled, and loading** appearance specified — states are not optional.
- **Every value is exact.** px, ms, hex/OKLCH, font weight, line-height, z-index,
  character limits, debounce/throttle timings, page sizes, date/number/currency
  formats (with locale and timezone), sort order and default sort — never an
  adjective, never "some", never "a few".
- **Every edge case** the screen can reach: long text / truncation, zero items,
  one item, many items (scroll), max items, over-limit input, network error,
  permission-denied, offline, slow load, stale data. If a state is reachable, spec it.
- **Every role / permission variant.** If what a user sees or can do changes by
  role, plan, or feature flag, give the mapping for each — do not describe only
  the happy-path admin view.
- **Do not drop a field to save space.** If a field truly does not apply, write
  `n/a` **with a one-clause reason** — a blank or a deleted row reads as "missed".

## SCOPE

- Screens to specify: `<list them, or "every screen">`
- Design source: `<project name / file / URL>`

## OUTPUT

**Return exactly ONE markdown file and nothing else** — no prose before or after
it, no second file, no subfolders. The file is named `screens.md` and it holds
**everything**: the shell, the screen index, and one section per screen, in this
order:

```text
screens.md
├── # Shell            ← header, sidebar, nav — the frame around every screen
├── # Index            ← every screen: route + one-line purpose
├── # Screen: <name>   ← one section per screen (repeat the screen template)
├── # Screen: <name>
└── …
```

Do not emit `shell.md`, `_index.md`, or per-screen files. Merge all of it into the
single `screens.md`. Output it in one fenced block, prefixed with its filename:

````markdown
**`screens.md`**

```markdown
<contents>
```
````

## HARD RULES

1. **Name the popup shape.** "A modal opens" is not a specification. Say
   _centered dialog_, _bottom sheet_, _side drawer_, _popover_, _inline expand_,
   or _full page_. If the shape changes on mobile, say so on a separate line.
2. **Separate desktop and mobile.** Every layout table has both columns. Never
   write "responsive" as an answer.
3. **Conditional flows.** If a multi-step flow's step sequence changes based on
   user input, give the mapping for every input value. This is the most commonly
   omitted fact and the most expensive to discover late.
4. **Exact copy.** Quote every user-visible string verbatim — titles, buttons,
   placeholders, empty states, errors, tooltips. Do not paraphrase or improve it.
5. **Icon names, not descriptions.** "gear icon" is unusable; give the library
   and the icon name.
6. **Every state.** Loading, empty, error, and success for every surface. A
   screen spec without an empty state is incomplete.
7. **Numbers, not adjectives.** "spacious" → the actual spacing. "quick fade" →
   the actual duration in ms. "large avatar" → the actual px.
8. If something genuinely does not apply, write `n/a` and one clause saying why.
   Never leave a field silently blank.
9. **All interaction states, always.** For every interactive element name the
   default, hover, focus (keyboard ring included), active/pressed, disabled, and
   loading appearance. "A button" without its states is incomplete.
10. **Validation is a spec, not a vibe.** For every field give the rule, WHEN it
    fires (on blur / on change / on submit), the exact error string, and the
    allowed range/format/character limit. State the default/prefilled value.
11. **Formats are explicit.** Every date, time, number, currency, percentage, and
    relative-time string gets its exact format, locale, and timezone. "a date" is
    unusable.
12. **Keyboard + focus behaviour.** Tab order, initial focus, focus trap in
    popups, Esc/Enter handling, and any shortcut. Screens without this get built
    inaccessible.
13. **Ordering and defaults.** Default sort, sort options, default filters,
    default tab, default page size, and what "first load" shows before any input.
14. **Boundaries and limits.** Truncation rules, max lengths, min/max counts,
    overflow behaviour, and what happens at zero / one / max items.

Assemble the single `screens.md` from the three parts below, in order: the
**Shell** section once, the **Index** section once, then the **Screen** section
repeated for every screen.

## PART 1 — `# Shell` (once, the frame around every screen)

```markdown
# Shell

## Structure

| Field             | Desktop                                          | Mobile                        |
| ----------------- | ------------------------------------------------ | ----------------------------- |
| Shape             | <left sidebar / top nav / icon rail / no chrome> |                               |
| Sidebar width     | <expanded / collapsed px>                        | n/a?                          |
| Collapsible?      | <yes/no; what triggers it; is it persisted?>     |                               |
| Header height     |                                                  |                               |
| Content max-width |                                                  |                               |
| Nav position      |                                                  | <bottom bar? drawer? hidden?> |

## Header — left to right

| Slot | Contents | Mobile behaviour |
| ---- | -------- | ---------------- |
|      |          |                  |

## Sidebar — top to bottom

| Slot | Contents | Mobile behaviour |
| ---- | -------- | ---------------- |
|      |          |                  |

## Navigation

| Field                 | Value                                     |
| --------------------- | ----------------------------------------- |
| Items (ordered)       | label + icon name each                    |
| Active treatment      | <background / left bar / weight / colour> |
| Hover treatment       |                                           |
| Grouping              | <sections with headings? dividers?>       |
| Overflow              | <scroll / "more" menu>                    |
| Badge / count support |                                           |

## Where do these live?

The implementing app has platform surfaces your design may not include. Every one
of them **will be kept** — the question is only _where_ they sit in your layout,
not whether. For each, name the slot; if your design has no natural home, suggest
the closest fit (an avatar/user menu is usually it). **Do not omit a row and do
not answer "not applicable".**

| Surface                                                             | Placement in your shell |
| ------------------------------------------------------------------- | ----------------------- |
| Brand logo / wordmark                                               |                         |
| Primary navigation items                                            |                         |
| Organization / workspace switcher                                   |                         |
| Global search / command palette trigger                             |                         |
| Notifications                                                       |                         |
| Light/dark mode toggle                                              |                         |
| User profile + sign-out                                             |                         |
| Settings entry point                                                |                         |
| Account shortcuts (profile, security, billing, appearance, devices) |                         |
| System banner (e.g. "verify your email")                            |                         |
| Mobile navigation                                                   |                         |
| Mobile menu trigger                                                 |                         |

## Responsive

| Breakpoint | What changes |
| ---------- | ------------ |
|            |              |

Name the exact px at which the sidebar collapses, the nav moves, and anything in
the header hides.
```

---

## PART 2 — `# Index` (once, every screen at a glance)

```markdown
# Index

| Screen | Route | Purpose (one line) |
| ------ | ----- | ------------------ |
|        |       |                    |
```

---

## PART 3 — `# Screen: <name>` (repeat this section for every screen)

```markdown
# Screen: <name>

- Route: /path/with/:params
- Purpose: <one sentence>
- Entry points: <what navigates here>
- Exit points: <where the user goes next>
- Access: <role/permission, or public>
- Layout shell: <app shell | auth shell | full-bleed>
- Breakpoints: desktop <width> · tablet <width> · mobile <width>

## Regions (top to bottom)

| Region | Contains | Desktop | Mobile | Notes |
| ------ | -------- | ------- | ------ | ----- |
|        |          |         |        |       |

## Data display

Primitive: <table | cards | list | none>

<!-- If table -->

| Field             | Value                                    |
| ----------------- | ---------------------------------------- |
| Columns (ordered) |                                          |
| Column widths     |                                          |
| Sortable          |                                          |
| Row height        |                                          |
| Row click         |                                          |
| Row actions       |                                          |
| Selection         |                                          |
| Mobile behaviour  | <horizontal scroll OR collapse to cards> |
| Pagination        | <pages / infinite scroll / load-more>    |

<!-- If cards -->

| Field      | Value                                           |
| ---------- | ----------------------------------------------- |
| Grid       | <cols + min card width, per breakpoint>         |
| Anatomy    | <ordered elements with px sizes>                |
| Meta line  | <exact string incl. separators and date format> |
| Truncation |                                                 |
| Actions    |                                                 |
| Mobile     |                                                 |

## Forms

| Order | Field | Type | Label | Placeholder | Help | Required | Validation |
| ----- | ----- | ---- | ----- | ----------- | ---- | -------- | ---------- |
|       |       |      |       |             |      |          |            |

- Error display: <below field / summary / both>
- Submit: <label, position, disabled rules>
- Loading: <button spinner / form lock>
- Success: <toast / inline / navigate>
- Dirty-state guard: <confirm on close?>

## Popups

| Field           | Value                             |
| --------------- | --------------------------------- |
| Shape (desktop) |                                   |
| Shape (mobile)  |                                   |
| Trigger         |                                   |
| Size            |                                   |
| Dismiss         | <overlay / Esc / explicit only>   |
| Header          | <title, subtitle, close position> |
| Footer          | <button order and alignment>      |
| Multi-step      | <yes/no>                          |
| Initial focus   |                                   |

## Multi-step flow

- Steps (ordered):
- **Sequence varies by input?** <no | mapping per input value>
- Progress indicator: <segmented bar / dots / "Step N of M" / none>
- Navigation: <back/next labels; skippable?>
- Per-step validation: <blocks next?>
- Edit mode: <prefilled? same steps? jump to any step?>

## Preview / animated panels

| Field                  | Value                          |
| ---------------------- | ------------------------------ |
| Surfaces               | <how many distinct views>      |
| Switching              | <tabs / automatic / both>      |
| Surface per input type | <mapping>                      |
| Frame sequence         | <ordered frames>               |
| Frame durations        | <exact ms per frame>           |
| Progressive reveal     | <which element at which frame> |
| Static fallback        |                                |

## Icons

| Element | Icon name | Size | Semantic? |
| ------- | --------- | ---- | --------- |
|         |           |      |           |

Library: <name> · Weight: <name>

## Motion

| Element | Property | Duration | Easing |
| ------- | -------- | -------- | ------ |
|         |          |          |        |

Reduced-motion: <what degrades, and to what>

## States

| Surface | Loading | Empty | Error |
| ------- | ------- | ----- | ----- |
|         |         |       |       |

## Copy

| Key | Exact string |
| --- | ------------ |
|     |              |
```

## BEFORE YOU RETURN — self-check

Re-read your own output and confirm each. If any is "no", fix it before
returning:

- [ ] Output is a **single** `screens.md` — shell + index + all screens merged, no other files
- [ ] **Every screen in the Index has a full screen section** — none abbreviated, none "same as above", none merged
- [ ] Every interactive element specs **default / hover / focus / active / disabled / loading**
- [ ] Every field specs its **validation rule, when it fires, exact error string, limit, and default value**
- [ ] Every date / number / currency / relative-time has an **exact format, locale, and timezone**
- [ ] **Keyboard + focus** covered: tab order, initial focus, focus trap, Esc/Enter, shortcuts
- [ ] **Defaults + ordering** stated: default sort, default filter, default tab, page size, first-load view
- [ ] **Edge cases** covered: zero / one / many / max items, truncation, over-limit, offline, permission-denied
- [ ] **Role/permission variants** mapped wherever the view or actions differ
- [ ] Every popup names a concrete **shape**, and states mobile separately
- [ ] Every layout table has a filled **Mobile** column
- [ ] Every multi-step flow answers **"sequence varies by input?"** explicitly
- [ ] Every list says **table or cards**, and what it does on mobile
- [ ] Every user-visible string is quoted **verbatim**
- [ ] Every icon has a **name**, not a description
- [ ] Every surface has **loading, empty, and error**
- [ ] No adjective stands where a **number** belongs
- [ ] Every blank field is `n/a` **with a reason** — nothing silently removed

Report at the end: `Screens specified: N. Fields marked n/a: M. Gaps I could not
resolve: <list, or none>.` If any screen section is shorter than the full
template, go back and fill it before returning.

---

## After it returns

1. Save `screens.md` directly into `clinozy-fe/legacy/` — one file, no subfolders.
   (The preset lives beside it as `preset.md` from the design-brief prompt.)
2. Say **"implement from legacy"**.

I'll score each screen against
[the intake gate](ditto-intake-checklist.md) before writing code — anything
scoring RED (unknown popup shape, unknown mobile behaviour, unknown conditional
step sequence, unknown table-vs-card) comes back to you as a question rather than
becoming a guess.
