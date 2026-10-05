---
name: fe-rtl-logical-css
description: Keep the app mirror-correct under RTL — logical Tailwind properties instead of physical ml/mr/pl/pr/left/right, rtl: variants for transform-based motion, and the validate:logical gate. Use when adding or restyling any component, or when RTL renders half-flipped.
---

# RTL & logical CSS (clinozy-fe)

`dir` is set on `<html>` and users can switch to Arabic or force RTL from the
in-app Appearance panel, so **every** surface must mirror — not just auth. A
single physical utility is a visible bug for those users.

Gate: `pnpm validate:logical` (in the PR CI `static-sync` lane).
Reference: `docs/reference/internationalization.md`.
Related: `fe-locale-preferences` (how `dir` gets set) · `fe-tailwind-styling.mdc` ·
`fe-guard-authoring` (the gate itself).

---

## Conversion map

| Physical | Logical | Note |
| -------- | ------- | ---- |
| `ml-*` / `mr-*` | `ms-*` / `me-*` | including negatives: `-mr-1` → `-me-1` |
| `pl-*` / `pr-*` | `ps-*` / `pe-*` | |
| `left-*` / `right-*` | `start-*` / `end-*` | including negatives: `-right-8` → `-end-8` |
| `text-left` / `text-right` | `text-start` / `text-end` | |
| `border-l` / `border-r` | `border-s` / `border-e` | |
| `rounded-l-*` / `rounded-r-*` | `rounded-s-*` / `rounded-e-*` | `rounded-lg` is a size, not a side — leave it |

**Allowed as-is:** `left-1/2` / `right-1/2` used for symmetric centering (paired
with `-translate-x-1/2`). The gate strips this idiom from a line and re-tests, so
a real violation sharing the line is still caught.

## What logical properties do NOT flip

Transforms, glyphs and directional animations need an explicit `rtl:` variant —
they are not direction-aware:

```tsx
// translate-based hover / slide
className="… -translate-x-1/2 rtl:translate-x-1/2"
className="… slide-in-from-end-2 rtl:slide-in-from-start-2"
// a text arrow: rotate it rather than swapping the glyph
<span aria-hidden="true" className="inline-block rtl:rotate-180">→</span>
```

Existing precedents to copy: `Surface.tsx` (modal centering + drawer slide),
`AppearanceDialog.tsx`, vendored `ui/calendar.tsx` nav chevrons.

## Where RTL actually breaks

These were real clinozy-fe bugs — all of the same shape, an icon positioned
physically inside a container whose padding is logical:

| Pattern | Symptom |
| ------- | ------- |
| search icon `left-3` inside an input with `ps-9` | padding flips, icon does not → **icon overlaps the text** |
| accent bar `left-0` with `ps-4` content | bar on the wrong side |
| badge `-right-0.5` on a corner | badge on the wrong corner |
| sidebar `left-0` + `border-r` | shell pinned left with its divider on the wrong edge |

**Rule: if a container's padding is logical, its absolutely-positioned children
must be logical too.** Grep the pair when you touch either.

## Data inside RTL text (bidi isolation)

Mirroring the layout is half of RTL; the other half is **Latin data inside
right-to-left text**. The bidi algorithm lends a token's neutral characters
(spaces, `+`, `.`, `−`, `·`) to the run around it, so on an Arabic page
"+91 98250 44120" reads "44120 98250 91+", "Riya S." reads ".Riya S",
"11:30 AM" reads "AM 11:30" and "INV-787" reads "787-INV". Isolate the data —
never the sentence.

| What | Do |
| ---- | -- |
| An element that holds only data — a name, a phone, an id, a date | `dir="auto"` for free text, `dir="ltr"` for phones and ids (always left to right); on a line of its own add `[text-align:match-parent]` so it still aligns with the page (the table cells' mechanism, L-53) |
| A data token inside a translated sentence | keep the sentence in the page's direction; wrap the token with `isolateText(x)` / `t(key, isolateValues({ name, date }))` from `src/lib/bidi-isolate.ts` (FSI/LRI…PDI — the string form of `dir`) |
| The design's " · " join of values | `isolateJoin(parts)` (also behind `drawerStepSummary`) |
| An inline token rendered as an element | `<span dir="ltr">` / `<bdi>` inside the line |

Two traps:

- **`dir="auto"` only where the text is data.** It takes the first letter it
  meets — inside an isolate too — and many Arabic translations lead with the
  token (`{{name}} · …`), so a translated sentence under `dir="auto"` can turn
  left to right as a whole. A unit's data lines take it (the table cells', the
  Picker's label / sub / meta, a pill's label, the drawer title and tag); a
  sentence slot — `RecordDrawer`'s `sub` — keeps the page's direction and its
  callers isolate the tokens.
- **Never isolate text that leaves the screen** — message templates and
  starters (they are sent), task titles and notes (they are stored), copied
  values and CSV cells. The marks are invisible but real characters.

Tests: assert the attribute (`toHaveAttribute('dir', 'auto')`) or the marks —
`fsi()` / `lri()` / `withoutBidiMarks()` from `tests/utils/bidi-marks.ts`.

## Verify

```bash
pnpm validate:logical
```

Vendored `src/shared/components/ui/**`, tests and fixtures are exempt. If you need
a physical utility in app code, the correct move is almost always a logical one —
do not add an exemption without a reason in the PR body.

**Screenshot-verify at least one RTL surface** when you change layout: set
Appearance → Text direction → RTL, or switch to Arabic, and confirm the surface
mirrors rather than trusting the gate alone. The gate catches physical utilities;
it cannot catch a transform that needed an `rtl:` variant.
