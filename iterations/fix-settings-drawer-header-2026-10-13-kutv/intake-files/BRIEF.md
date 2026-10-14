# Brief — the settings drawer's section header arrives whole

## What changes

1. **One header from the first frame (`shell`, the Settings drawer — Account menu › Settings, every
   section).** Opening the drawer, or moving to a section whose code has not loaded yet, shows a
   stand-in while the section loads. Today that stand-in's head row carries only the section's
   name; a beat later the section itself replaces it with its title **and** its sub line, so the
   header grows by a line and pushes everything under it down. From now on the stand-in draws the
   section's own head row: the same tile, the same title, the same sub line and, where the section
   has one, the same meta pill. When the section arrives, the header does not move or change.
2. **The same title in both.** Today the stand-in names a section by its nav label and the section
   by its own heading — Organization › General reads "General" and then "Organization · General".
   The stand-in uses the section's heading.

## Why

- The header is the first thing read in the drawer, and today it is the one part that visibly
  rebuilds itself: a sub line appears a moment after the title and the content below jumps. It makes
  every open of Settings feel unfinished, on every section, worst on a slow connection.

## Affected screens, entities and routes

- Screens: shell (the Settings drawer opened from the Account menu)
- Entities: none
- Routes: none — no API route is added, changed or removed; the `#settings/<scope>/<section>` hash
  is unchanged

## Rules

- No API, data or background change; every section's behaviour, test ids, copy and permissions stay
  as they are — only where the head row's copy comes from changes.
- One source for each section's head row (title, sub line, meta), read by the stand-in and by the
  section, so the two cannot drift again.
- The sub line that depends on access (Integrations: "API keys and webhooks." vs "API keys.") is
  chosen by the same permission check the section uses.
- The Profile completeness pill shows the value the section opens with (the signed-in profile); once
  the section is open it still follows what is typed.
- No new strings; every key already exists in all shipped locales.

## Acceptance criteria

- [ ] For every section (Profile, Account, Security, Notifications, Sessions, Billing, Integrations,
      General, Members, Roles) the stand-in's head row shows the same title, sub line and meta as the
      section shows once loaded.
- [ ] The head row's height does not change when a section's code arrives, at 1440 × 900 and
      375 × 667.
- [ ] Organization › General's stand-in reads "Organization · General", as the section does.
- [ ] Integrations' stand-in shows the sub line the section will show for the same access.
- [ ] Profile's stand-in shows the completeness pill the section opens with.
- [ ] The frontend's static gates, unit tests and bundle budgets pass.

## Out of scope

- Any backend route, table, job, seed or permission change.
- The section bodies (cards, lists, forms) and their own loading skeletons.
- The drawer frame, the section rail and the phone section switch.
- The error state a section shows when its code fails to load.
