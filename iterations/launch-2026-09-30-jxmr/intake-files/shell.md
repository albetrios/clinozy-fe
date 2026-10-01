# Shell

## Structure

| Field             | Desktop                                                                          | Mobile                                              |
| ----------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| Shape             | top nav (single header bar), no sidebar                                          | top nav; pinned tabs collapse into "More ⌄"         |
| Sidebar width     | n/a — no sidebar; sections are reached from the header                           | n/a — no sidebar                                    |
| Collapsible?      | no; pinned tabs overflow into "More ⌄" from the right when the bar is too narrow | same                                                |
| Header height     | 56px                                                                             | 56px                                                |
| Content max-width | none — full width (layoutWidth full); page gutter 20px (12px compact)            | full width, 12px gutter                             |
| Nav position      | header, left of search                                                           | header; "All sections" compass list is the full nav |

## Header — left to right

| Slot | Contents                                                                                                                                                       | Mobile behaviour                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1    | Clinozy mark (28px rounded square #18181b, white C, green dot) + wordmark "clinozy"                                                                            | tablet: kept; phone (< 480px, proposal): mark only                                           |
| 2    | "All sections" compass button (Lucide `compass`, 36px) → 280px popover listing every section the role can view, each with a pin toggle (pinned = inverted pin) | same                                                                                         |
| 3    | Pinned section tabs (default Appointments, Leads, Patients, Payments; persisted in localStorage), tinted in the section tone when selected                     | tabs that don't fit collapse from the right into "More ⌄" dd; current section always visible |
| 4    | Search field "Search" with ⌘K kbd (min 170px before tabs collapse) → command menu                                                                              | collapses to 36px icon button                                                                |
| 5    | Utilities (notifications `bell`, tasks shortcut)                                                                                                               | kept as icon buttons                                                                         |
| 6    | Branch picker (multi-select + "All branches", branch colour chips; hidden when only one branch)                                                                | kept                                                                                         |
| 7    | User avatar (28px, tone tint) → user menu                                                                                                                      | kept                                                                                         |

## Sidebar — top to bottom

| Slot | Contents                                                        | Mobile behaviour |
| ---- | --------------------------------------------------------------- | ---------------- |
| n/a  | No sidebar — navigation is header tabs + "All sections" popover | n/a              |

## Navigation

| Field                 | Value                                                                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Items (ordered)       | Today `home` · Leads `user-plus` · Appointments `calendar` · Patients `users` · Medical `pill` · Clinic stock `package` · Payments `wallet` · Tasks `check` · Offerings `tag` · Users `shield` (Blueprint `clipboard` = internal design page, not shipped) |
| Active treatment      | full tone fill (UI.tabTint on: bg = tone bg, ink = tone ink, weight 600)                                                                                                                                                                                   |
| Hover treatment       | soft tint: tone bg 45% mixed with white + 1px ring of tone ink at 16%                                                                                                                                                                                      |
| Grouping              | "All sections" list separates groups with dividers after Today · Patients · Payments · Offerings · Users                                                                                                                                                   |
| Overflow              | "More ⌄" dd after last visible tab                                                                                                                                                                                                                         |
| Badge / count support | none — no counts on tabs (rule: no numbers as decoration)                                                                                                                                                                                                  |

## Where do these live?

| Surface                                                             | Placement in your shell                                                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Brand logo / wordmark                                               | header slot 1                                                                                                                  |
| Primary navigation items                                            | header pinned tabs + "All sections" popover                                                                                    |
| Organization / workspace switcher                                   | branch picker, header slot 6                                                                                                   |
| Global search / command palette trigger                             | header search field, ⌘K opens command menu (centred overlay — the one non-drawer overlay)                                      |
| Notifications                                                       | header utilities, `bell` icon button                                                                                           |
| Light/dark mode toggle                                              | user menu › "Appearance" radio chips "Light" (`sun`) · "Dark" (`moon`) · "System" (`monitor`); persisted localStorage cz.theme |
| User profile + sign-out                                             | user avatar menu, header slot 7                                                                                                |
| Settings entry point                                                | user avatar menu → Users section (roles, branches)                                                                             |
| Account shortcuts (profile, security, billing, appearance, devices) | user avatar menu                                                                                                               |
| System banner (e.g. "verify your email")                            | full-width 36px strip directly under the header (proposed; not in prototype)                                                   |
| Mobile navigation                                                   | "All sections" compass popover                                                                                                 |
| Mobile menu trigger                                                 | compass button, header slot 2                                                                                                  |

## Responsive

| Breakpoint                             | What changes                                                            |
| -------------------------------------- | ----------------------------------------------------------------------- |
| < 1440px wide or < 800px tall          | compact mode: paddings shrink (drawer 24→20, table 20→16, gutter 20→12) |
| bar too narrow for tabs + 170px search | pinned tabs fold into "More ⌄" from the right                           |
| any width                              | drawers are `min(<w>px, calc(100vw - 56px))`                            |
| < 600px (container)                    | Offering suggestion rows wrap to two lines, header row hides            |

Phone (< 768px) is not designed in the prototype — the app targets desktop and tablet (≥ 1024px). Proposal for implementation: header keeps logo · compass · search icon · avatar; pinned tabs hide (compass list is the nav); drawers go full-width; tables keep folding columns into the meta line.

## Global overlays (shared by every screen)

- Tooltip #cz-tip: portal, z 100000, 160ms delay, above the control, flips below near top; on touch shows 1.4s on tap.
- Toasts: bottom, with "Undo" / "Retry" actions.
- Command menu (⌘K): groups "Actions" (New lead, New appointment, New patient…) and "Go to" (screens), plus people/phone search from 2 characters.
- Drawer stack: right drawers; child drawers stack on top at z 100 (footer reads "Back").
