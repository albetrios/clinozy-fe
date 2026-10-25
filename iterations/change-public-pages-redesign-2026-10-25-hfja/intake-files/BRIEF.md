# Brief — the public pages redesigned around a live tour of one patient's day, in branch hours

## What changes

1. **No loading screen for a signed-out visitor.** A signed-out visit to `/` or `/login` lands on
   the sign-in screen at once — no boot splash; the first paint already draws the new layout's
   outline. A returning signed-in visitor keeps the splash. Coming back from Google, the sign-in
   code is exchanged as the app boots, without waiting for the callback page to load.
2. **One loader everywhere.** Every busy state — a busy button, a busy row or chip, a search field,
   the whole-screen wait and the returning visitor's splash — uses one loader: the wordmark's "o"
   turning (ring, arc, the green dot), one tempo (900ms; slower, never still, under reduced motion).
   A busy button keeps its colour and its label.
3. **The sign-in screen (`/login`, and the MFA and Google hand-off screens it frames).**
   - Two columns from 1100px: the form's column (logo and controls, the form on the page, the
     privacy line, a footer with the year and "Privacy choices") beside a stage held in view. One
     column below, the form first.
   - **The stage is a tour**: one patient, Riya, through the clinic in eight slides — Leads,
     Appointments, Front desk, Patient file, Treatment, Payments, Tasks, Branches — each in its
     room's tone, on a Today sheet set to the viewer's own clock and language, and each feature
     shown working in a "lens" under her row (her message typing in, a slot picked, the wait
     counting, a prescription writing itself, a session filling, the bill settling, a follow-up
     dropping in, the branch picker).
   - It plays on its own only on `/login`, holds while the viewer is busy (pointer, typing, a hidden
     tab, scrolled away), has a pause button, and narrates only a slide the viewer picked.
   - **Branches**, the last slide: Riya's sheet fans into a deck of the clinic's three branches, each
     with its state on the viewer's clock, then folds into one sheet for every branch.
   - Headlines: "Every patient. Every branch. One calm screen." and one short, two-beat headline per
     slide ("5:22 PM: a DM becomes a lead", "Booked for 5:30 PM. Zero back-and-forth.", …).
   - Sign-in copy: "Sign in to Clinozy", "New here? The same steps create your account.", "Email"
     (not "Work email"), "Continue with email", "Verify and continue".
4. **The public status pages** (404, 403, a full-page failure, an invitation that cannot be used)
   wear the wordmark's "o" as their emblem, with plainer copy.
5. **Clinic hours follow the branch.**
   - The sign-in tour paints its day in this device's branch hours: the signed-in app remembers the
     current branch's hours on the device (hours only); a first visit uses a new branch's defaults,
     Mon–Sat 10:00–20:00. Closed, the sheet shows the branch's next opening.
   - A task's "Tomorrow" snooze, and the outcomes that snooze "until tomorrow", wake it at its
     branch's opening time on its next working day — not 10:00 every day.

## Why

The sign-in screen is the first thing a clinic owner or a new hire sees, and it was slow (a loading
screen before a form) and abstract (a dial of journey stops). The redesign answers in the first
seconds what the product does — by showing it working, on the viewer's own clock — and makes the
first visit instant. One loader makes every wait look like the product. Clinics keep different hours
per branch, so the tour and the "Tomorrow" snooze follow the branch, not a fixed day.

## Affected screens, entities and routes

- Screens: the sign-in screen (`/login`), MFA (`/mfa`), the Google hand-off (`/callback`), the 404,
  the 403, the full-page error, the invitation error card; the app shell (the branch hours it
  remembers); the Tasks room and Today's work queue (the "Tomorrow" snooze); every busy state
- Entities: Branch (read: `opens_at`, `closes_at`, `working_days`), Task (snooze)
- Routes: none added or changed — `GET /app/branches/my` and `POST /app/tasks/{task_id}/snooze`
  are read and written as they are

## Rules

- No change to the sign-in flow, its methods, its errors or its test ids; no API change.
- Semantic tokens only; dark mode, every preset and the theme axes follow; logical CSS, so Arabic
  mirrors.
- Reduced motion: the tour never plays on its own and every slide is drawn at its end.
- The tour's motion and layout ship with the lazy auth chunk; the initial JS and CSS stay within
  their budgets.
- The device keeps branch hours only — no branch name or id — and never as a record: a hint that
  paints a sample day.
- All copy in the 11 locales, in each locale's own app terms.

## Acceptance criteria

- [ ] A signed-out visit to `/` or `/login` shows the sign-in form with no splash; a signed-in
      reload keeps the splash; Google's code is exchanged at boot.
- [ ] Every busy state shows the one loader; a busy button keeps its colour and label.
- [ ] From 1100px the sign-in screen is two columns; below, one column with the form first.
- [ ] The tour plays eight slides on `/login` only, holds while the viewer is busy, pauses, and
      narrates only a picked slide; reduced motion draws each slide at its end.
- [ ] The tour's times, dates and money follow the viewer's clock and language; closed, the sheet
      shows the branch's next opening, and no visit is drawn outside the hours.
- [ ] Branches fans the deck with each branch's state, then folds into "All branches" with every row
      tagged; a replay plays it again; leaving the slide slides the sheet back.
- [ ] The headlines read as approved, in all 11 locales; the title breaks only between sentences.
- [ ] The 404, 403, full-page error and invitation error read with the new emblem and copy.
- [ ] A task's "Tomorrow" snooze wakes at its branch's next opening ("Tomorrow 10:00 am", or the
      date past a closed day).
- [ ] Light, dark and Arabic read correctly from 390px to 1920px with no horizontal overflow.
- [ ] Initial JS and CSS stay within their size budgets; SonarQube reports no issue.

## Out of scope

- The backend: no route, entity or job changes.
- Branch holidays (only the Branches room reads them today).
- The "What's next" follow-up times (tomorrow 11:00 stays).
- Other public pages' layout (the organization picker keeps its frame).
