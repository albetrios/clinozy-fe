# KICKOFF — change-setup-one-question-2026-10-16-odao

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field         | Value                                                                                |
| ------------- | ------------------------------------------------------------------------------------ |
| Iteration     | `change-setup-one-question-2026-10-16-odao`                                          |
| Mode          | initial — from scratch                                                               |
| Baseline      | `none` ([D5](plans/decisions.md))                                                    |
| Intake mode   | brief — `BRIEF.md` alone, the whole snapshot                                         |
| Intake hash   | `2c6e9aa2419c` (gate passed 2026-10-16)                                              |
| Schema-routes | — (no entity or route changes)                                                       |
| Sources       | `intake-files/BRIEF.md`, the current code of `src/shared/components/SetupDrawer/`    |
| Date          | 2026-10-16                                                                           |
| Plans with    | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling       | none — clinozy-be's routes and writes are unchanged                                  |

## 2. Locked decisions

[plans/decisions.md](plans/decisions.md): what it builds (D1), the branch name (D2), the clinic type
(D3), "No" (D4), the iteration (D5), the address of Q2–Q4 (D6), moving on by itself (D7), "n of 5"
(D8), Change on "You're live" (D9), the owner's phone (D10), approval (D11).

## 3. Foundation

- **Theme:** tokens only; the question's title is the drawer body's heading (`text-lg`, 600).
- **Shared units:** none new — `RecordDrawer` without step cards, its `footerStart` for Back,
  `DrawerInput`, `DrawerPhoneInput`, `DrawerChips`, `PinAreaChips`, `usePinPlace`.
- **Stores:** none — the open location question and its draft live in the steps drawer, which stays
  mounted while the hash moves between `clinic-type`, `location` and `you`.

## 4. Route / island map

No route changes — `#setup/<step>` keeps its grammar; the shell's `SetupDrawerLazy` is untouched.

## 5. State management map

| State                                                       | Owner                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| The open step (`clinic-type`/`location`/`you`)              | the hash, canonicalized by `setup-place.ts` (unchanged)                        |
| The open location question (PIN/address/phone)              | `SetupStepsDrawer` (component state)                                           |
| The location draft (PIN, area, city, state, address, phone) | `SetupStepsDrawer`'s `useForm`, prefilled from the main branch when one exists |
| Specialties, the answers, going live                        | the server, as today                                                           |

## 6. Per-screen build notes — `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`

- `setup-place.ts`: `SETUP_QUESTIONS` (clinic-type, pin, address, phone, you), the location
  questions, `questionNumber`.
- `onboarding-setup-contracts.ts`: `setupProgress` counts questions (clinic type 1, main branch 3,
  you 1 — `SETUP_QUESTION_COUNT` 5) in place of `ONBOARDING_SETUP_STEP_COUNT`.
- `setup-location-form.ts`: `LOCATION_QUESTION_FIELDS` and `locationQuestionProblems` — the
  problems one question shows; `locationFormFromBranch` — a main branch read back into the draft.
- `SetupStepsDrawer.tsx`: one question — its title (focused target), why, answer; Back in
  `footerStart`; "Next" / "Go live"; "Question n of 5" in the sub-line, the bar and the live region.
- `SetupLocationStep.tsx` → the three questions: PIN (the sixth digit looks the place up and moves
  on), address (the line, the place under it with Edit, the area chips; area/city/state fields when
  the PIN is unknown or Edit is pressed), phone (Next creates — or, for a main branch already made,
  updates — the branch).
- `SetupYouStep.tsx`: a tap on an answer goes live; the footer's "Go live" stays for the keyboard
  and for a refused go-live.
- `SetupLive.tsx`: the branch line with its hours and email, and Change → the branch's drawer.

## 7. Deviations

None planned.

## 8. Verification

| #   | Criterion                                             | Proven by                                                    |
| --- | ----------------------------------------------------- | ------------------------------------------------------------ |
| 1   | One question per screen, "Question n of 5"            | `SetupDrawer.test.tsx`, Playwright `clinic-setup`            |
| 2   | PIN moves on at six digits; known / unknown PIN       | `SetupLocationStep.test.tsx`, Playwright                     |
| 3   | Back keeps answers                                    | `SetupLocationStep.test.tsx`, `SetupDrawer.test.tsx`         |
| 4   | One main branch named after the clinic, no duplicate  | `SetupLocationStep.test.tsx`, Playwright (`is_main: true`)   |
| 5   | A tap goes live; "You're live" shows defaults, Change | `SetupYouStep.test.tsx`, `SetupLive` test, Playwright        |
| 6   | "Finish setup · n of 5"                               | `onboarding-setup-contracts.test.ts`, `AccountMenu` tests    |
| 7   | Explore first unchanged                               | `SetupDrawer.test.tsx`, Playwright                           |
| 8   | Keyboard, 375 / 1440, axe; copy; gates                | Playwright with axe, vitest-axe, `pnpm health`, `sync:check` |

## 9. The route — the ordered ledger

| #   | Row                                          | Kind       | Depends on | Skills                                                  | Proves       | Assignee | Status |
| --- | -------------------------------------------- | ---------- | ---------- | ------------------------------------------------------- | ------------ | -------- | ------ |
| L-1 | Pure helpers: questions, progress, problems  | structural | —          | fe-test-generation                                      | §8 rows 1, 6 | Claude   | done   |
| L-2 | The one-question drawer and its five screens | structural | L-1        | frontend-design · ui-ux-pro-max · web-design-guidelines | §8 rows 1–5  | Claude   | done   |
| L-3 | "You're live" shows the defaults with Change | structural | L-2        | frontend-design · fe-route-island                       | §8 row 5     | Claude   | done   |
| L-4 | Copy in 11 locales; tests; docs              | copy       | L-3        | fe-i18n-constants · fe-test-generation · fe-e2e-testids | i18n, tests  | Claude   | done   |
| L-5 | Verify in the running app; gates; close      | verify     | L-4        | fe-kickoff-iteration · fe-before-commit-guard           | §8 rows 7, 8 | Claude   | done   |
