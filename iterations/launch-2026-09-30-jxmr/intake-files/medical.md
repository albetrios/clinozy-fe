# Screen: Medical

- Route: /medical/:tab — tabs Sales · Medicines · Purchases · Suppliers · Manufacturers · MRs · Payments (overflow → More ⌄ grouped Stock · Buying · Selling · Money)
- Purpose: The medicine store: medicines for sale, suppliers, MRs, purchases, sales.
- Entry points: header tab, Rx "Sell medicines"
- Exit points: sale / medicine / PO / supplier / MR drawers, invoice print
- Access: Pharmacist, Accountant, Owner
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

Section tone: blush. Never shares records with Clinic stock.

## Regions

| Region   | Contains                                                     | Desktop       | Mobile        | Notes |
| -------- | ------------------------------------------------------------ | ------------- | ------------- | ----- |
| Toolbar  | h1 "Medical" · tabs · search · Filters · eye · split "New …" | one row       | wraps, More ⌄ |       |
| View bar | Ledger: All · Money in · Money out                           | under toolbar | same          |       |
| Table    | per tab                                                      | full          | fold          |       |

## Data display

Tables (_patterns). Filters: Medicines › Stock (All · Low stock) + Nearest expiry (Any · 30 · 60 · 90 days); Sales › Status (All · Unpaid · Returned); Purchases › Stage. Supplier → Manufacturers; Manufacturer → Suppliers + MRs; MR → Represents. Payments = global ledger filtered to Medical.

## Forms

- Sale = the shared invoice drawer (type Medical locked, title "New sale"): Customer ("patient or walk-in", "Search patients or type a walk-in name") · Medicines items (quick line, Browse, qty steppers) · Payment Mode chips + Paid now. Save checks stock, deducts earliest expiry.
- Medicine drawer: Name (req) · Manufacturer dd (req) · MRP · GST · composition · batches · rates · min/max stock.
- PO drawer (840): Supplier dd (req, "Search supplier", "Add supplier") · Items (rate `req`). Receive = "Tick what arrived".
- Supplier: Agency name (req) · Phone · GST no · Account (Payable / Orders info).
- MR visit: 560 "Log MR visit".

## Popups

| Field           | Value                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape (desktop) | side drawer (right)                                                                                                                                                                                 |
| Shape (mobile)  | side drawer, width min(<size>, 100vw − 56px) — phone layout not designed                                                                                                                            |
| Trigger         | split "New …" (sale / medicine / PO / supplier / manufacturer / MR), row click, Rx "Sell medicines"                                                                                                 |
| Size            | 560 (MR visit) · 680 (medicine, supplier, manufacturer, MR) · 840 (sale, PO, receive)                                                                                                               |
| Dismiss         | overlay click, Esc, floating × ; Discard in footer                                                                                                                                                  |
| Header          | "New sale" / "New medicine" / "New supplier" / "New MR" / "New manufacturer" / "New purchase order" · "Log MR visit"; × floats outside the drawer's left edge                                       |
| Footer          | Discard · primary "Add medicine" / "Add supplier" / "Add MR" / "Add manufacturer" / "Create purchase" / "Save changes"; read-only PO / sale views: "Pay" / "Print" / "Collect" / "Return medicines" |
| Multi-step      | yes — auto-split steps; PO/Sale views stepMode off                                                                                                                                                  |
| Initial focus   | first required field (Customer / Name / Supplier)                                                                                                                                                   |

## Multi-step flow

- **Sequence varies by input?** yes — PO stage: Ordered = editable + "Cancel order"; Received/Paid = read-only (Pay / Print). Sales never edited: view drawer (Collect / Return medicines); only unpaid, no-return sales can be voided.

## Preview / animated panels

n/a.

## Icons

| Element         | Icon name   | Size    | Semantic? |
| --------------- | ----------- | ------- | --------- |
| Section / empty | pill        | 16 / 18 | no        |
| New             | plus        | 16      | no        |
| Print           | printer     | 16      | yes       |
| Preview         | eye         | 16      | yes       |
| Delete / void   | trash       | 16      | yes       |
| Filters         | list-filter | 15      | no        |

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

| Surface       | Loading       | Empty                                                                                                                                   | Error                                                                                                                                        |
| ------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Any tab table | skeleton rows | pill icon on blush tile · "Nothing in the medicine store" · "Add medicines, suppliers and purchases to start selling from the counter." | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry"                                                       |
| Drawers       | "Saving…"     | n/a                                                                                                                                     | "Add a name" / "Enter the MRP" / "Pick a supplier" toasts · footer "Not saved · your changes are kept", button "Retry save", toast + "Retry" |

## Copy

| Key     | Exact string                |
| ------- | --------------------------- |
| title   | "Medical"                   |
| sale    | "New sale"                  |
| Rx fill | "Prescriptions to fill"     |
| receive | "Tick what arrived"         |
| quick   | "Needs MRP and composition" |
