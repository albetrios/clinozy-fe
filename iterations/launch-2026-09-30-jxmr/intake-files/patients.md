# Screen: Patients

- Route: /patients
- Purpose: Registered patients list.
- Entry points: header tab, ⌘K "New patient", contact card "+ Patient"
- Exit points: patient file (row click), New patient drawer
- Access: all clinical and desk roles
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

Section tone: sage.

## Regions (top to bottom)

| Region  | Contains                                               | Desktop    | Mobile            | Notes |
| ------- | ------------------------------------------------------ | ---------- | ----------------- | ----- |
| Toolbar | h1 "Patients" · search · Filters · eye · "New patient" | one row    | wraps             |       |
| Table   | patients                                               | full width | fold to meta line |       |

## Data display

Primitive: table (_patterns). Person cell = sage avatar + P badge. Row click → patient-file.md (not a drawer — the one exception, opens the file view).

## Forms — New patient drawer

| Order | Field                              | Type                               | Label            | Placeholder   | Help                 | Required      | Validation |
| ----- | ---------------------------------- | ---------------------------------- | ---------------- | ------------- | -------------------- | ------------- | ---------- |
| 1     | fn                                 | text (half)                        | First name       | "e.g. Priya"  |                      | yes           | maxLength  |
| 2     | ln                                 | text (half)                        | Last name        | "e.g. Shah"   |                      | no            |            |
| 3     | ph                                 | tel (third)                        | Mobile           | "98765 43210" | "primary · WhatsApp" | yes           | 10 digits  |
| 4     | ph2                                | tel (third)                        | Secondary mobile | "98765 43210" |                      | no            |            |
| 5     | gender                             | chips                              | Gender           |               |                      | no            |            |
| 6     | dob                                | date (third)                       | Date of birth    |               |                      | no            |            |
| 7     | addr                               | textarea (full)                    | Address          | "Area, city"  |                      | no            |            |
| 8     | br                                 | dd                                 | Home branch      |               |                      | if > 1 branch |            |
| 9     | type, consent, first photos, notes | chips / toggle / upload / textarea |                  |               |                      | no            |            |

- Error display: below field + toast; Submit "Create patient" / "Save changes"; validation toast "Add name and mobile"; presets "Walk-in today" (butter) · "Referred by patient" (lav); Loading "Saving…"; Success toast + opens file; Dirty guard Discard.

## Popups

| Field           | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| Shape (desktop) | side drawer (right)                                                                        |
| Shape (mobile)  | side drawer, width min(<size>, 100vw − 56px) — phone layout not designed                   |
| Trigger         | "New patient", row "Edit" action, contact card "+ Patient"                                 |
| Size            | 680px                                                                                      |
| Dismiss         | overlay click, Esc, floating × ; Discard in footer                                         |
| Header          | "New patient" / patient name, sub = type · mobile; × floats outside the drawer's left edge |
| Footer          | Discard (outline) · "Create patient" / "Save changes" (dark), right-aligned                |
| Multi-step      | yes — Contact → Details → Notes                                                            |
| Initial focus   | First name                                                                                 |

## Multi-step flow

- Steps: Contact → Details → Notes (auto-split)
- **Sequence varies by input?** no
- Progress: step circles · Navigation "Next: …" · Validation on Save · Edit prefilled

## Preview / animated panels

n/a.

## Icons

| Element         | Icon name   | Size    | Semantic?                  |
| --------------- | ----------- | ------- | -------------------------- |
| Section / empty | users       | 16 / 18 | no                         |
| New patient     | plus        | 16      | no                         |
| Filters         | list-filter | 15      | no                         |
| Columns         | eye         | 16      | yes — aria-label "Columns" |
| Delete row      | trash       | 16      | yes                        |

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

| Surface        | Loading          | Empty                                                                                                                                         | Error                                                                                  |
| -------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Table          | skeleton rows    | users icon on sage tile · "No patients match" · "Patients appear here after their first check-in. Try a different view or clear the filters." | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry" |
| Patient drawer | button "Saving…" | n/a — form                                                                                                                                    | footer "Not saved · your changes are kept", button "Retry save", toast + "Retry"       |

## Copy

| Key         | Exact string         |
| ----------- | -------------------- |
| title       | "Patients"           |
| primary     | "New patient"        |
| mobile hint | "primary · WhatsApp" |
