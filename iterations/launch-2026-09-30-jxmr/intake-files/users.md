# Screen: Users

- Route: /users/:tab — Team · Roles & access · Branches
- Purpose: Team, roles & access, branches.
- Entry points: header tab, user menu → Settings
- Exit points: user drawer, role drawer, branch drawer
- Access: Owner, Admin
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

Section tone: slate. Roles: Front desk · Doctor · Therapist · Counsellor · Pharmacist · Accountant · Marketing · Owner.

## Regions

| Region  | Contains                                                         | Desktop | Mobile | Notes |
| ------- | ---------------------------------------------------------------- | ------- | ------ | ----- |
| Toolbar | h1 "Users" · tabs · search (Team) · Filters (Roles) · "New user" | one row | wraps  |       |
| Table   | users / roles / branches                                         | full    | fold   |       |

## Data display

Table: person chip (PEOPLE tone avatar) · roles pills · branches chips (brTone) · hours · active. Permission rows show each section in its SEC_TONE.

## Forms — User drawer

| Order | Field          | Type          | Label         | Placeholder                        | Help              | Required | Validation |
| ----- | -------------- | ------------- | ------------- | ---------------------------------- | ----------------- | -------- | ---------- |
| 1     | name           | text (half)   | Name          | "Full name, e.g. Dr. Nisha Mavani" |                   | yes      |            |
| 2     | ph             | tel (third)   | Mobile        | "98765 43210"                      | +91               | no       | 10 digits  |
| 3     | email          | email (half)  | Email         | "name@example.com"                 |                   | yes      | email      |
| 4     | pw             | password      | Password      |                                    | masked in peek    | new only |            |
| 5     | roles          | chips (multi) | Roles         |                                    |                   | yes      |            |
| 6     | br             | chips (multi) | Branches      |                                    |                   | yes      |            |
| 7     | days, from, to | chips / time  | Working hours | "10:00" · "19:00"                  |                   | no       |            |
| 8     | tone           | swatch        | Colour        |                                    | peek shows swatch | no       |            |
| 9     | active         | toggle        | Active        |                                    |                   | no       |            |

## Popups

| Field           | Value                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape (desktop) | side drawer (right)                                                                                                                           |
| Shape (mobile)  | side drawer, width min(<size>, 100vw − 56px) — phone layout not designed                                                                      |
| Trigger         | "New user" / "New branch", row click                                                                                                          |
| Size            | 680                                                                                                                                           |
| Dismiss         | overlay click, Esc, floating × ; Discard in footer                                                                                            |
| Header          | "New user" / name · "New branch" / "Edit branch" (sub "Address, hours and the people who work here"); × floats outside the drawer's left edge |
| Footer          | Discard · "Create user" / "Save changes"; presets Doctor · Therapist · Front desk · Pharmacist                                                |
| Multi-step      | yes — Profile → Access → Hours                                                                                                                |
| Initial focus   | Name                                                                                                                                          |

## Multi-step flow

- Steps: Profile → Access → Hours
- **Sequence varies by input?** no.

## Preview / animated panels

n/a.

## Icons

| Element         | Icon name | Size    | Semantic? |
| --------------- | --------- | ------- | --------- |
| Section / empty | shield    | 16 / 18 | no        |
| New             | plus      | 16      | no        |
| Team            | users     | 14      | no        |
| Password lock   | lock      | 14      | no        |

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

| Surface                 | Loading       | Empty                                                                                                                  | Error                                                                                  |
| ----------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Team / Roles / Branches | skeleton rows | shield icon on lav tile · "No team members yet" · "Invite doctors, therapists and front desk so work can be assigned." | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry" |
| Drawer                  | "Saving…"     | n/a                                                                                                                    | footer "Not saved · your changes are kept", button "Retry save", toast + "Retry"       |

## Copy

| Key     | Exact string                       |
| ------- | ---------------------------------- |
| title   | "Users"                            |
| desc    | "Team, roles & access, branches"   |
| name ph | "Full name, e.g. Dr. Nisha Mavani" |
