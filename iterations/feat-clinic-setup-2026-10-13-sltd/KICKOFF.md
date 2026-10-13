# Clinic setup — kickoff plan

> **Status: ready for review, 2026-10-13.** Planned with `fe-iteration-planning` against Baseline
> `launch-2026-09-30-jxmr`, from `BRIEF.md` (Intake mode `brief`). Every RED question is answered (D1–D30 in
> `plans/decisions.md`). The backend half is in clinozy-be's same-named iteration: its route review
> (`plans/routes-final.md` there, final) is the contract this plan builds against. `fe-kickoff-iteration` builds §3–§6
> in ledger order (§9) and records what was built in `AS-BUILT.md`. Kickoff waits until the launch is `done` (D8) and
> until clinozy-be's ROUTE #4 (the `onboarding-setup` routes) is built.

## 1. Header

| Field            | Value                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/feat-clinic-setup-2026-10-13-sltd/` · **incremental** (type feat, Baseline `launch-2026-09-30-jxmr`)                                                                                                             |
| Intake           | `brief` — `BRIEF.md` received, 22 files carried forward from the Baseline · Intake hash `790d068ffc3b` · Schema-routes `5f90325208e1` (unchanged)                                                                            |
| Date             | 2026-10-13 (brief re-placed twice the same day: setup in the shell, D11; the quick setup, D26–D28)                                                                                                                           |
| Sources          | `intake-files/BRIEF.md` (296 lines); the Baseline's `_patterns.md` (Right drawer, Step cards), `shell.md` (account menu, System banner), `users.md` (Branches) — read for the patterns the brief names; nothing else changed |
| API contract     | clinozy-be `iterations/feat-clinic-setup-2026-10-13-sltd/plans/routes-final.md` §1 (first branch → main) and §2 (onboarding setup), and the launch's route review for every reused route (D9)                                |
| Evidence         | `BRIEF.md:n` = brief line n · `RF§n` = clinozy-be route review section n · `RC-n` = clinozy-be `plans/route-changes.md` row · `file:line` = this repository                                                                  |
| Planned by       | `fe-iteration-planning` (this file)                                                                                                                                                                                          |
| Built by         | `fe-kickoff-iteration`, driving the skills named per ledger row (§9); there is no design for the new surfaces, so `fe-design-ditto` builds them to the house patterns the brief names                                        |

## 2. Locked decisions

All in [plans/decisions.md](plans/decisions.md), dated 2026-10-13, answered by the user. The ones that shape the build:

| #                  | Decision                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 → D11           | Setup is a **drawer in the app shell**, opening over whichever room the clinic lands on; it has a hash address that rides on any room, like `#settings/…`.    |
| D2                 | "Explore first" is always allowed; closing the drawer is "Explore first".                                                                                     |
| D3                 | Complete scope: Places & days in the branch drawer and Settings › Clinic.                                                                                     |
| D4                 | /onboarding is shortened to Welcome → Your name → Clinic name → Done.                                                                                         |
| D5                 | Setup progress is read from the server, never from `localStorage`.                                                                                            |
| D7                 | Clinics already live when this ships never see the drawer or the ring.                                                                                        |
| D8                 | A brief on the launch; kickoff waits for the launch to be `done`.                                                                                             |
| D9                 | The route reviews are the API truth.                                                                                                                          |
| D10, D14           | The design's step cards (`DrawerSteps`); a later step unlocks after the one before is saved.                                                                  |
| D12 → D28          | No header launcher: a **progress ring on the avatar**, "Finish setup · n of 3" and "Clinic settings" in the account menu, "Finish setup" in the command menu. |
| D13 → D26          | **3 taps, 560px**: What kind of clinic → Where is it → Do you see patients → "Go live".                                                                       |
| D15                | Someone to book = Doctor or Therapist (main or extra role).                                                                                                   |
| D16                | Invitations carry the main branch's days and hours.                                                                                                           |
| D17                | No cash-drawer float anywhere.                                                                                                                                |
| D18 (in the guide) | The starter services list, in `plans/decisions.md` › Starter services.                                                                                        |
| D19                | Managers only (`organization:update`); members see one notice.                                                                                                |
| D20                | "All done" is stored once by the server.                                                                                                                      |
| D21                | No reminder email.                                                                                                                                            |
| D23                | Progress ring and bar in the theme's progress green; starter rows take the New-offering defaults; Places & days is a fourth branch-drawer step on edit.       |
| D24, D25 → D30     | The backend route review: sub-domain 1 final (rev 1), sub-domain 2 final (rev 2).                                                                             |
| D27                | PIN autofill from a list bundled with the app.                                                                                                                |
| D29                | The ideas for later are not planned.                                                                                                                          |

