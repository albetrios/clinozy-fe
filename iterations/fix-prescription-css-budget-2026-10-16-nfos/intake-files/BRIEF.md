# Brief — the prescription drawer within the 36 kB first-paint CSS budget

## What changes

PR albetrios/clinozy-fe#88 (the seven frozen prescription iterations, from
feat-prescription-composer-2026-10-14-alos to change-prescription-one-line-2026-10-15-emnn) failed
CI's "Build verify": **Initial CSS 36.55 kB against its 36 kB limit**. Tailwind emits every
utility a source file names into the one first-paint stylesheet, whether or not the screen is
open. The drawer, the shared quantity stepper and the palette's prescribe chip named 50 utilities
the stylesheet did not yet ship (≈ 560 B gzipped). `main` has ≈ 10 B of headroom.

The same screens, with nothing added to the first-paint stylesheet:

1. **What only the drawer draws moves into a stylesheet that loads with it.** This covers the
   line's tracks (with a mouse and on touch), the segments' sizes, the quantity box, the note's
   indent, the line number and the medicine picker on touch, the Rx check's and the allergy
   buttons' touch heights, the Rx Pad's heights, the remark's italic and the quiet hover. The new
   `prescription-drawer.css` is imported by the drawer, the way `bug-report.css` is imported by
   Report a bug.
2. **The quantity stepper's 44px on touch** goes in `items-field.css`, loaded with the shared items
   table and keyed on the stepper's `data-touch-size="large"`.
3. **Colours and spacing use what the stylesheet already ships.**
   - The allergy tints become the theme's `destructive-tint` and `destructive-border` tokens.
   - The emphasised allergy ring is `ring-2`.
   - The Rx Pad's key hint is the drawer footer's (`border-primary-foreground/25
     text-primary-foreground/70`).
   - The Pad's overflow line is `text-tone-butter-foreground`.
   - The Rx check's padding is `py-4`, and the allergy line's minimum width is `min-w-45`.
   - The Pad toggle's word hides on a phone with `hidden sm:inline`, and the button keeps its name
     through `aria-label`.
   - The palette chip's close button centres with flex and uses `pe-1` and `hover:bg-background`.
4. **`motion-reduce:transition-none` is dropped.** The global reduced-motion block in `index.css`
   already collapses every transition.

## Why

A failed size budget blocks the merge, and budgets are not raised to let a change in: the
stylesheet's history itemises every raise against first-paint screens, and the prescription
drawer opens on demand.

## Affected screens, entities and routes

- Screens: the prescription drawer (lines, More, the Rx check, the Rx Pad, the allergy band and
  row warnings), the shared items table's quantity stepper on touch, the command palette's
  prescribe chip
- Entities: none
- Routes: none

## Rules

- No new utility in the first-paint stylesheet: the built `index-*.css` has no rule `main`'s
  lacks.
- What the seven frozen iterations specify stays true: one numbered line per medicine with the
  same tracks, 44px controls on touch (segments, picker, stepper, the Rx check's and allergy
  buttons), the allergy warning under its row.

## Acceptance criteria

- [ ] "Build verify" passes: Initial CSS within 36 kB.
- [ ] The built first-paint stylesheet has no rule `main`'s lacks; the drawer's rules ship in a
      stylesheet of their own that is not linked from `index.html`.
- [ ] At 1440 with a mouse a line keeps its tracks (128 · 200 · 170 · 88px); at 1024 on touch the
      segments, the picker and the stepper are 44px tall.
- [ ] Type-check, lint, the static gates and the colocated tests pass.

## Out of scope

- Raising the CSS budget.
- Anything the seven frozen iterations do not already specify.
