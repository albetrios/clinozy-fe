# Screen: Leads

- Route: /leads
- Purpose: Enquiries and their conversations, until they become patients.
- Entry points: header tab, ⌘K "New lead", contact card "+ Lead"
- Exit points: lead drawer, appointment form, patient creation
- Access: Front desk, Counsellor, Marketing, Owner
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

Section tone: lav.

## Regions (top to bottom)

| Region   | Contains                                                          | Desktop       | Mobile                    | Notes                 |
| -------- | ----------------------------------------------------------------- | ------------- | ------------------------- | --------------------- |
| Toolbar  | h1 "Leads" · tabs · search · Filters · columns (eye) · "New lead" | one row       | wraps; tabs → More ⌄      |                       |
| Table    | leads                                                             | full width    | columns fold to meta line | virtualised > 40 rows |
| Bulk bar | when rows selected                                                | docked footer | same                      |                       |

## Data display

Primitive: table (see _patterns). Columns: person (lead avatar lavender) · status · source · interested in · assigned & involved (person chips) · follow-up · created. Row click → lead drawer. Contact threads (`lead.ct = true`, from appointments) never appear.

## Forms — Lead drawer (680, + chat column)

| Order | Field    | Type                      | Label               | Placeholder       | Help       | Required | Validation                 |
| ----- | -------- | ------------------------- | ------------------- | ----------------- | ---------- | -------- | -------------------------- |
| 1     | name     | text (half)               | Name                | "e.g. Priya Shah" |            | yes      | maxLength                  |
| 2     | phone    | tel (third)               | Mobile              | "98765 43210"     | +91 prefix | yes      | 10 digits, stored "+91…"   |
| 3     | source   | chips (single)            | Source              |                   |            | no       |                            |
| 4     | interest | chips (multi, check icon) | Interested in       |                   |            | no       |                            |
| 5     | assigned | person picker dd          | Assigned & involved |                   |            | no       | popover 320–440px, max 460 |
| 6     | notes    | textarea (full)           | Notes               |                   |            | no       |                            |

- Error display: below field + Save toast naming first missing field
- Submit: "Save" / "Create lead", footer right, disabled until dirty
- Loading: button "Saving…"
- Success: toast, drawer closes
- Dirty-state guard: Discard button; nothing saves until Save

## Popups

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Shape (desktop) | side drawer (right)                                                                                  |
| Shape (mobile)  | side drawer, width min(<size>, 100vw − 56px) — phone layout not designed                             |
| Trigger         | "New lead", row click, contact card "+ Lead"                                                         |
| Size            | 680 + chat column (~360px)                                                                           |
| Dismiss         | overlay click, Esc, floating × ; Discard in footer                                                   |
| Header          | lead name + status pill; chat header shares the 76px height; × floats outside the drawer's left edge |
| Footer          | "Not saved · your changes are kept" (after failure) · Discard · "Save" / "Create lead"               |
| Multi-step      | yes — who → details → notes                                                                          |
| Initial focus   | Name                                                                                                 |

## Multi-step flow

- Steps (ordered): who → details → notes (step cards)
- **Sequence varies by input?** no
- Progress indicator: numbered step circles (lead progress: completed steps inverted — tone ink fill, white text, white disc with ink check; current step light tint)
- Navigation: "Next: <step>"; any step openable by click
- Per-step validation: no; Save validates required
- Edit mode: prefilled, same steps

## Preview / animated panels

n/a.

## Icons

| Element        | Icon name                 | Size | Semantic?        |
| -------------- | ------------------------- | ---- | ---------------- |
| Section        | user-plus                 | 16   | no               |
| New            | plus                      | 16   | no               |
| Filters        | list-filter               | 15   | no               |
| Columns        | eye                       | 16   | yes (aria-label) |
| Message (bulk) | message-circle (WhatsApp) | 14   | yes              |

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

| Surface     | Loading                          | Empty                                            | Error                                                                                  |
| ----------- | -------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Table       | skeleton rows (virtualised > 40) | "No leads match"                                 | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry" |
| Chat column | skeleton bubbles                 | "No messages yet · start the conversation below" | toast + Retry                                                                          |
| Drawer      | "Saving…"                        | n/a                                              | footer "Not saved · your changes are kept", button "Retry save", toast + "Retry"       |

## Copy

| Key               | Exact string                            |
| ----------------- | --------------------------------------- |
| title             | "Leads"                                 |
| primary           | "New lead"                              |
| bulk              | "Message", "Export"                     |
| moved at check-in | "· moves to Clinic visited at check-in" |
