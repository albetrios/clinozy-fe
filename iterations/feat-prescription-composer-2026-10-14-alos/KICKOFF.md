# KICKOFF — feat-prescription-composer-2026-10-14-alos

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `feat-prescription-composer-2026-10-14-alos`                                         |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D2](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot ([D3](plans/decisions.md))              |
| Intake hash       | `c4640be851e5` (gate passed 2026-10-14)                                              |
| Schema-routes     | — (no `schema-routes.md`: no entity or route changes)                                |
| Sources           | `intake-files/BRIEF.md` (the change), the current code of the parts it affects       |
| Date              | 2026-10-14                                                                           |
| Evidence notation | `BRIEF.md:<line>` in `intake-files/`, `src/…:<line>` in the code                     |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing ([D4](plans/decisions.md))                         |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — Three parts: Write Rx from anywhere, Rx Pad + straight to medicines, the Rx sidekick. Save as kit is out.
2. **D2** — Baseline `none`, from scratch.
3. **D3** — Intake mode `brief`; the brief stands alone.
4. **D4** — `feat` · `prescription-composer` · clinozy-fe only.
5. **D5** — Branch `feat/prescription-composer`, renamed before the first push; no PR until the user confirms.
6. **D6** — ⌘K's patient finder is a mode of the command menu.
7. **D7** — The sidekick is a 320px column from `xl`, a folded card below; the allergy band on every tier.
8. **D8** — The allergy guard matches word stems and five drug families; it warns and confirms, never blocks.
9. **D9** — New and Edit open on Medicines; step 1 when no doctor could be chosen.
10. **D10** — The Pad reads each line with the quick line's grammar and search.
11. **D11** — Demo data for the evidence lives in the local playground database only.
12. **D12** — Approved for the build on 2026-10-14; the final confirmation precedes any PR.

## 3. Foundation (before any screen)

### 3.1 Theme

No token is added or changed. The allergy band and the matched-line marks use `destructive`
(its `/10` surface and its ink); New · Changed · Stopped use the room tones `sage` · `butter` ·
`blush` through `TONE_CLASSES`; the Pad's preview pills reuse the quick line's `success` pills.
Every theme axis, dark mode and the presets follow.

### 3.2 Shared units

- `QuickLine` (`src/shared/components/QuickLine/`) gains two optional props, both no-ops for its
  other hosts: `inputRef` (the drawer focuses the line on open) and `trailing` (a control after
  Browse — the Rx drawer's Pad toggle).
- `CommandPalette` (`src/shared/components/CommandPalette/`): the clinic groups gain the
  "Write prescription" action and a prescribe mode; the input row shows the mode's chip.

### 3.3 Stores

None. The prescribe mode is the menu's own component state; the Pad's text and the sidekick's
fold are the drawer's.

### 3.4 Icons

None new — all from `@/shared/icons`: `Pill` (the ⌘K action, its chip and the row action),
`ClipboardList` (the Pad toggle), `TriangleAlert` (the band, a matched line), `Check` (a read Pad
line), `RotateCw` (Continue).

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed.

| Unit                                                                          | Kind        | Change                                                                   |
| ----------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `…/patients/$patientId/prescriptions/` (+ `create/`, `$prescriptionId/edit/`) | page island | the drawer host passes the patient's allergies                           |
| `…/prescriptions/components/PrescriptionDrawer/`                              | island unit | opens on Medicines; the Pad; the sidekick; the band; the allergy confirm |
| `…/patients/` (Patients room)                                                 | page island | the row action "Write prescription"                                      |
| `src/shared/components/CommandPalette/`                                       | shared unit | the action and the prescribe mode                                        |
| `src/shared/components/QuickLine/`                                            | shared unit | `inputRef`, `trailing`                                                   |

## 5. State management map

| Surface             | Server state                                                                             | Client state                         | URL state                                         | Form state                      |
| ------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------- | ------------------------------- |
| ⌘K prescribe mode   | the contacts search (`useCommandSearch`), as today                                       | `useState` (mode) in the menu        | — (picking navigates to `…/prescriptions/create`) | —                               |
| The Rx Pad          | the Rx catalogue (`useRxCatalog`), as today                                              | `useState` (open, text)              | —                                                 | adds to the drawer's `items`    |
| The sidekick        | the patient's prescriptions (`usePatientPrescriptions`) and the file's patient, as today | `useState` (folded, below `xl`)      | —                                                 | reads `items` (`useFormValues`) |
| The allergy confirm | —                                                                                        | `useState` (open, the save it holds) | —                                                 | —                               |

Nothing new is fetched: every read is one the drawer's host already makes.

## 6. Per-screen build notes

### 6.1 ⌘K — "Write prescription" and the patient finder — `fe-routing-tenancy`, `web-design-guidelines`

```text
⌘K                                         ↵ on "Write prescription"
┌───────────────────────────────────────┐  ┌─────────────────────────────────────────────┐
│ 🔍 Search or jump to…            esc  │  │ 🔍 [💊 Write prescription ×] Which patient?…│
├───────────────────────────────────────┤  ├─────────────────────────────────────────────┤
│ ACTIONS                               │  │ THIS PATIENT                                │
│  👤 New lead                  Leads   │  │  💊 Dipendra Dwivedi       #23 · •••• 3887  │
│  📅 New appointment    Appointments   │  │ PATIENTS            (3+ letters / 4+ digits)│
│  💊 Write prescription     Patients   │  │  💊 Dharti Galani          #3508 · •••• 3212│
│  …                                    │  │                                             │
└───────────────────────────────────────┘  └─────────────────────────────────────────────┘
```

- The action follows New patient in the Actions group; keywords `rx`, `prescription`,
  `medicine` (`BRIEF.md:6–7`). Shown when the member may view Patients and write prescriptions
  (`usePrescriptionAccess().writes`) — View-as aware through `useAppAccess`.
- The mode: the chip (a pill with its ×) before the input, the placeholder, Backspace on an
  empty line and the chip's × leave it (`BRIEF.md:8–12`). The People search answers with patients
  only; each row navigates to `organizationPrescriptionCreate(slug, patientId)`.
- "This patient": the menu opened over `…/patients/$patientId/…` lists that patient first — the
  file's own read (the patient query the file layout keeps warm), no new request.

### 6.2 The Patients room's row action — `fe-resource-crud`

`Write prescription` (`Pill`) after New invoice, for `usePrescriptionAccess().writes`
(`BRIEF.md:13–14`, `:68–70`); it navigates to the patient's `prescriptions/create`.

### 6.3 Straight to medicines — `fe-resilient-interactions`

The drawer's first open step is `medicines` when the form has a doctor, else `prescription`
(`BRIEF.md:15–18`); a new prescription passes the quick line's input as `initialFocusRef`.

### 6.4 The Rx Pad — `frontend-design`, `web-design-guidelines`

```text
┌ 2 Medicines ───────────────────────────────────────────────────────────────────────┐
│ [🔍 Type medicine, dose, timing · e.g. flu 0-0-1 af 10d   ↵ add] [Browse] [✎ Pad]   │
│ ┌ PAD · one medicine a line, paste a whole prescription ─────────────────────────┐ │
│ │ 1. Tab. flu 0-0-1 af 10d                                                         │ │
│ │ - keto scalp thrice                                                              │ │
│ │ minox scalp hs                                                                   │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
│  ✓ Flubolt 400            [0-0-1] [After meal] [10 days] [×10]     24 in stock      │
│  ✓ Ketoconazole 2% Shampoo [Scalp]                                                  │
│  ✓ Minoxidil 5% Solution  [0-0-1] [Night] [Scalp]                                   │
│  3 lines · 3 found                          [Clear]  [Add 3 medicines  ⌘↵]          │
│ ┌ MEDICINE ─────── DOSE · M A N ─── MEAL ─── WHERE ─── QTY ┐                        │
```

- A pure `rx-pad.ts`: split lines, strip bullets / numbering / form words (D10), parse each with
  `parseRxLine`, match with `matchRxMedicines` (first), else `typedRxName`; a line with no words is
  `unreadable` and skipped (`BRIEF.md:19–28`).
- `Add N medicines` folds the lines through `withRxLine(…, rxLineFor(…))` — the quick line's own
  add — so a blank row fills first; one toast "3 medicines added".
- Keyboard: ⌘/Ctrl ↵ adds, Esc closes (and does not close the drawer). The pad is a labelled
  `textarea`; the preview is a live region, polite.

### 6.5 The Rx sidekick and the allergy guard — `frontend-design`, `web-design-guidelines`

```text
FROM xl — drawer min(1360, 100vw − 56): the form 1040 · the sidekick 320
┌───────────────────────────────────────────────────────────────┬───────────────────────┐
│ New prescription  · Dipendra Dwivedi · #23                     │ ALLERGIES             │
│ [3 medicines] [Draft] [Chitramala M.]                          │  ⚠ Sulfa drugs        │
├────────────────────────────────────────────────────────────────┤  Septran DS matches   │
│ ⚠ Allergies: Sulfa drugs · Septran DS matches Sulfa drugs      │ SINCE RX #1 · 30 Sep  │
├────────────────────────────────────────────────────────────────┤  New  Septran DS      │
│ QUICK FILL [Repeat last Rx #1] [Acne starter]                  │  Changed Doxycycline  │
│ ① Prescription  Oct 15 · Chitramala M.                    Edit │   1-0-1 → 1-0-0       │
│ ② Medicines …                                                  │  Stopped Cetirizine 10│
│ ③ Clinical notes                                               │        [Continue]     │
│                                                                │  1 unchanged          │
│                                                                │ WHAT THE PATIENT READS│
│                                                                │  1 Septran DS …       │
├────────────────────────────────────────────────────────────────┴───────────────────────┤
│ 3 medicines · Chitramala M.                     [Cancel] [Save & sell] [Save & approve] │
└──────────────────────────────────────────────────────────────────────────────────────────┘
BELOW xl: the band, then a folded card above the steps —
  [⚠ 1 allergy match · 3 changes since Rx #1                                    ⌄ Show]
```

- Pure units, each with its tests: `rx-allergy.ts` (`allergyMatches(lines, catalog, allergies)`,
  D8), `rx-since-last.ts` (`rxChangesSince(lines, previous)` → new · changed · unchanged ·
  stopped, by medicine name, any case), `rx-plain.ts` (a line in plain words).
- The previous prescription: a new one compares with `history[0]`; an edit with the newest one
  numbered below it.
- "Continue" folds the stopped line back through `withRxLine` (`BRIEF.md:78`).
- The save confirm (`RxAllergyConfirm`, the shared `ConfirmDialog`): "Prescribe despite the
  allergy?", the matching lines, "Go back" (focus returns to the drawer) and "Save anyway" (the
  save the member pressed — approve or sell). Never on a read-only (approved) drawer.
- Reduced motion: the card's fold has no animation beyond the shared collapsible's.

## 7. Deviations

### 7.1 Brief over the design

From scratch there is no carried-forward spec: the brief is the design. The drawer's existing
anatomy — the three steps, Quick fill, the footer, the save rules — is kept; the composer adds
to it.

### 7.2 Project rules over the brief

- Semantic tokens only; named radius steps; `rounded-full` surfaces carry `data-slot="pill"`
  (`pnpm validate:tokens`, `pnpm validate:theme-axis`); logical CSS only (`pnpm validate:logical`).
- Every string through `patient-file` (`RX_KEYS`) or the command menu's namespace, in all 11
  locales with each language's plural forms (`pnpm validate:i18n`, `pnpm validate:i18n-parity`).
- No digits in names; test ids follow the drawer's (`rx-drawer-…`, `rx-pad-…`, `rx-sidekick-…`,
  `command-palette-…`) and are added to the inventory (`pnpm validate:testids`).

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof.

