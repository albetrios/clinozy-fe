# KICKOFF — feat-write-less-2026-10-14-oixr

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `feat-write-less-2026-10-14-oixr`                                                    |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D2](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot ([D3](plans/decisions.md))              |
| Intake hash       | `81c434193c1a` (gate passed 2026-10-14)                                              |
| Schema-routes     | — (no `schema-routes.md`: no entity or route changes)                                |
| Sources           | `intake-files/BRIEF.md` (the change), the current code of the parts it affects       |
| Date              | 2026-10-14                                                                           |
| Evidence notation | `BRIEF.md:<line>` in `intake-files/`, `src/…:<line>` in the code                     |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing ([D5](plans/decisions.md))                         |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — The "write less" set: nine improvements, chosen from a survey of every hand-filled field.
2. **D2** — Baseline `none`, from scratch.
3. **D3** — Intake mode `brief`; from scratch the brief stands alone.
4. **D4** — Built on `feat/write-less`.
5. **D5** — No clinozy-be sibling.
6. **D6** — Dictation reuses `useSpeechRecognition`; the voice button and phrase joining move to shared.
7. **D7** — Speech goes through the browser's own recognizer (AMBER: a clinic off switch is a follow-up).
8. **D8** — ⌘ / Ctrl Enter clicks the drawer's own primary; one Apple-platform detector.
9. **D9** — A no-`eval` sum evaluator in `src/lib`, read by `DrawerNumberInput`.
10. **D10** — Date shorthand lives in `parseTypedDate`.
11. **D11** — Recent keys for six single-select pickers.
12. **D12** — `DrawerTextarea` `suggestions` for the check-in's last plan.
13. **D13** — The PIN look-up and area chips become shared, used by setup and the branch drawer.
14. **D14** — Paid to reads the clinic's recent payees; the two example names go.
15. **D15** — Approved on the user's instruction; `frozen` waits for their final confirmation.
16. **D16** — Screenshots and a recording of every change, on one review page.

## 3. Foundation (before any screen)

### 3.1 Theme

No token is added or changed. The mic's orb and meter keep Report a bug's look (`--color-brand`
glow, `muted-foreground` bars); the hints use `muted-foreground`; chips use the existing
`DrawerQuickChips` look. Dark mode, every preset and every theme axis follow.

### 3.2 Shell

The shell is untouched. `RecordDrawer` (every drawer) gains the ⌘ / Ctrl Enter handler and the
primary's key hint; `KeyboardShortcutsDialog` gains one row.

### 3.3 Stores

None. Recent picks ride the member's preferences (`usePreferences`), as the Picker already does.

### 3.4 Icons

None new — `Mic` (already in the registry) for the voice button.

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed.

| Unit                                                                                                | Kind        | Change                                                                           |
| --------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `src/lib/apple-platform.ts`                                                                         | lib         | new — `isApplePlatform()`; replaces two copies                                   |
| `src/lib/amount-expression.ts`                                                                      | lib         | new — `evaluateAmountExpression()`                                               |
| `src/shared/components/VoiceInputButton/`                                                           | shared unit | promoted from `BugReport/VoiceInputButton/` + `voice-input.css` + `insertPhrase` |
| `src/shared/components/DrawerField/drawer-text-controls.tsx`                                        | shared unit | `DrawerTextarea`: dictation, `suggestions`                                       |
| `src/shared/components/DrawerField/drawer-number-controls.tsx`                                      | shared unit | `DrawerNumberInput` sums; `DrawerStepper` arrow keys                             |
| `src/shared/components/RecordDrawer/`, `DrawerFooter/`                                              | shared unit | ⌘ / Ctrl Enter, the primary's hint                                               |
| `src/shared/components/Picker/DatePicker/date-options.ts`                                           | shared unit | relative dates                                                                   |
| `src/shared/app/pin-directory/`                                                                     | shared      | `usePinPlace`, `PinAreaChips` (from setup)                                       |
| `src/shared/components/KeyboardShortcutsDialog/`                                                    | shared unit | "Save the open drawer" row                                                       |
| check-in steps, branch drawer fields, send payment fields, stock / medical pickers, new task fields | page units  | wiring                                                                           |

## 5. State management map

| Surface      | Server state                            | Client state                       | URL state | Form state                                                          |
| ------------ | --------------------------------------- | ---------------------------------- | --------- | ------------------------------------------------------------------- |
| Dictation    | —                                       | `useSpeechRecognition` (component) | —         | the field's own (`register` or controlled) through an `input` event |
| Sums         | —                                       | the box's typed text (component)   | —         | the result, every keystroke                                         |
| Recent picks | `usePreferences` (`recent_picks`)       | —                                  | —         | —                                                                   |
| Payees       | `useQuery` over `listLedger` (expenses) | —                                  | —         | `payeeName`                                                         |
| Branch PIN   | —                                       | the place found (hook)             | —         | city, state, area                                                   |

No rule is under pressure: nothing new is stored anywhere — browser storage included.

## 6. Per-screen build notes

### 6.1 Every drawer note field — `fe-component-promotion`, `frontend-design`, `web-design-guidelines`

```text
┌ Notes ─────────────────────────────────────────────┐
│ Anything the doctor or desk should know            │
│                                                    │
│                                              (🎤)  │  ← 28px mic, inline end, bottom
└────────────────────────────────────────────────────┘
  pigmentation on both cheeks since…                    ← interim words, muted, live
  ● Hearing you…                                        ← status line (or the problem)
  [⚡ Same plan as last time]                            ← suggestions (when given)
```

The textarea keeps its id, `register()` ref and classes; it gains inline-end padding for the mic.
The text goes in through the native value setter and an `input` event, so `register()` and
controlled fields both see it.

### 6.2 Every drawer's primary — `fe-resilient-interactions`

`Save  ⌘↵` — the hint a `kbd` in the button, 70% ink, from `md` with `pointer: fine`; the button
carries `aria-keyshortcuts="Meta+Enter"` or `"Control+Enter"`.

### 6.3 Number fields — `fe-locale-formatting`

`[₹ | 1500+300            = 1,800 ]` — the result in `muted-foreground`, tabular, grouped in the
app's number format; nothing when the sum does not work out.

### 6.4 Date dropdowns, steppers, pickers — `fe-locale-preferences`

The date search reads the shorthand; its placeholder names it. Steppers take ↑ ↓ PgUp PgDn. Six
pickers pass `recentKey`.

### 6.5 Check-in, branch drawer, send payment — `fe-route-island`

Check-in: two `suggestions`. Branch drawer: `usePinPlace` on the PIN, `PinAreaChips` under it, the
unknown-PIN line. Send payment: `useRecentPayees` (page-local hook) feeds the Paid to chips.

## 7. Deviations

### 7.1 Brief over the design

From scratch there is no carried-forward spec: the brief is the design. Send payment's Paid to chips
leave the launch design's two example names (`payments.md:119`) for the clinic's own payees (D14).

### 7.2 Project rules over the brief

- Semantic tokens only; a named radius step; `rounded-full` surfaces carry `data-slot="pill"`.
- Logical CSS only (the mic and hints mirror on a right-to-left page).
- Every new string in all 11 locales (`pnpm validate:i18n-parity`).

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof.

| Criterion (`BRIEF.md`)                   | Proof                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| mic, interim, insert, stop               | `DrawerTextarea` tests (fake recognizer); recording + screenshots            |
| no mic without support / read-only       | `DrawerTextarea` tests                                                       |
| ⌘ / Ctrl Enter saves as the primary does | `RecordDrawer` tests; recording                                              |
| sums                                     | `amount-expression` tests; `DrawerNumberInput` tests; recording + screenshot |
| date shorthand                           | `date-options` tests; `DatePicker` test; recording + screenshot              |
| Recent in the six pickers                | each picker passes its key (tests); screenshot                               |
| stepper keys                             | `DrawerStepper` tests                                                        |
| check-in chips                           | check-in steps test; screenshot                                              |
| branch PIN                               | `usePinPlace` / branch drawer tests; screenshot                              |
| Paid to payees                           | send form tests; screenshot                                                  |
| 11 locales, gates                        | `pnpm validate:i18n-parity`; `pnpm health`                                   |

## 9. The route — the ordered ledger

| #    | Work item                                                                                           | Kind       | Depends on | Skill/driver                              | Acceptance                                 | Assignee | Status |
| ---- | --------------------------------------------------------------------------------------------------- | ---------- | ---------- | ----------------------------------------- | ------------------------------------------ | -------- | ------ |
| L-1  | `isApplePlatform()`; the two detectors use it                                                       | global     | —          | fe-code-smells-best-practices             | tests; both callers unchanged in behaviour | Claude   | done   |
| L-2  | Shared `VoiceInputButton` + `voice-input.css` + `insertPhrase`; Report a bug imports them           | global     | —          | fe-component-promotion                    | Report a bug tests pass unchanged          | Claude   | done   |
| L-3  | `DrawerTextarea`: dictation + `suggestions`; copy in 11 locales                                     | structural | L-2        | frontend-design · fe-i18n-constants       | §8 rows 1–2                                | Claude   | done   |
| L-4  | ⌘ / Ctrl Enter in `RecordDrawer`; the primary's hint; Keyboard shortcuts row                        | structural | L-1        | fe-resilient-interactions                 | §8 row 3                                   | Claude   | done   |
| L-5  | `evaluateAmountExpression` + `DrawerNumberInput` sums                                               | structural | —          | fe-locale-formatting · fe-test-generation | §8 row 4                                   | Claude   | done   |
| L-6  | Relative dates in `parseTypedDate`; the search placeholder                                          | structural | —          | fe-locale-preferences                     | §8 row 5                                   | Claude   | done   |
| L-7  | Recent keys on six pickers                                                                          | wiring     | —          | fe-code-structure                         | §8 row 6                                   | Claude   | done   |
| L-8  | `DrawerStepper` arrow keys                                                                          | structural | —          | web-design-guidelines                     | §8 row 7                                   | Claude   | done   |
| L-9  | Check-in: last plan chips                                                                           | wiring     | L-3        | fe-route-island                           | §8 row 8                                   | Claude   | done   |
| L-10 | Shared `usePinPlace` + `PinAreaChips`; setup and the branch drawer use them                         | structural | —          | fe-component-promotion                    | §8 row 9                                   | Claude   | done   |
| L-11 | Paid to: the clinic's recent payees                                                                 | wiring     | —          | fe-route-island                           | §8 row 10                                  | Claude   | done   |
| L-12 | Docs: overviews, `docs/reference/design.md`, keyboard docs, the test-id inventory, the project tree | copy       | L-1–L-11   | fe-documentation-maintenance              | `pnpm sync:check`, `pnpm docs:lint`        | Claude   | done   |
| L-13 | Verify: every criterion in the running app — screenshots and a recording                            | verify     | L-1–L-12   | fe-kickoff-iteration                      | every §8 row proven                        | Claude   | done   |
| L-14 | Gates: `pnpm health`                                                                                | gate       | L-13       | fe-before-commit-guard                    | §8 last row                                | Claude   | done   |
| L-15 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`                            | verify     | L-14       | fe-kickoff-iteration                      | README Status `done`                       | Claude   | done   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                 | In plan at     |
| ---------------------- | ----------- | ---------- | -------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | nine changes, rules, eleven criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact               | Brief says                     | Code before says                                | Winner | Action   |
| --- | ------------------ | ------------------------------ | ----------------------------------------------- | ------ | -------- |
| R1  | dictation          | every drawer note field        | only Report a bug (`BugReport.tsx:199`)         | brief  | L-2, L-3 |
| R2  | save keys          | ⌘ / Ctrl Enter in every drawer | only Report a bug (`BugReport.tsx:247`)         | brief  | L-1, L-4 |
| R3  | number text        | sums and k / L                 | digits and one point (`number-text.ts:29`)      | brief  | L-5      |
| R4  | typed dates        | relative forms too             | `12 sep`, `12/9`, ISO (`date-options.ts:207`)   | brief  | L-6      |
| R5  | Recent             | six pickers                    | built, no caller passes `recentKey`             | brief  | L-7      |
| R6  | stepper keys       | ↑ ↓ PgUp PgDn                  | buttons only (`drawer-number-controls.tsx:205`) | brief  | L-8      |
| R7  | check-in last plan | insertable                     | a placeholder only (`check-in-steps.tsx:163`)   | brief  | L-9      |
| R8  | branch PIN         | fills the place                | setup only (`SetupLocationStep.tsx:248`)        | brief  | L-10     |
| R9  | Paid to            | the clinic's payees            | two fixed example names (`send-form.ts:177`)    | brief  | L-11     |
