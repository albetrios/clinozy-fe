# Screen: Payments

- Route: /payments/:tab — Payments · Pending
- Purpose: Collections, invoices and dues — one ledger for clinic, consultation, Medical and stock purchases.
- Entry points: header tab, patient rail "Collect", invoice drawer
- Exit points: Receive / Pay / credit drawers, Day close drawer
- Access: Front desk, Accountant, Owner
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

Section tone: peach. One id format for everything: PAY-#### (old TX-/RF-/EX- display as PAY-).

## Regions

| Region  | Contains                                                                                                                                            | Desktop | Mobile | Notes |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------ | ----- |
| Toolbar | h1 "Payments" · tabs · search · Filters · "Day close" · Payments tab: "Pay" (outline) + "Receive" (dark) · Pending tab: "Add pending" ⌄ Give · Take | one row | wraps  |       |
| Table   | ledger / credits                                                                                                                                    | full    | fold   |       |

## Data display

Table. Columns: Ref (PAY-) · What pill "Received" / "Paid" (sub "Refund to patient" / "Money back") · When · From / to (+ invoice or "Medical PO #431 · bill 1631") · Mode · ± Amount · actions. Open rows: Edit + Delete buttons; closed (after Day close): none.

## Forms

- **Receive (560, one step):** Branch (if many) · Patient (half) · Against invoice chips "#785 · ₹600" (peach when picked, prefills amount) · Mode + Amount.
- **Pay (expense):** step 1 "Supplier bill" dd (search PO #, supplier or bill no; groups Other · Clinic stock POs · Medical POs; sub "N days pending"); "Pending longest" chip row of 3 oldest (butter ≥ 14 days, blush ≥ 30); step 2 Payment: Amount (req, ₹, quick 500 · 1000 · 2000 · 5000) · to · category.
- **Pending (crNew):** Which way "Give" / "Take"; actions "Give back" · "Got it back" · "Use on next bill".
- Validation toasts: "Enter an amount", "Add who was paid and the amount".

## Popups

| Field           | Value                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shape (desktop) | side drawer (right)                                                                                                                                    |
| Shape (mobile)  | side drawer, width min(<size>, 100vw − 56px) — phone layout not designed                                                                               |
| Trigger         | "Receive" · "Pay" · "Add pending" ⌄ Give / Take · "Day close" · row Edit                                                                               |
| Size            | 560 (Receive) · 680 (Pay, pending) · 1040 (Day close)                                                                                                  |
| Dismiss         | overlay click, Esc, floating × ; Discard in footer                                                                                                     |
| Header          | "Receive payment" · "Send payment" / "Edit payment out" (sub "Clinic spend · shows in day close") · Day close; × floats outside the drawer's left edge |
| Footer          | Discard · "Add expense" / "Save changes"; Day close gate: "Accept ₹X"                                                                                  |
| Multi-step      | Receive: no (one step) · Pay: yes (Supplier bill → Payment) · Day close: 3 states                                                                      |
| Initial focus   | Patient (Receive) · Supplier bill (Pay)                                                                                                                |

## Multi-step flow

- Day close **varies by input?** yes — 3 states: (1) Gate: only Opening cash card (amount, source, Recount, "Accept ₹X"); (2) open day: bar + 4-cell strip, ledger filtered to that day; (3) closed: read-only, no edits or Undo.
- Refunds always issue a credit note CN-### ("Refund · Credit note CN-### · for Invoice #…"); invoice never edited.

## Preview / animated panels

n/a.

## Icons

| Element         | Icon name       | Size    | Semantic? |
| --------------- | --------------- | ------- | --------- |
| Section / empty | wallet          | 16 / 18 | no        |
| Received        | arrow-down-left | 14      | yes       |
| Paid            | arrow-up-right  | 14      | yes       |
| Edit            | pencil          | 16      | yes       |
| Delete          | trash           | 16      | yes       |
| Invoice         | receipt         | 14      | no        |

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

| Surface          | Loading       | Empty                                                                                                                        | Error                                                                                                                                    |
| ---------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Ledger / Pending | skeleton rows | wallet icon on butter tile · "Nothing to collect here" · "Receipts, invoices and dues show up as soon as a visit is billed." | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry"                                                   |
| Drawers          | "Saving…"     | n/a                                                                                                                          | "Enter an amount" / "Add who was paid and the amount" · footer "Not saved · your changes are kept", button "Retry save", toast + "Retry" |

## Copy

| Key     | Exact string                                                                  |
| ------- | ----------------------------------------------------------------------------- |
| tabs    | "Payments", "Pending"                                                         |
| buttons | "Pay", "Receive", "Add pending", "Day close"                                  |
| pills   | "Received", "Paid"                                                            |
| credits | "We give back", "They owe us", "Give back", "Got it back", "Use on next bill" |
| errors  | "Enter an amount", "Add who was paid and the amount"                          |