| Criterion (`BRIEF.md`)                                     | Proof                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ⌘K action, "rx", the finder, picking (`:84`)               | `CommandPalette` / `app-command-groups` tests; screenshots; the video                        |
| "This patient" first; Backspace leaves (`:85`)             | the same tests; screenshot over a patient file                                               |
| hidden without the create gate (`:86`)                     | tests with an access double lacking `patient_prescription:create`                            |
| Patients row action (`:87`)                                | `PatientsPage` test; screenshot                                                              |
| opens on Medicines, focus, step 1 without a doctor (`:88`) | `PrescriptionDrawer` tests; screenshots                                                      |
| the Pad (`:89`)                                            | `rx-pad` unit tests; `RxPad` component test; the video                                       |
| the band and the confirm (`:90`)                           | `rx-allergy` unit tests; `PrescriptionDrawer` test (confirm, Save anyway saves); screenshots |
| since last Rx and Continue (`:91`)                         | `rx-since-last` unit tests; `RxSidekick` test; screenshots                                   |
| plain words (`:92`)                                        | `rx-plain` unit tests; screenshots                                                           |
| column from 1280, card below; dark, RTL, phone (`:93`)     | screenshots 1440 light + dark, 1280, 1024, 390, Arabic 1440                                  |
| existing flows unchanged (`:94`)                           | the prescription, palette and Patients suites pass; `pnpm validate:testids`                  |
| gates                                                      | `pnpm health`                                                                                |

