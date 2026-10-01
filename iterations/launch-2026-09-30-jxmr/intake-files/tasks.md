# Screen: Tasks

- Route: /tasks
- Purpose: Follow-ups, feedback calls, reminders, with an owner and due time.
- Entry points: header tab, auto-created tasks (autoTask), header utilities
- Exit points: task drawer, source record (lead, appointment, check-in)
- Access: all roles (own tasks); Owner sees all
- Layout shell: app shell
- Breakpoints: desktop 1440 · tablet 1024 · mobile n/a — phone layout not designed (desktop / tablet app)

Section tone: plum.

## Regions

| Region  | Contains                                            | Desktop | Mobile | Notes                    |
| ------- | --------------------------------------------------- | ------- | ------ | ------------------------ |
| Toolbar | h1 "Tasks" · "Task view" tabs · spacer · "New task" | one row | wraps  | Filters not yet on Tasks |
| List    | tasks by due                                        | full    | fold   |                          |

## Data display

Table/list. Each task: kind · tone · who (person chip) · why · due · outcome buttons. Rule examples: Aftercare calls (source Treatments) — outcomes "Log check-in" · "Doing well" · "No answer" (snooze 3 h); feedback — "Happy" → review log.

## Forms

Task drawer: who · why · due · owner (person picker) · outcomes. Save via apiSave (failed-save line as _patterns).

## Popups

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| Shape (desktop) | side drawer (right)                                                                 |
| Shape (mobile)  | side drawer, width min(<size>, 100vw − 56px) — phone layout not designed            |
| Trigger         | "New task", row click, outcome buttons                                              |
| Size            | 560 + activity column                                                               |
| Dismiss         | overlay click, Esc, floating × ; Discard in footer                                  |
| Header          | task kind + who, due line; × floats outside the drawer's left edge                  |
| Footer          | Discard · "Save" (dark); outcomes open ckNew / rvNew stacked on top (footer "Back") |
| Multi-step      | no — single form                                                                    |
| Initial focus   | Who                                                                                 |

## Multi-step flow

- **Sequence varies by input?** yes — outcome picked decides next drawer (Log check-in → ckNew; Happy → review log; No answer → snooze, no drawer).

## Preview / animated panels

n/a.

## Icons

| Element  | Icon name | Size | Semantic? |
| -------- | --------- | ---- | --------- |
| Section  | check     | 16   | no        |
| New task | plus      | 16   | no        |
| Due      | clock     | 13   | no        |
| Reminder | bell      | 14   | no        |

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

| Surface         | Loading       | Empty                                                                                                     | Error                                                                                  |
| --------------- | ------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Queue           | skeleton rows | "Nothing needs you right now. New tasks appear here as leads write, visits come up and feedback arrives." | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry" |
| Snoozed         | skeleton rows | "No snoozed tasks"                                                                                        | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry" |
| Done            | skeleton rows | "Nothing resolved yet today"                                                                              | toast "Couldn’t load this list · connection dropped. Showing the last copy." + "Retry" |
| Activity column | n/a           | "No messages yet"                                                                                         | n/a — local                                                                            |

## Copy

| Key      | Exact string                              |
| -------- | ----------------------------------------- |
| title    | "Tasks"                                   |
| outcomes | "Log check-in", "Doing well", "No answer" |
