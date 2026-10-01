# Screen: Patient file

- Route: /patients/:id/:section
- Purpose: One patient — clinical notes, prescriptions, treatments, images, billing, team.
- Entry points: Patients row, openPatientByName from any contact, contact card name link
- Exit points: Rx / treatment / invoice / payment / appointment drawers
- Access: clinical roles; Billing tiles for desk/accountant
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

## Regions (top to bottom)

| Region      | Contains                                                                                                                | Desktop            | Mobile        | Notes              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------- | ------------------ |
| File bar    | back · folder button (Patient file popover) · pinned tabs + temporary tab                                               | one row, tabs left | tabs scroll   | Billing tabs peach |
| Rail (left) | identity header (fixed) · Contact + Details (scroll, [data-rail-scroll]) · Up next (fixed: Book, Collect, Feedback row) | fixed column       | above content |                    |
| Content     | active section                                                                                                          | right of rail      | full width    |                    |

Patient file popover: tiles grouped Clinical / Care / Billing / Team; dashed tile = empty; pin per tile.

## Data display

Clinical notes = 12-col bento: Complaints · Diagnosis · Treatment suggestions · Future suggestions (≥980px 3 cols each; 620–980 6+6; narrow 1 col). Below: Offering suggestions + Feedback (full width, collapsed by default). Rx / Treatments / Invoices / Images = tables or grids (_patterns); every Rx and invoice row has Print (`printer`) + Preview (`eye`).

Images: Visit dd (All photos · Not attached · per visit); date groups "· 24 Sep · Hydrafacial".

## Forms — Prescription drawer (1040)

Rx items table columns: Medicine minmax(160,1.6fr) · Dose 150 · Meal minmax(150,1fr) · Where minmax(110,.8fr) · Qty 96 · ×.

- Dose: three 24px taps Morning · Afternoon · Night (0→1→2→0, lit = sage) + SOS
- Meal: Before / After + "⌄" more (Empty stomach, With meal, Morning, Night, Morning & night, Thrice a week, Once a week, Alternate days)
- Remarks line: "Remarks · e.g. 10 days, apply thin layer, avoid sun" — "N days" recomputes Qty
- Quick line (44px): shorthand qty `2`/`x2`, `0-0-1`, od·bd·tds·hs·sos, af/bf, `5d`/`2w`; Browse popover (180px tiles)
- Footer: "Save & sell" + "Print …" preset

Offering suggestions card: tables (1) Suggested (status dd Planned · Accepted · Next time · Declined; "✓ Invoiced"), Ideas from history ("+ Add"), "Add offering"; (2) "<First>'s last purchases"; (3) Contact activity ("Open chat"). Prices masked "₹ ••••" with eye.

Feedback card: "Log feedback ⌄" dd (Visit check-in · After <treatment> check-ins · Google review · Video testimonial · Instagram · Feedback form · WhatsApp); cards 236px high, 3 in view (2 < 760px), ‹ › arrows, "Load more". Negative → "Action needed" + "Log action ⌄".

## Popups

| Field           | Value                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Shape (desktop) | side drawer (right) · Patient file popover = popover (czddin) · photos = full-screen viewer                                          |
| Shape (mobile)  | side drawer, width min(<size>, 100vw − 56px) — phone layout not designed                                                             |
| Trigger         | toolbar "New …" + ⌄, quick tiles, rail Book / Collect, row actions; folder button opens the Patient file popover                     |
| Size            | 680 · 840 (items) · 1040 (Prescription)                                                                                              |
| Dismiss         | overlay click, Esc, floating × ; Discard in footer                                                                                   |
| Header          | record type title + patient name; patient prefilled ("For <first name> · already selected"); × floats outside the drawer's left edge |
| Footer          | Discard · "Save prescription" / "Save treatment" / "Create clinic invoice" / "Save changes"; Rx also "Save & sell" + "Print …"       |
| Multi-step      | yes — step cards                                                                                                                     |
| Initial focus   | first empty field of step 1                                                                                                          |

## Multi-step flow

- Rx steps: Prescription → Medicines → Notes (Notes · Lab report · Today's procedure side by side)
- Check-in (ckNew): 3 steps; **varies by input?** yes — Worse or ≤ 4/10 creates a doctor call-back task
- Actions keep the patient prefilled ("For <first name> · already selected")

## Preview / animated panels

n/a.

## Icons

| Element              | Icon name                   | Size | Semantic? |
| -------------------- | --------------------------- | ---- | --------- |
| Patient file popover | folder                      | 16   | yes       |
| Print                | printer                     | 16   | yes       |
| Preview              | eye                         | 16   | yes       |
| Edit                 | pencil                      | 14   | yes       |
| Remove               | trash                       | 14   | yes       |
| Filled step / done   | circle-check                | 14   | yes       |
| Open / close         | chevron-down (rotates 180°) | 14   | yes       |

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

| Surface      | Loading        | Empty                                                                                                                                                                                             | Error |
| ------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Section tile | skeleton       | dashed tile                                                                                                                                                                                       | toast |
| Feedback     | skeleton       | dashed full-row tile (min-height 120px, radius 12): "No feedback yet" (13px/600) + "Log a check-in or a review after the next visit · Log feedback" (12px muted); click opens Log feedback picker | toast |
| Photos       | skeleton tiles | drop zone "Upload photos"                                                                                                                                                                         | toast |

## Copy

| Key          | Exact string                                               |
| ------------ | ---------------------------------------------------------- |
| new menu     | "For <first name> · already selected"                      |
| Rx remark ph | "Remarks · e.g. 10 days, apply thin layer, avoid sun"      |
| feedback     | "Log feedback", "Action needed", "Log action", "Load more" |
