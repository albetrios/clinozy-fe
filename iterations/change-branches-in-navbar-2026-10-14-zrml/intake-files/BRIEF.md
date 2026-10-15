# Brief — Branches in the main navbar, as a room of its own

## What changes

1. **Branches becomes a clinic room.** The list of branches and the branch drawer leave the Users
   room, where they were its third tab (`/users/branches`), and become the Branches room at
   `/organization/<slug>/branches` — the eleventh clinic section, after Users, with its own icon
   (Building), its own tone (stone) and its own one-line description ("Every branch: address,
   opening hours, team, rooms and machines").
2. **In the main navbar.** Branches is a header tab like Appointments or Payments, and it is
   **pinned by default**: a member who never changed their pins sees Appointments · Leads ·
   Patients · Payments · Branches. It is listed in All sections (desktop popover and phone sheet)
   and in ⌘K "Go to", and can be pinned and unpinned like any room. On a phone the tab bar keeps
   its four slots; Branches opens from "More".
3. **Users loses its Branches tab.** Users keeps Team and Roles & access; its description reads
   "Team, roles & access".
4. **Roles & access.** Branches is a section row of its own in the matrix ("What it can see and
   do"), after Users, instead of a sub-row under Users.
5. **Old links keep working.** `/users/branches`, `/users/branches/create` and
   `/users/branches/<id>/edit` redirect to the same place in the Branches room, with the search
   and the hash kept.
6. **Settings › Clinic** links to the Branches room ("… are set per branch in Branches").

## Why

Branches are where a clinic owner sets opening hours, holidays, rooms, machines and the default
people per location — things they come back to often. Hidden as the third tab of Users, they were
hard to find. One click from the navbar makes them easy to reach.

## Affected screens, entities and routes

- Screens: the app shell (header tabs, All sections, phone sheet, ⌘K), Users (Team, Roles & access
  and its matrix), Branches (list and the branch drawer), Settings › Clinic
- Entities: `Section` gains `branches`; `UserPreference.pinnedSections` may hold it and starts with
  it; the permission catalog files the four `branch:*` codes under `branches`
- Routes: no API route is added, changed or removed. App URLs: `/branches`, `/branches/create`,
  `/branches/<id>/edit` (new); `/users/branches…` (redirect)

## Rules

- Access does not change: the room opens with `branch:read`; New branch needs `branch:create`,
  editing `branch:update`, removing a room, machine or holiday `branch:delete` — exactly the codes
  that gated the tab. No role gains or loses a code.
- The room shows in the navbar only where the member may view it (`branch:read`) and the module is
  on (`app-branches`).
- Members who already saved their own pins keep them; only the starting pins change.
- Every existing shortcut stays: 1–9 then 0 still open Today … Users; Branches, the eleventh room,
  opens from All sections, ⌘K or its tab.
- All copy in all 11 locales; semantic tokens only; dark mode follows.

## Acceptance criteria

- [ ] A new member sees a Branches tab in the header, after Payments, and it opens the list of
      branches.
- [ ] All sections (desktop and phone) and ⌘K list Branches after Users with its icon, tone and
      description; it can be pinned and unpinned.
- [ ] Users shows Team and Roles & access only.
- [ ] Roles & access shows Branches as its own row with the `branch:*` boxes.
- [ ] `/users/branches`, `/users/branches/create` and `/users/branches/<id>/edit` land in the
      Branches room (the drawer open where the URL names one), search and hash kept.
- [ ] Settings › Clinic links to the Branches room.
- [ ] clinozy-be accepts `branches` as a pinned section and starts new members with it pinned.
- [ ] Light and dark, desktop and phone read correctly.

## Out of scope

- The branch drawer, its steps and its writes; the header's branch filter (the "All branches"
  picker).
- New permission codes or role presets.
- Phone tab bar slots (still four).
- The Playwright visual baselines (recorded separately with clinozy-be running).