## 3. Foundation (before any screen)

**Theme preset** — n/a: no token, preset or font change. The ring and bar use the existing progress-green token (D23).

**Shell** — no new variant: the launch's section-bar shell stays. This change **adds** four surfaces to it and moves
none; every platform surface (org switcher, branch picker, ⌘K, notifications, profile and sign-out, the settings
hash-modal entry, shortcuts, the verification notice, the phone tab bar) stays where it is.

```text
 the section bar (every room)                                            AccountMenu (avatar)
 ┌──────────────────────────────────────────────────────────────┐      ┌───────────────────────────────┐
 │ ▣ Clinozy  Today Leads Appointments …   ⌕ ⌘K   Branch ▾  (◔A) │──────│ ◔ Finish setup · 1 of 3     → │  NEW (managers, until
 └──────────────────────────────────────────────────────────────┘      │ ⚙ Clinic settings           → │  done / hidden)
   NoticeStack (members, no open branch):                               │ ───────────────────────────── │  NEW (managers, always)
 ┌──────────────────────────────────────────────────────────────┐      │ Nikunj · Owner     (as built)  │
 │ ⓘ Your clinic is still being set up — bookings open once …    │      │ Settings · Appearance · …      │
 └──────────────────────────────────────────────────────────────┘      │ Log out                        │
   ⌘K Actions: + "Finish setup" (managers, until done / hidden)          └───────────────────────────────┘
```

| Surface                     | Where it lives                                                                     | Who sees it                                           |
| --------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Avatar progress ring        | `src/shared/layouts/AppLayout/components/AccountMenu/` (the trigger)               | managers, team org, guide unfinished and not hidden   |
| "Finish setup · n of 3" row | AccountMenu, first row; opens `#setup` (the steps while not live, the guide after) | same                                                  |
| "Clinic settings" row       | AccountMenu; opens `#settings/organization/clinic`                                 | managers, team org                                    |
| ⌘K "Finish setup"           | `src/shared/components/CommandPalette/app-command-groups.ts` (Actions)             | same as the ring                                      |
| Members' notice             | `src/shared/layouts/AppLayout/components/NoticeStack/` (the System banner pattern) | members without `organization:update`, no open branch |

**Stores** — none new. Server state is a TanStack Query entry; the drawer's open state and step are the URL hash. The
existing `useOnboardingStore` loses the Questions and Invite steps' fields (T1).

**Icons** — through `@/shared/icons/index.ts` only. Add if missing: `ListChecks as LuListChecks` (Finish setup),
`MapPin as LuMapPin` (Where is it), `Stethoscope as LuStethoscope` (Do you see patients). `Building2 as LuBuilding`
and the settings gear exist.

## 4. Route / island map

**No new route island.** Setup is a second hash surface beside Settings; route guards never see it, so it gates itself.

```text
 any room:  /organization/<slug>/<room>[/…]  #setup[/<step>]
                                             ├ #setup               → the first unanswered step, or the guide once live
                                             ├ #setup/clinic-type   → step 1   (API next_step clinic_type)
                                             ├ #setup/location      → step 2   (location)
                                             ├ #setup/you           → step 3   (you)
                                             ├ #setup/live          → "You're live" (after go_live)
                                             └ #setup/guide         → the 3-item guide
 a step not yet unlocked → canonicalized to the first unanswered one (hash: replace, never a new history entry)
```

