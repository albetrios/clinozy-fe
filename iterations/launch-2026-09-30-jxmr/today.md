# Screen: Today

- Route: /today
- Purpose: The clinic floor now: arrivals, waiting, with doctor, checkout.
- Entry points: splash (default home), header tab, All sections
- Exit points: appointment form drawer, patient file, payment drawer
- Access: all roles; each role's focus stages highlighted (Front desk: enquiry, booked, waiting, checkout · Doctor: waiting, doctor · Therapist: treatment · Counsellor: doctor, checkout · Pharmacist: pharmacy · Accountant: checkout)
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

Section tone: butter.

## Regions (top to bottom)

| Region       | Contains                                                                          | Desktop              | Mobile            | Notes                      |
| ------------ | --------------------------------------------------------------------------------- | -------------------- | ----------------- | -------------------------- |
| Toolbar      | h1 "Today", date, New split button                                                | one row              | wraps             | see _patterns List toolbar |
| Floor stages | Enquiry · Booked · Waiting · With doctor · Treatment · Checkout · Pharmacy · Done | columns side by side | horizontal scroll | order fixed                |

## Data display

Primitive: cards (one card per visit inside its stage).

| Field      | Value                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Grid       | main column (stages) + right aside (border-left hairline, #fafafa); main padding 16px 22px 12px, gap 14px                           |
| Anatomy    | person chip (28px, 22px avatar, P badge) · time · service · doctor chip · plan flag ("✓ Plan ready" sage / "○ Plan pending" butter) |
| Meta line  | "<time> · <service> · <doctor short name>" (e.g. "11:30 · Hydrafacial · Dr. Reenal")                                                |
| Truncation | single-line ellipsis                                                                                                                |
| Actions    | card click → appointment form drawer                                                                                                |
| Mobile     | stage columns scroll horizontally                                                                                                   |

## Forms

n/a — actions open drawers (see appointments.md).

## Popups

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Shape (desktop) | side drawer (right)                                                      |
| Shape (mobile)  | side drawer, width min(<size>, 100vw − 56px) — phone layout not designed |
| Trigger         | visit card click                                                         |
| Size            | 560–760 form + chat column (appointment form)                            |
| Dismiss         | overlay click, Esc, floating × ; Discard in footer                       |
| Header          | who box (avatar, name, phone); × floats outside the drawer's left edge   |
| Footer          | Discard · "Save changes"                                                 |
| Multi-step      | yes — see appointments.md                                                |
| Initial focus   | Visit status strip                                                       |

## Multi-step flow

n/a on this screen.

## Preview / animated panels

n/a — no animated panels.

## Icons

| Element    | Icon name    | Size | Semantic? |
| ---------- | ------------ | ---- | --------- |
| Section    | home         | 16   | no        |
| Plan ready | circle-check | 12   | yes       |

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

| Surface      | Loading        | Empty                                      | Error                                                                                  |
| ------------ | -------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Stage column | skeleton cards | "No one here right now." (12.5px, #52525b) | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry" |

## Copy

| Key          | Exact string                                                           |
| ------------ | ---------------------------------------------------------------------- |
| title        | "Good morning, <first name>" (23px / 600) + pulse line (13px, tabular) |
| nav label    | "Today"                                                                |
| section desc | "The clinic floor now: arrivals, waiting, with doctor, checkout"       |
| plan ready   | "✓ Plan ready"                                                         |
| plan pending | "○ Plan pending"                                                       |
