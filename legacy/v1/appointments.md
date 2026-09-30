# Screen: Appointments

- Route: /appointments (views: day · week · list)
- Purpose: Bookings by doctor, room and machine.
- Entry points: header tab, ⌘K "New appointment", contact card "+ Appointment", patient file "Book"
- Exit points: appointment form drawer, patient file, lead drawer
- Access: Front desk, Doctor, Therapist, Counsellor, Owner
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

Section tone: sky. "Today" is the device date (time clamped to clinic hours 9–19).

## Regions (top to bottom)

| Region          | Contains                                                                                           | Desktop    | Mobile                        | Notes                    |
| --------------- | -------------------------------------------------------------------------------------------------- | ---------- | ----------------------------- | ------------------------ |
| Toolbar         | h1 "Appointments" · Today button + ‹ › date nav · view tabs · search · Filters · "New appointment" | one row    | wraps                         |                          |
| Calendar / list | day = everyone's day side by side; list = upcoming bookings to confirm                             | full width | calendar scrolls horizontally | grid lines = SVG pattern |

## Data display

Primitive: calendar columns (day/week) + table (list, see _patterns).

## Forms — Appointment form (af)

Column 560–760px (+ chat column in edit mode).

| Order | Field   | Type                                                    | Label           | Placeholder       | Help                                      | Required | Validation |
| ----- | ------- | ------------------------------------------------------- | --------------- | ----------------- | ----------------------------------------- | -------- | ---------- |
| 1     | who     | contact picker dd (half)                                | Patient or lead | "Search patients" |                                           | yes      |            |
| 2     | type    | chips (single)                                          | Type            |                   |                                           | yes      |            |
| 3     | service | dd (half)                                               | Service         |                   |                                           | yes      |            |
| 4     | doctor  | person picker (half)                                    | Doctor          |                   |                                           | yes      |            |
| 5     | length  | chips (single)                                          | Length          |                   |                                           | yes      |            |
| 6     | reason  | text                                                    | Reason          |                   |                                           | no       |            |
| 7     | notes   | textarea                                                | Notes           |                   |                                           | no       |            |
| 8     | date    | date (third) + chips "Today" · "Tomorrow" · "Next week" | Date            |                   | defaults to today                         | yes      |            |
| 9     | time    | slot grid                                               | Time            |                   | selected slot = sky ink fill + white text | yes      |            |

- Error display: below field + toast
- Submit: "Book appointment" (create) / "Save changes" (edit), disabled until dirty
- Loading: "Saving…"; Success: toast; Dirty-state guard: Discard

## Popups

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| Shape (desktop) | side drawer                                                          |
| Shape (mobile)  | side drawer, width min(760px, 100vw − 56px)                          |
| Trigger         | slot click, row click, "New appointment"                             |
| Size            | 560–760 form + chat column in edit                                   |
| Dismiss         | overlay, Esc, ×                                                      |
| Header          | title, who box (avatar + P badge, name, phone; hover = contact card) |
| Footer          | Discard · Save (right)                                               |
| Multi-step      | yes                                                                  |
| Initial focus   | who field (create)                                                   |

## Multi-step flow

- Steps (ordered): Create = who · 1 Appointment · 2 Date & time. Edit adds a Visit status strip above steps; below steps (patients only) Photos from this visit · Offering suggestions · Feedback.
- **Sequence varies by input?** yes:
  - contact is a patient → steps 1–2, then cards Photos / Offering suggestions / Feedback
  - contact is a lead or new contact → steps 1–2, then step 3 amber card "Not a patient yet · Create patient record" (Completed disabled)
  - status Checked in / Completed → Appointment step collapses to summary; Date & time locks ("Locked", "… · locked after check-in"); Photos unlock
  - status Scheduled/Confirmed and date/time changed → status resets to Scheduled + amber note "Rescheduled · was <day time> · needs confirming again · a new reminder goes out on save"; picking original slot restores status
- Progress indicator: Visit status strip — 4 tiles Scheduled → Confirmed → Checked in → Completed (done = tint + ✓, current = sky ink fill + white text, unavailable = 50% opacity + tooltip)
- Navigation: "Next: Date & time"; strip actions "Copy" and "Cancel visit" (askDel → status Cancelled, red "Cancelled · reason" banner with "Restore")
- Per-step validation: Save blocks on missing required
- Edit mode: prefilled; plan flag "✓ Plan ready · N offerings" (sage) or "Plan not prepared" (butter)

## Preview / animated panels

n/a.

## Icons

| Element      | Icon name    | Size | Semantic?                           |
| ------------ | ------------ | ---- | ----------------------------------- |
| Section      | calendar     | 16   | no                                  |
| Copy         | copy         | 14   | yes                                 |
| Cancel visit | x            | 14   | yes (red border oklch(0.53 0.2 25)) |
| Filters      | funnel       | 13   | no                                  |
| Status done  | circle-check | 14   | yes                                 |

Library: Lucide · Weight: regular

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

| Surface     | Loading         | Empty                                                            | Error         |
| ----------- | --------------- | ---------------------------------------------------------------- | ------------- |
| Calendar    | skeleton blocks | empty grid (no copy)                                             | toast + Retry |
| Photos card | n/a             | "Photos open once the patient is at the clinic" + "Check in now" | upload toast  |

## Copy

| Key           | Exact string                                                                              |
| ------------- | ----------------------------------------------------------------------------------------- |
| title         | "Appointments"                                                                            |
| quick dates   | "Today", "Tomorrow", "Next week"                                                          |
| not patient   | "Not a patient yet · Create patient record"                                               |
| rescheduled   | "Rescheduled · was <day time> · needs confirming again · a new reminder goes out on save" |
| photos locked | "Photos open once the patient is at the clinic"                                           |
| plan          | "✓ Plan ready · N offerings" / "Plan not prepared"                                        |
| lead link     | "Connected lead #id · status"                                                             |