| Surface                       | Path                                                                                                                              | Kind                                               | Access                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Setup drawer                  | `src/shared/components/SetupDrawer/` + `SetupDrawerLazy` mounted in `pages/organization/$organizationSlug/OrganizationLayout.tsx` | hash surface (`#setup/…`)                          | org-scoped, team org, `organization:update`, not View-as   |
| Setup hash grammar            | `src/shared/components/SetupDrawer/setup-hash-grammar.ts` (pure strings, no runtime imports — like `settings-hash-grammar.ts`)    | —                                                  | —                                                          |
| Settings › Clinic             | `src/shared/components/SettingsModal/organization/` + `clinic` in `settings-sections.ts`                                          | settings section (`#settings/organization/clinic`) | `organization:read` to view, `organization:update` to save |
| Branch drawer › Places & days | `pages/organization/$organizationSlug/users/branches/components/BranchDrawer/`                                                    | a fourth step on edit (D23)                        | `branch:update` (as built)                                 |
| /onboarding                   | `src/pages/onboarding/` (Questions and Invite steps removed)                                                                      | page (as built)                                    | auth (as built)                                            |

The mount sits in the org island, not on the root route, so the entry chunk is untouched and a personal workspace or
the picker never loads it. **Registrations:** `docs/reference/routes-and-ui.md` (the setup hash surface, the Clinic
section, the Places & days step), `docs/reference/routing-and-tenancy.md` §7 (a second hash surface, its grammar and
self-gating), and the OVERVIEW.md of every unit touched (`ORGANIZATION_SLUG.OVERVIEW.md`, `ONBOARDING.OVERVIEW.md`,
`BRANCHES.OVERVIEW.md`, `APP.OVERVIEW.md`, `API.OVERVIEW.md`).

## 5. State management map

| Surface              | Server state (Query)                                                                                                                                  | Client state | URL state                            | Form state                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------ | --------------------------------------------- |
| Setup status (shell) | `useOnboardingSetup()` → `GET /app/onboarding-setup` (RC-1), key `['app','onboarding-setup',organizationId]`; enabled only for managers in a team org | none         | —                                    | —                                             |
| Setup drawer, step 1 | organization (RC-20); PATCH organization specialties (RC-21), PATCH setup `answered_steps += clinic_type` (RC-2)                                      | none         | `#setup/clinic-type`                 | RHF + Zod (1–6 specialties)                   |
| Step 2               | `POST /app/branches` (RC-4, first → main), branch members put (as built)                                                                              | none         | `#setup/location`                    | RHF + Zod (the branch create schema as built) |
| Step 3               | `PATCH memberships/{owner}` extra role + hours (RC-14), `PATCH branches/{id}` default doctor / therapist (RC-6), PATCH setup `+= you`                 | none         | `#setup/you`                         | RHF + Zod (one of three)                      |
| Go live              | `GET /app/offerings` (RC-19), `POST /app/offerings` per missing Consultation (RC-18), `POST /app/onboarding-setup/complete` (RC-3)                    | none         | `#setup/live`                        | —                                             |
| Guide                | the same status; `POST /app/offerings` (treatments), `POST memberships` (RC-15), PATCH setup skip / hide                                              | none         | `#setup/guide`                       | RHF + Zod per row list                        |
| Members' notice      | `GET /app/branches/my` (RC-5, as built)                                                                                                               | none         | —                                    | —                                             |
| Settings › Clinic    | organization (RC-20/21), organization settings (RC-22/23)                                                                                             | none         | `#settings/organization/clinic`      | RHF + Zod                                     |
| Places & days        | rooms, machines, holidays (RC-7…RC-13)                                                                                                                | none         | the branch drawer's route (as built) | RHF + Zod per row                             |

**Invalidation:** the setup status is invalidated after every write that ticks it — branch create / update, offering
create, membership create / update, appointment create, and the setup's own PATCH / complete. After "Go live" the
session context, branches (`/my`) and the room underneath are refreshed (BRIEF.md:179–180).

**Tempted to break a rule:** remembering "already auto-opened" in `localStorage` — no: the server's `deferred_at`
decides (D5); the PIN directory in a store — no: a pure lookup module; the step in Zustand — no: the hash.

