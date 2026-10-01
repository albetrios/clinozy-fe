# Screen: Offerings

- Route: /offerings
- Purpose: What the clinic sells: offerings, packages, offers and prices.
- Entry points: header tab, "＋ New offering" from any offering dd (stacked)
- Exit points: offering / package / offer drawers
- Access: Owner, Counsellor
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

Section tone: lime.

## Regions

| Region  | Contains                                                             | Desktop | Mobile | Notes |
| ------- | -------------------------------------------------------------------- | ------- | ------ | ----- |
| Toolbar | h1 "Offerings" · tabs · search · Filters (Category) · "New offering" | one row | wraps  |       |
| Table   | offerings                                                            | full    | fold   |       |

## Data display

Table: category pill · name · sessions · list price · min price · live offers.

## Forms — Offering drawer

| Order | Field    | Type            | Label         | Placeholder          | Help | Required | Validation |
| ----- | -------- | --------------- | ------------- | -------------------- | ---- | -------- | ---------- |
| 1     | n        | text (half)     | Name          | "e.g. LHR Full Face" |      | yes      | maxLength  |
| 2     | cat      | chips (full)    | Category      |                      |      | yes      |            |
| 3     | price    | money (third)   | Price         | "₹ 0"                |      | yes      | digits     |
| 4     | min      | money (third)   | Minimum price | "₹ 0"                |      | no       | ≤ price    |
| 5     | sessions | stepper (third) | Sessions      |                      |      | no       | clamp      |

Submit "Save" · Loading "Saving…" · Success toast.

## Popups

| Field           | Value                                                                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape (desktop) | side drawer (right)                                                                                                                                               |
| Shape (mobile)  | side drawer, width min(<size>, 100vw − 56px) — phone layout not designed                                                                                          |
| Trigger         | "New offering" / "New offer", row click, "＋ New offering" from any offering dropdown (stacked)                                                                   |
| Size            | 680                                                                                                                                                               |
| Dismiss         | overlay click, Esc, floating × ; Discard in footer                                                                                                                |
| Header          | "New offering" / "Edit offering" · "New offer" (sub "A limited-time price on one or more offerings · applies by itself"); × floats outside the drawer's left edge |
| Footer          | Discard · "Save"; presets "Single session" · "6-session pack"                                                                                                     |
| Multi-step      | yes — auto-split                                                                                                                                                  |
| Initial focus   | Name                                                                                                                                                              |

## Multi-step flow

- **Sequence varies by input?** no.

## Preview / animated panels

n/a.

## Icons

| Element         | Icon name | Size    | Semantic? |
| --------------- | --------- | ------- | --------- |
| Section / empty | tag       | 16 / 18 | no        |
| New             | plus      | 16      | no        |
| Delete          | trash     | 16      | yes       |

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

| Surface | Loading       | Empty                                                                                                                   | Error                                                                                  |
| ------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Table   | skeleton rows | tag icon on sky tile · "No offerings yet" · "Add treatments and packages with prices so they can be booked and billed." | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry" |
| Drawer  | "Saving…"     | n/a                                                                                                                     | footer "Not saved · your changes are kept", button "Retry save", toast + "Retry"       |

## Copy

| Key     | Exact string         |
| ------- | -------------------- |
| title   | "Offerings"          |
| name ph | "e.g. LHR Full Face" |
