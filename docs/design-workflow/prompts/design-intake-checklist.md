# Design intake checklist

**Portable. No project, framework, or design tool assumed.**

What to extract from a design source _before_ planning implementation, so you can
answer one question honestly: **can this be built faithfully, or not?**

Use it whenever the requirement is "same as the design" rather than "inspired by".

> **The core insight:** a route map is not a UI spec. Mapping
> `/things` → `/app/things` says nothing about what is _inside_ the screen. Nearly
> every "why doesn't it match?" cycle traces back to a structural fact that was
> never written down — a popup's shape, a step sequence, a mobile behaviour.

---

## How to use

1. Ask the design source to fill **Part A** — one markdown file per screen.
2. Score each screen with the **Part B** gate.
3. Anything AMBER or RED is resolved **before** it enters a build phase.
4. Read **Part C** — those are the fields people omit, and each one silently
   produces "looks similar, isn't the same".

Request markdown, not prose: _"Return one `.md` per screen using this template.
Leave a field blank only if it genuinely does not apply, and say why."_

---

## Part A — what to extract

### A1. Screen overview (one per route)

```markdown
# Screen: <name>

- Route: /path/with/:params
- Purpose: <one sentence>
- Entry points: <what navigates here>
- Exit points: <where the user goes next>
- Access: <role/permission, or "public">
- Layout shell: <app shell | auth shell | full-bleed | embedded>
- Breakpoints: desktop <cols/width> · tablet <…> · mobile <…>
```

### A2. Region map (per screen)

Break the screen top-to-bottom. Most-skipped section; the one that makes an
implementation recognisable.

| Region              | Contains                        | Desktop      | Mobile                       | Notes        |
| ------------------- | ------------------------------- | ------------ | ---------------------------- | ------------ |
| Header              | title, subtitle, primary action | inline right | stacked, full-width button   |              |
| Toolbar             | search, filters, sort           | one row      | search only; filters → sheet |              |
| Body                | list / grid / table             | 3-col grid   | 1-col                        |              |
| Empty state         | icon, headline, body, CTA       |              |                              | **required** |
| Footer / pagination |                                 |              |                              |              |

**Always keep desktop and mobile as separate columns.** A single "responsive: yes"
tells you nothing.

### A3. Data display — name the primitive

Ask explicitly. "A list of items" is ambiguous; card vs table changes the build.

**Tables**

| Field                   | Value                                        |
| ----------------------- | -------------------------------------------- |
| Columns (ordered)       |                                              |
| Column widths           | fixed / fluid / min-max per column           |
| Sortable columns        | which                                        |
| Row height              | compact / default                            |
| Row click               | navigates / opens dialog / nothing           |
| Row actions             | inline icons / kebab menu / hover-reveal     |
| Selection               | none / single / multi + bulk bar             |
| **Mobile behaviour**    | **horizontal scroll, or collapse to cards?** |
| Pagination              | pages / infinite scroll / load-more          |
| Empty · loading · error | skeleton rows? spinner?                      |

**Cards**

| Field            | Value                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Grid             | columns and min card width per breakpoint                                    |
| Anatomy          | ordered elements + sizes (e.g. avatar 44px, title, meta, chips, footer rule) |
| Meta line format | **exact string**, incl. separators and date format                           |
| Truncation       | which fields, how many lines                                                 |
| Actions          | position; hover-only?                                                        |
| Mobile           | full width; do actions wrap to their own row?                                |

**Lists** — as cards, plus separator style (border / hairline / none).

### A4. Forms

| Field              | Value                                     |
| ------------------ | ----------------------------------------- |
| Fields (ordered)   | name, type, label, placeholder, help text |
| Field widths       | full / half / inline pairs                |
| Required markers   | asterisk / "optional" suffix              |
| Validation trigger | on blur / on submit / live                |
| Error display      | below field / summary / both              |
| Submit             | label, position, disabled rules           |
| Loading            | button spinner? whole-form lock?          |
| Success            | toast / inline / navigate away            |
| Dirty-state guard  | confirm before closing?                   |