## 6. Per-screen build notes

### 6.1 The setup drawer — steps (skills: fe-design-ditto to the house patterns · shadcn · fe-http-forms-errors · fe-e2e-testids)

```text
 ┌ Set up Sunrise Skin ────────────────────────────────── × ┐   560px right drawer (RecordDrawer chrome);
 │ About a minute · Step 2 of 3   ━━━━━━━━━━━━━━──────────  │   a full-screen sheet below md
 │ ✓ What kind of clinic   Skin · Hair                   ✎  │   ← folded peek, edit reopens it
 │ ● Where is your clinic?                                   │   ← the one open step (DrawerSteps)
 │   Bookings and bills need a place.                        │   ← "why" line (BRIEF.md:78)
 │   PIN [395009] → Adajan · Surat · Gujarat   (editable)    │
 │   Address [ … ]  Phone [+91 …]  Email [ owner@… ]         │
 │   Branch name [Sunrise Skin]                              │
 │   Open Mon–Sat · 10:00–20:00 · Change                     │   ← one line; Change expands days + hours
 │ ○ Do you see patients yourself?        After "Where is it" │   ← locked, greyed
 │ ───────────────────────────────────────────────────────── │
 │ Explore first                         [Next: Do you see …]│
 └───────────────────────────────────────────────────────────┘
```

- **Opens on its own** once the boot splash has resolved, when all hold: a team organization; the member holds
  `organization:update`; not a View-as preview; status `is_live = false` and `deferred_at = null`; no other drawer or
  Settings is open. It writes `#setup` with `hash` replace, so Back leaves the room as it was.
- **Header:** "Set up <clinic name>", "About a minute · Step <n> of 3", a progress bar (200ms ease on width).
- **Steps** come from the status's `answered_steps` and `live_checks`: step 1 is done when `clinic_type` is answered;
  step 2 when `live_checks.main_branch` is true (a branch made in Users › Branches counts, BRIEF.md:231–232); step 3
  when `you` is answered. The drawer opens at `next_step`.
- **Step 1** — six specialty chips (pick-any, the boxed check as built), 1–6; "Next" PATCHes the organization's
  specialties, then the setup's answered step.
- **Step 2** — PIN (6 digits) → area, city and state from the bundled directory (§6.4), editable; address line; phone
  (+91, the owner's when known); email (the owner's); branch name = the clinic name (≤ 60). Hours: one line, the
  branch defaults (Mon–Sat, 10:00–20:00); "Change" expands the branch drawer's own days-and-hours fields. "Next" POSTs
  the branch with the owner on its members; a `409` for a main that already exists reads the branch back and counts
  the step as done (BRIEF.md:175–176, 233–234).
- **Step 3** — ◉ Yes, as a doctor · ○ Yes, as a therapist · ○ No. Yes → PATCH the owner's membership: Doctor or
  Therapist added as an **extra** role (Owner stays main, D15), working days and hours = the main branch's (D16); PATCH
  the branch's default doctor / therapist. Then PATCH the answered step. The button reads **"Go live"**.
- **Go live** — read the offerings; POST one Consultation per chosen specialty that has none of that name ("Consultation"
  with one specialty, "<Specialty> consultation" with more; starter-list price, GST and minutes, the New-offering
  defaults, D23); then POST complete. A `409 onboarding_setup_incomplete` names the missing check: the drawer opens that
  step with the translated reason. Then refresh the session, branches and the room; show "You're live".
- **"You're live"** — "We set up: <branch> · Consultation ₹<price> · you as doctor"; [Book your first appointment]
  opens the shared `AppointmentForm` (its own chunk, as `TodayBooking` loads it) over the room; [Done] closes. An
  optional "How did you hear about us?" chip row (analytics only, moved from /onboarding, BRIEF.md:143).
- **Closing** (×, Esc, backdrop, "Explore first") PATCHes `deferred` and clears the hash. With unsaved edits in the
  open step the house "Discard changes?" guard asks first; saved steps are never lost.
