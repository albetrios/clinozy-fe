# Screen: Clinic stock

- Route: /stock/:tab — Items · Movements · Purchases · Vendors
- Purpose: Clinic consumables and equipment used in procedures · not for sale.
- Entry points: header tab / All sections
- Exit points: item / vendor / purchase drawers, Stock check drawer
- Access: Therapist, Front desk, Owner
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

Section tone: mint.

## Regions

| Region  | Contains                                                                      | Desktop | Mobile | Notes |
| ------- | ----------------------------------------------------------------------------- | ------- | ------ | ----- |
| Toolbar | h1 "Clinic stock" · tabs · search · Filters · "Stock check" (Items) · "New …" | one row | wraps  |       |
| Table   | per tab                                                                       | full    | fold   |       |

## Data display

Tables. Stock cell "2.5 tube · 75 g". Filters › Category. Movements row action "Revert" (askDel) writes a linked "Reverted" entry.

## Forms

- Use popover (row action "Use"): 44px decimal stepper · unit toggle (tube ⇄ g, bottle ⇄ ml) · quick chips ¼ ½ 1 2 (or 1/5/10/25) · Used-for chips · live "After" line · Enter saves · Undo toast.
- Stock check drawer (840): every item — system qty · Counted input · ✓ same-as-system · difference pill · category chips · "Fill rest as matching" · "Save count".
- Item: name · category · unit (vial, ampoule, sachet, jar, roll, pair, ml, g, litre…) · size + mu.

## Popups

| Field           | Value                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape (desktop) | side drawer (right) · "Use" = popover (czddin) anchored to the row button                                                                                      |
| Shape (mobile)  | side drawer, width min(<size>, 100vw − 56px) — phone layout not designed                                                                                       |
| Trigger         | "New item" / "New purchase", row click, "Stock check"; "Use" row action opens a popover                                                                        |
| Size            | 680 (item) · 840 (purchase, Stock check)                                                                                                                       |
| Dismiss         | overlay click, Esc, floating × ; Discard in footer                                                                                                             |
| Header          | "New item" / "Edit item" · "New purchase" / "Edit purchase" (sub "Items received are added to stock") · "Stock check"; × floats outside the drawer's left edge |
| Footer          | Discard · "Add item" / "Create purchase" / "Save count" / "Save changes"                                                                                       |
| Multi-step      | yes — auto-split steps                                                                                                                                         |
| Initial focus   | Name                                                                                                                                                           |

## Multi-step flow

- **Sequence varies by input?** no.

## Preview / animated panels

n/a.

## Icons

| Element                | Icon name    | Size    | Semantic? |
| ---------------------- | ------------ | ------- | --------- |
| Section / empty        | package      | 16 / 18 | no        |
| Purchases tab          | receipt      | 14      | no        |
| Movements tab / Revert | refresh-cw   | 14 / 16 | yes       |
| New                    | plus         | 16      | no        |
| Use stepper            | minus / plus | 16      | yes       |

Library: Lucide · Weight: regular (2px stroke)

## Motion

| Element               | Property                                 | Duration            | Easing                    |
| --------------------- | ---------------------------------------- | ------------------- | ------------------------- |
| Popover / dropdown    | opacity, translateY −4px→0, scale .985→1 | 160ms               | cubic-bezier(.2,.8,.2,1)  |
| Right drawer panel    | transform translateX 100%→0              | 340ms               | cubic-bezier(.32,.72,0,1) |
| Drawer backdrop       | background-color transparent→dim         | 340ms               | cubic-bezier(.32,.72,0,1) |
| Drawer floating ×     | opacity, scale .9→1                      | 200ms (200ms delay) | ease                      |
| Toolbar search expand | width 36px→200px                         | 220ms               | cubic-bezier(.2,.8,.2,1)  |
| Skeleton shimmer      | background-position                      | 1100ms loop         | ease                      |
| Bulk bar              | translateY 100%→0                        | 220ms               | cubic-bezier(.32,.72,0,1) |

Reduced-motion: every animation and transition runs 1ms with no delay, iteration count 1 (shimmer stops), no smooth scroll.

## States

| Surface                       | Loading       | Empty                                                                                                                  | Error                                                                                                               |
| ----------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Items / Movements / Purchases | skeleton rows | package icon on mint tile · "No stock items here" · "Add consumables and equipment to track what each procedure uses." | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry"                              |
| Use popover                   | n/a — instant | n/a                                                                                                                    | toast "Undo"                                                                                                        |
| Drawers                       | "Saving…"     | n/a                                                                                                                    | "Add a name" / "Pick a supplier" · footer "Not saved · your changes are kept", button "Retry save", toast + "Retry" |

## Copy

| Key    | Exact string                                         |
| ------ | ---------------------------------------------------- |
| title  | "Clinic stock"                                       |
| check  | "Stock check", "Fill rest as matching", "Save count" |
| revert | "Revert", "Reverted"                                 |