### A5. Popups — get the _shape_ first

The highest-value rows in this document. Dialog and sheet are not
interchangeable; guessing wrong means a rebuild, not a tweak.

| Field               | Value                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| **Shape**           | **centered dialog / bottom sheet / side drawer / popover / inline expand / full page** |
| **Shape on mobile** | **often differs — state it separately**                                                |
| Trigger             | which control                                                                          |
| Size                | width, max-height, full-bleed?                                                         |
| Dismiss             | overlay click / Esc / explicit close only                                              |
| Header              | title, subtitle, close-button position                                                 |
| Footer              | button order and alignment                                                             |
| **Multi-step?**     | if yes → A6                                                                            |
| Nested popups       | allowed?                                                                               |
| Focus               | initial focus target; focus-trap; return target on close                               |

### A6. Multi-step flows

| Field                                     | Value                                       |
| ----------------------------------------- | ------------------------------------------- |
| Steps (ordered)                           |                                             |
| **Does the sequence vary by user input?** | if yes, give the mapping per input type     |
| Progress indicator                        | segmented bar / dots / "Step N of M" / none |
| Navigation                                | back/next labels; skippable?                |
| Per-step validation                       | blocks next?                                |
| Final step                                | submit label; what happens                  |
| Edit mode                                 | prefilled? same steps? jump to any step?    |

> **Conditional sequences are the most-missed field in any wizard spec.** If the
> design has them and the doc omits them, you build one linear flow and rebuild.

### A7. Preview / simulation panels

Any live preview, device mock, or animated demo:

| Field                        | Value                                         |
| ---------------------------- | --------------------------------------------- |
| Surfaces                     | how many distinct views                       |
| Switching                    | tabs / automatic by context / both            |
| Which surface per input type | mapping table                                 |
| Animated?                    | frame sequence + **exact duration per frame** |
| Progressive reveal           | which elements appear at which frame          |
| Static fallback              | what shows before and after                   |

### A8. Icons

| Field                  | Value                        |
| ---------------------- | ---------------------------- |
| Library                |                              |
| Weight / style         |                              |
| Sizes used             |                              |
| **Per-icon list**      | screen → element → icon name |
| Decorative vs semantic | which need accessible labels |

Get **names**, not screenshots. A missing name becomes a guess, and a guessed
icon is visible.

### A9. Motion

| Field           | Value                                  |
| --------------- | -------------------------------------- |
| Transitions     | element → property → duration → easing |
| Entrance / exit | dialogs, sheets, list items            |
| Stagger         | list animation delay                   |
| Reduced-motion  | what degrades, and to what             |

### A10. States — for every surface in A2–A7

Loading · empty · error · partial · offline · permission-denied · success.

Missing empty states are the most common gap and the first thing a reviewer sees
on a fresh account.

### A11. Copy

Exact strings: titles, buttons, placeholders, empty states, errors, toasts,
tooltips. Plus pluralisation rules, date and number formats, and any
localisation constraints.

Paraphrased copy reads as "not the same" even when layout is perfect.

### A12. Theme / design tokens

| Field                      | Value                                                         |
| -------------------------- | ------------------------------------------------------------- |
| Colour tokens              | semantic names + values, **light and dark**                   |
| Brand colour               | + measured contrast; if it fails, which non-text uses keep it |
| Typography                 | families, weights, scale; **self-hosted or CDN?**             |
| Spacing / density scale    |                                                               |
| Radius, elevation, borders |                                                               |
| Ambient effects            | gradients, grid overlays, blur, shadows — **often missed**    |

Recompute contrast locally. Design handoffs routinely miscalculate WCAG, and
most lint rules check token _usage_, not _ratios_.

---

## Part B — readiness gate

Score every screen before it enters a build phase.