- **Keyboard and a11y:** focus moves to the open step's title on every step change; a polite live region announces
  "Step <n> of 3"; Enter = Next (not inside a multi-line field); Esc = close; focus trapped, returned to the opener.
- **Timings:** drawer in `animate-drawer-in` 340ms cubic-bezier(0.32, 0.72, 0, 1), backdrop the same; a step body
  `animate-reveal` 240ms cubic-bezier(0.2, 0.8, 0.2, 1); progress bar width 200ms ease; ring arc 200ms ease; a toast
  5,200ms (`TOAST_DURATION_MS.default`), an error 9,000ms; under reduced motion every one is 1ms.

### 6.2 The guide (skills: fe-design-ditto · fe-http-forms-errors · fe-e2e-testids)

```text
 ┌ Finish setting up Sunrise Skin ────────────────────── × ┐
 │ 1 of 3 done ━━━━━━━━━━━──────────────────────────────    │
 │  ✓ Consultation added                                    │   ← fixed first line (live)
 │  ○ Add your treatments    pick from the starter list   [Add] · Skip
 │  ○ Invite your doctor     nobody can be booked yet     [Invite] · Skip   ← "Invite your team" once someone can
 │  ○ Book your first appointment                         [Book]            ← no Skip (RF§2)
 │                                         Hide this guide  │
 └──────────────────────────────────────────────────────────┘
```

- Items and ticks come from `guide_items` only (`is_done`, `is_skipped`, `can_skip`); the count from
  `guide_done_count` / `guide_total_count`. Nothing is ticked by hand except Skip.
- **Add your treatments** — the starter list for the chosen specialties (§6.5): rows with a tick, name, minutes,
  price and GST, all editable; the Consultation rows that exist are shown done; "Add" POSTs one offering per ticked row.
  "+ Add your own" opens `OfferingQuickCreate` (as built).
- **Invite your team / your doctor** — `has_someone_to_book` picks the wording; "Invite" opens `InviteMemberDialog`
  with a real role (Doctor preselected when wording is "your doctor"), the main branch, and the branch's days and hours
  as the member's working hours (D16).
- **Book your first appointment** — the shared `AppointmentForm` over the room.
- **Skip / Undo skip** and **Hide this guide** PATCH the setup; Hide closes the drawer and the ring and row go
  ("Clinic settings" stays). Reopening the guide from Settings › Clinic clears the hidden time.
- When `guide_done_at` is set, the ring and the row go; the drawer at `#setup/guide` shows "All set" with "Clinic
  settings".

### 6.3 The create-action guard (skills: fe-routing-tenancy · fe-test-generation)