## 9. The route — the ordered ledger

| #    | Work item                                                                                                     | Kind       | Depends on | Skill/driver                                             | Acceptance                                   | Assignee | Status |
| ---- | ------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | -------------------------------------------------------- | -------------------------------------------- | -------- | ------ |
| L-1  | `QuickLine` `inputRef` + `trailing`                                                                           | global     | —          | composition-patterns · fe-test-generation                | `QuickLine` tests; other hosts unchanged     | Claude   | done   |
| L-2  | Pure units: `rx-pad.ts`, `rx-allergy.ts`, `rx-since-last.ts`, `rx-plain.ts` + unit tests                      | structural | —          | fe-test-generation                                       | §8 rows 6–9 (units)                          | Claude   | done   |
| L-3  | Straight to medicines (open step, quick-line focus, step 1 without a doctor)                                  | structural | L-1        | fe-resilient-interactions                                | §8 row 5                                     | Claude   | done   |
| L-4  | The Rx Pad (`RxPad`, the Pad toggle, add all, keys)                                                           | structural | L-1, L-2   | frontend-design · web-design-guidelines · fe-e2e-testids | §8 row 6                                     | Claude   | done   |
| L-5  | The sidekick, the allergy band and the save confirm; the host passes allergies                                | structural | L-2        | frontend-design · web-design-guidelines · fe-e2e-testids | §8 rows 7–10                                 | Claude   | done   |
| L-6  | ⌘K "Write prescription" and the prescribe mode                                                                | structural | —          | fe-routing-tenancy · fe-e2e-testids                      | §8 rows 1–3                                  | Claude   | done   |
| L-7  | The Patients room's row action                                                                                | structural | —          | fe-resource-crud                                         | §8 row 4                                     | Claude   | done   |
| L-8  | Copy in all 11 locales                                                                                        | copy       | L-3–L-7    | fe-i18n-constants                                        | `pnpm validate:i18n`, `validate:i18n-parity` | Claude   | done   |
| L-9  | Docs: `PRESCRIPTIONS.OVERVIEW.md`, the test-id inventory, the command menu's overview                         | copy       | L-1–L-8    | fe-documentation-maintenance                             | `pnpm sync:check`, `pnpm docs:lint`          | Claude   | done   |
| L-10 | Verify: the BRIEF criteria in the running app (screenshots 1440 light/dark, 1280, 1024, 390, Arabic; a video) | verify     | L-1–L-9    | fe-kickoff-iteration                                     | every §8 row proven                          | Claude   | done   |
| L-11 | Gates: `pnpm health`                                                                                          | gate       | L-10       | fe-before-commit-guard                                   | §8 last row                                  | Claude   | done   |
| L-12 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`                                      | verify     | L-11       | fe-kickoff-iteration                                     | README Status `done`                         | Claude   | done   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                 | In plan at     |
| ---------------------- | ----------- | ---------- | -------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | four changes, rules, eleven criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact                | Brief says                             | Code before says                                                                                                                          | Winner | Action   |
| --- | ------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| R1  | reaching the drawer | ⌘K and the Patients room (`:5–14`)     | the patient file only (its + menu, the section's New, the Overview, the visit flow); ⌘K has no Rx target (`app-command-targets.ts:22–35`) | brief  | L-6, L-7 |
| R2  | the first step      | Medicines (`:15–18`)                   | `useState('prescription')` (`PrescriptionDrawer.tsx:390`)                                                                                 | brief  | L-3      |
| R3  | adding medicines    | many lines at once (`:19–28`)          | one quick line at a time, or Browse (`use-rx-quick-line.ts`)                                                                              | brief  | L-4      |
| R4  | allergies           | a band, marks, a confirm (`:30–35`)    | read by the file (`patients-contracts.ts:60`) but never shown in the drawer                                                               | brief  | L-5      |
| R5  | the previous Rx     | since last Rx with Continue (`:36–39`) | "Repeat last Rx" copies it whole (`PrescriptionDrawer.tsx:216–224`); no comparison                                                        | brief  | L-5      |
| R6  | kits                | out of scope (`:105–106`)              | listed only (`prescriptions-api.ts:224`)                                                                                                  | brief  | none     |