| Score    | Meaning                                                      | Action                              |
| -------- | ------------------------------------------------------------ | ----------------------------------- |
| 🟢 GREEN | A1–A12 complete; popup shape and mobile behaviour explicit   | Ready to build                      |
| 🟡 AMBER | Structure known; details missing (copy, icon names, timings) | Build layout; resolve before "done" |
| 🔴 RED   | Any of the four below                                        | **Do not build. Resolve first.**    |

**The four RED blockers** — each forces a rebuild rather than a tweak:

1. Popup **shape** unknown
2. **Mobile** behaviour unknown
3. Conditional **step sequence** unknown
4. **Table vs card** unknown

Per-screen scoreboard:

| Screen | A1  | A2  | A3  | A4  | A5  | A6  | A7  | A8  | A9  | A10 | A11 | A12 | Score |
| ------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ----- |
|        |     |     |     |     |     |     |     |     |     |     |     |     |       |

---

## Part C — what silently breaks fidelity

| #   | Gap                                    | Symptom                                                      | Prevented by                |
| --- | -------------------------------------- | ------------------------------------------------------------ | --------------------------- |
| 1   | Popup **shape** unstated               | Centered dialog built where a bottom sheet was designed      | A5                          |
| 2   | Conditional **step sequence** unstated | One linear form; design varied steps by input                | A6                          |
| 3   | **Mobile** unstated                    | Desktop-only build; nav unusable, content overflowing        | A1 + A2                     |
| 4   | **Preview surfaces** unstated          | Built one view of several                                    | A7                          |
| 5   | **Timing** unstated                    | Static where the design animated                             | A7 + A9                     |
| 6   | **Copy** paraphrased                   | Reads as a different product                                 | A11                         |
| 7   | **Icon names** unstated                | Wrong glyphs; visibly off                                    | A8                          |
| 8   | **Empty/loading states** unstated      | Blank screen on a fresh account                              | A10                         |
| 9   | Source **described but not read**      | Built from a summary; wrong contracts, wrong structure       | Read-and-report gate, below |
| 10  | DONE defined **functionally**          | "User can complete the task" passed while UI matched nothing | Comparative DONE, below     |

### Two process fixes that prevent most of the above

**Add a read-and-report gate.** Before any build phase: _"Read the source files.
Report what they contain — screens, components, interaction shapes. Then stop."_
Building from a plan's description of a source, rather than the source, is the
single most expensive failure mode. It produces confidently wrong structure.

**Make DONE comparative.** Functional gates cannot detect a fidelity defect:

- ❌ "Screenshots captured, light and dark"
- ✅ "**Side-by-side** screenshot — source vs implementation — at **mobile and
  desktop widths**, per screen, per state"

A gate that can fail is worth ten that can't.

---

## Minimum viable ask

If you send one message to the design source, send this:

> For each screen, return a markdown file covering: route and purpose; a
> top-to-bottom region map with **separate desktop and mobile columns**; whether
> lists are tables or cards and how they behave on mobile; every form field in
> order with validation and error placement; for each popup its **shape**
> (centered dialog / bottom sheet / side drawer) **including whether the shape
> changes on mobile**; for any multi-step flow the step list **and whether the
> sequence changes based on user input**; any preview or animated panel with its
> frame sequence and exact timings; icon **names** with library and weight; exact
> copy for titles, buttons, placeholders, empty states and errors; the loading,
> empty and error state for every surface; and the design tokens for light and
> dark.
>
> Leave a field blank only if it genuinely does not apply, and say why. Do not
> paraphrase copy.

---

## Adapting this file

- **Add sections** for domains it doesn't cover: data-visualisation, real-time
  updates, drag-and-drop, maps, editors, print/export layouts.
- **Keep Part B's RED list short.** Its value is that it blocks rarely. Adding
  items makes it easy to ignore.
- **Project-specific rules** (lint gates, token conventions, component library
  constraints) belong in a per-project appendix, not in this file.