`useRequireOpenBranch()` in `src/shared/hooks/useRequireOpenBranch/` reads `/app/branches/my` (as built). Wired into
New booking and Walk-in (Today's greeting, `TodayGreeting`), ⌘K "New appointment", "New patient" and "New receipt",
and the rooms' create buttons for a patient, a bill and a payment. With no open branch: a manager is sent to
`#setup/location`; a member keeps the as-built "No open branch to book at" message (`app.json`, no change).

### 6.4 PIN directory (skills: fe-bundle-performance · fe-test-generation)

- **Data:** India Post's All India Pincode Directory (data.gov.in, Open Government Data License – India); the source
  and its date are recorded in the generator's header and the unit's OVERVIEW.md.
- **Build:** `tooling/data/build-pin-directory.mjs` turns the CSV into compact JSON split by the PIN's first two digits
  under `src/shared/app/pin-directory/data/`, each `{ pin: [district, state, [office…]] }`.
- **Load:** `lookupPin(pin)` dynamic-imports only the matching part when the sixth digit is typed — never on first
  paint; a size-limit budget pins each part. Works offline once loaded (precached by the service worker like any
  chunk). An unknown PIN fills nothing and blocks nothing; several offices → an area picker; every field stays editable.

### 6.5 Starter services (skill: fe-i18n-constants)

`src/shared/app/app-starter-services.ts` — the table in `plans/decisions.md` › Starter services, typed against the
offerings contract (category, minutes, price in rupees as the API sends it, GST, sessions · validity). Names are i18n keys; a drift test
pins the rows to the decisions table.

### 6.6 Settings › Clinic and Places & days (skills: fe-routing-tenancy · fe-resource-crud · fe-http-forms-errors)

- **Settings › Clinic** (`clinic` in the organization scope, team org only): specialties and timezone (PATCH
  organization); booking-reminder hour, lead hold days, retarget after days, each with its default (PATCH organization
  settings); links to Users › Branches for hours, holidays, rooms, machines, GST and review links; the logo row links to
  Settings › General. No day float (D17). "Show the setup guide again" when the guide is hidden.
- **Places & days** — a fourth branch-drawer step on edit only: rooms and machines (add, rename, switch off, remove)
  and holidays (date + label; add, remove), each row saved on its own with the inline-row pattern as built.

### 6.7 /onboarding, shortened (skills: fe-route-island · fe-test-generation)

Welcome → Your name → Clinic name → Done. `QuestionsStep` and `InviteStep` and their store fields, constants, i18n keys
and tests go; `onboarding-flow.ts` and `StepIndicator` count four steps; the account is still marked onboarded
(RC-25); no invitations are sent from here.

### 6.8 Analytics (skill: fe-test-generation)

Through `src/shared/analytics/capture.ts`, consent-gated as built, never with patient data: `setup_started`,
`setup_step_completed { step }`, `setup_live`, `setup_deferred { step }`, `setup_guide_item { item, outcome:
done | skipped }`, `setup_guide_hidden`, `first_appointment_booked { minutes_since_clinic_created }`.

## 7. Deviations

### 7.1 The brief over the patterns

| Item               | Source says                                   | Built as                                                                                |
| ------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Step cards' footer | `_patterns.md` › Step cards: "Next: <step> →" | the same, plus "Explore first" on the left and "Go live" on step 3 (BRIEF.md:51, 73)    |
| "Live" wording     | BRIEF.md:23 "… and someone to book"           | BRIEF.md:222–224 governs: someone to book is **not** required to go live (D26)          |
| Guide's first line | not in the patterns                           | "✓ Consultation added" — a fixed line, not one of the three counted items (BRIEF.md:96) |

### 7.2 Project rules over the source

Semantic tokens only; shadcn primitives and the house `RecordDrawer` / `DrawerSteps`; icons via the index; every string
an i18n key in en and es (a new `setup` namespace — a dev-server restart after adding it); Settings stays the
`#settings/*` hash modal; the setup drawer is a hash surface, never a route; the API contract is read from clinozy-be,
never inferred; the PIN data and the drawer are dynamic-import only.

### 7.3 The Baseline's Standing deviations this change touches

| Item                               | Design says                    | Built as                                               | Since                | This iteration                                                                |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------- |
| Main branch                        | a Main switch in the drawer    | read-only — "one per clinic, set when it opened"       | launch — D157        | **resolves** — the backend now sets the first branch main (RF§1)              |
| Branch required fields             | name and address line only     | name, address, area, city, six-digit PIN, phone, email | launch — D157        | **keeps** — step 2 asks exactly these, area / city / state from the PIN       |
| New branch City and State          | "Surat / Gujarat"              | copied from the main branch                            | launch — L-31d       | **keeps** — setup's first branch has none to copy; the PIN fills them         |
| Day close default float            | a configured float             | the carried or recounted cash                          | launch — D156        | **keeps** — no float in setup or Settings › Clinic (D17)                      |
| Users · Marketing role             | a fixed role list              | the clinic's real, editable roles                      | launch — Q-U2        | **keeps** — invitations pick a real role                                      |
| Focus                              | not moved                      | trapped in drawers, returned to the opener             | launch — §7.2        | **keeps**, and moves focus to each step's title (BRIEF.md:241)                |
| Account menu · Settings            | no Settings in the menu        | platform rows; Settings as a hash modal                | launch — §3.2, D126  | **keeps** — adds "Finish setup" and "Clinic settings"; the model for `#setup` |
| Landing · Splash exit              | Leads; a fixed 3.7s splash     | the role home; the splash leaves when boot resolves    | launch — D25, Q-S1   | **keeps** — setup does not depend on the room (D11); opens after the splash   |
| Drawer peeks · open step circle    | raw figures; near-black circle | values with units; the stone tone                      | launch — L-30c, L-35 | **keeps** — setup's peeks read "Skin · Hair", "Mon–Sat · 10:00–20:00"         |
| Dirty close                        | silent                         | "Discard changes?"                                     | launch — Q-P1        | **keeps** — only the open step's unsaved edits ask                            |
| Empty states · No clinic room open | "No … matches" only            | the unreachable copy + "New …"; `ClinicHomeEmpty`      | launch — R26, D101   | **keeps** — the members' notice is a new state beside them                    |

New deviations from the drop: none — there is no drawn design for the new surfaces; they follow the patterns the brief
names.

## 8. Verification

- **Intake mode `brief`:** each of the 20 `BRIEF.md` acceptance criteria (BRIEF.md:251–281), proved by a Vitest unit
  or integration test or the Playwright flow below; the ones the backend proves (BRIEF.md:276–277) are cross-checked
  against clinozy-be's `plans/acceptance.md` A1–A15.
- **MODE incremental — the full baseline set:** the launch's e2e suite and every touched surface side by side at 375px
  and 1440px against the as-built screens: the shell (section bar, account menu, ⌘K, notices), Today, Users › Branches,
  Settings, /onboarding.
- **Playwright (local, clinozy-be on :3000):** sign up → /onboarding (4 steps) → the drawer over Today → 3 steps →
  Go live → book → the ring at 1 of 3; the same with the default room switched; a Front desk member sees the notice
  only; a seeded live clinic sees nothing; each at 375px and 1440px, keyboard only for one run, `axe` on every step.
- **Static gates:** `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure && pnpm
validate:testids && pnpm type-check && pnpm lint`, plus `pnpm build:check` (entry chunk unchanged, no stray map),
  `pnpm size` (the PIN parts and the drawer chunk within budget), `pnpm coverage:patch` (changed lines ≥ 90%).
- **Close:** `AS-BUILT.md` summary with the Standing deviations → `pnpm iteration:status <iteration> done` → `frozen`
  in the last commit before the branch merges.

## 9. The route — the ordered ledger

MODE incremental: global → copy → styling (none) → structural → new screens → gate → verify.

| #   | Work item                                                                                                                                                                                       | Kind       | Depends on          | Skill/driver                                                     | Acceptance                                                                                                       | Assignee | Status |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| 1   | G1 · Contracts and fetchers: `onboarding-setup-contracts.ts` / `-api.ts` (RC-1…RC-3), organization specialties + timezone, organization settings; `useOnboardingSetup` and its invalidation map | global     | clinozy-be ROUTE #4 | fe-http-forms-errors · fe-test-generation                        | Zod parses clinozy-be's serializer output (generated API types); errors map to i18n keys; unit tests             | —        | open   |
| 2   | G2 · Setup hash grammar, `SetupDrawerLazy` in `OrganizationLayout`, self-gating, close = Explore first; registrations in routes-and-ui.md and routing-and-tenancy.md §7                         | global     | 1                   | fe-routing-tenancy · fe-bundle-performance                       | `#setup/<step>` opens over any room, refresh and shared link; canonicalizes; `pnpm build:check` entry unchanged  | —        | open   |
| 3   | G3 · Auto-open rule (after the splash; managers, team org, not live, not deferred, not View-as, nothing else open)                                                                              | global     | 2                   | fe-routing-tenancy · fe-test-generation                          | opens once per clinic; never for members, personal, View-as, a live clinic (BRIEF.md:251–254, 273–275)           | —        | open   |
| 4   | G4 · `useRequireOpenBranch` wired into New booking, Walk-in, ⌘K actions, new patient, new bill, receive payment                                                                                 | global     | 2                   | fe-routing-tenancy · fe-test-generation                          | with no open branch a manager lands on `#setup/location` from every entry (BRIEF.md:267–268)                     | —        | open   |
| 5   | G5 · Shell entries: avatar ring, AccountMenu "Finish setup · n of 3" and "Clinic settings", ⌘K "Finish setup", NoticeStack members' notice                                                      | global     | 1, 2                | fe-design-ditto · shadcn · fe-e2e-testids                        | shown and hidden per §3's table (BRIEF.md:269–274); a11y labels; 375 / 1440 side by side with the as-built shell | —        | open   |
| 6   | G6 · PIN directory: generator, data parts, `lookupPin()`                                                                                                                                        | global     | —                   | fe-bundle-performance · fe-test-generation                       | known PIN fills, unknown fills nothing (BRIEF.md:258); off the first-paint path; size budget                     | —        | open   |
| 7   | G7 · Starter services constant + drift test; G8 · analytics event helper                                                                                                                        | global     | —                   | fe-i18n-constants · fe-test-generation                           | the rows equal `plans/decisions.md` › Starter services; events carry no patient data                             | —        | open   |
| 8   | C1 · Copy: the `setup` namespace and the keys in `layout`, `settings`, `users`, `onboarding` — en and es                                                                                        | copy       | 2–7                 | fe-i18n-constants                                                | no hardcoded string (`fe-i18n-auditor` clean); es complete                                                       | —        | open   |
| 9   | T1 · /onboarding shortened: Welcome → Your name → Clinic name → Done; Questions and Invite steps, store fields and tests removed                                                                | structural | 8                   | fe-route-island · fe-test-generation                             | four steps, no invitation sent (BRIEF.md:280); `useOnboardingStore` trimmed                                      | —        | open   |
| 10  | T2 · Branch drawer "Places & days" step (edit only): rooms, machines, holidays                                                                                                                  | structural | 8                   | fe-resource-crud · fe-http-forms-errors · fe-e2e-testids         | add, rename, switch off, remove; holidays add, remove (BRIEF.md:278)                                             | —        | open   |
| 11  | T3 · Settings › Clinic section (organization scope, team only)                                                                                                                                  | structural | 1, 8                | fe-routing-tenancy · fe-http-forms-errors                        | saves specialties, timezone, reminder hour, lead hold, retarget (BRIEF.md:279); no float                         | —        | open   |
| 12  | N1 · Setup drawer: header, steps 1–3, Go live, "You're live", close / dirty guard, keyboard and a11y                                                                                            | screen     | 1–8                 | fe-design-ditto · shadcn · fe-http-forms-errors · fe-e2e-testids | BRIEF.md:255–266, 281; one branch on repeat; no duplicate Consultation; 409 opens the missing step               | —        | open   |
| 13  | N2 · Guide: 3 items, starter picker, invite (team / doctor), book, Skip, Hide, "All set"                                                                                                        | screen     | 12                  | fe-design-ditto · fe-http-forms-errors · fe-e2e-testids          | BRIEF.md:269–272; ticks from records; invitations carry the branch's hours                                       | —        | open   |
| 14  | GT · The static gates, Vitest, `build:check`, `size`, `coverage:patch`                                                                                                                          | gate       | 1–13                | fe-code-quality-security                                         | every gate green                                                                                                 | —        | open   |
| 15  | V1 · Verify: the 20 brief criteria, the Playwright flow at 375 / 1440, the full baseline set side by side                                                                                       | verify     | 14                  | fe-kickoff-iteration › Verify · fe-playwright-e2e                | §8 complete, each criterion with its evidence in `AS-BUILT.md`                                                   | —        | open   |
| 16  | V2 · Close: `AS-BUILT.md` summary and Standing deviations → `done` → `frozen` in the last commit                                                                                                | verify     | 15                  | fe-kickoff-iteration › Close                                     | `pnpm iteration:status` done, then frozen                                                                        | —        | open   |

**Cross-repository order:** clinozy-be ROUTE #1–#4 come before this ledger's row 1; clinozy-be ROUTE #6 (the e2e flow)
and this ledger's row 15 prove the same journey from both sides.
