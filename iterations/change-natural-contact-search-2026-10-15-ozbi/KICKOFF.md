# What was typed becomes the contact; natural search — kickoff plan

> **Status: approved on 2026-10-15** on the user's review of the compact picker (D10). Every decision
> is in [`plans/decisions.md`](plans/decisions.md). `fe-kickoff-iteration` builds §6 in ledger order
> (§9); what was actually built goes in `AS-BUILT.md`.

## 1. Header

| Field            | Value                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/change-natural-contact-search-2026-10-15-ozbi/` · **initial** (type `change`, Baseline `none`) |
| Intake           | mode `brief` · "1 received (BRIEF.md) · from scratch" · placed 2026-10-15 · Intake hash `ea16bd64df67`     |
| Sources          | `intake-files/BRIEF.md`; the code as built (the compact picker, frozen `change-compact-contact-picker`)    |
| Evidence         | `path:n` = this repo                                                                                       |
| Planned by       | `fe-iteration-planning` · Built by `fe-kickoff-iteration`                                                  |
| Sibling          | clinozy-be `change-natural-contact-search-2026-10-15-ozbi` — every-word search (D2)                        |

Coverage (Step 1): `BRIEF.md`, read fully — the three changes, the rules, six acceptance criteria → §6,
§8, §9. Delta (Step 2): `n/a — initial`.

## 2. Locked decisions

D1 what changes · D2 both repositories · D3 a new paired iteration on the same branch · D4 name, mobile,
Instagram · D5 email left out (AMBER) · D6 the appointment form takes no handle · D7 the add row's
chips · D8 "Use contact" / "Use patient" go · D9 every word marked · D10 approval — all in
[`plans/decisions.md`](plans/decisions.md).

## 3. Foundation

n/a — no theme, shell, store or icon change (the Instagram mark is already exported).

## 4. Route / island map

No route or island changes; the hosts are those of the compact picker (`ContactQuickPick`,
`ContactQuickPickField`, `PatientPicker`, `WhoSection`, `NewLeadContactStep`).

## 5. State management map

Unchanged: the quick add's own `useState` gains an Instagram value; New lead's form holds it in its
`ContactEditorValue.instagram`; the contact made by New task / the patient pickers carries it in
`ContactFields.instagramHandles`.

## 6. Per-screen build notes

1. **Parsing** (`contact-quick-pick-query.ts`): `QuickAddDraft` gains `instagram` (`''` when none);
   `quickAddDraftOf` takes out an email (dropped, D5) and a handle (`@x`, `instagram.com/x`) before
   the number run and the name. `markWords(name, typed)` replaces `markMatch`: every word marked.
2. **The add row** (`ContactQuickPick.tsx`): "New contact" / "New patient" + a chip per value
   (name, `+91 …` isolated, `@handle`) — only kinds the host takes (`takesInstagram`, default `true`).
3. **The quick add** (`ContactQuickAdd.tsx`): an Instagram field (with the editor's handle rules)
   when the draft has a handle; "More details" and "Add contact" hand it on.
4. **Hosts**: New lead (`contactValueOfDraft` → `instagram`), `useQuickAddContact` /
   `useQuickAddPatient` (the handle in the contact made), the appointment form
   (`takesInstagram={false}`); rows' `action` optional — "Use contact" / "Use patient" removed.
5. **Copy** (`fe-i18n-constants`): remove `contactPick.use`, `contactPick.patient.use`,
   `contactPick.addNamed|addPhone|addNamedPhone` and the patient variants, New lead's
   `useContact`; add the quick add's Instagram label if none fits — all 11 locales.

## 7. Deviations

Standing deviations: none carried (from scratch). New: the add row's sentence becomes chips (D7);
an email typed is not kept (D5).

## 8. Verification

The BRIEF acceptance criteria in the running app (clinozy-be with its sibling change) at 375px and
1440px with before / after recordings; the static gates (`validate:tokens`, `validate:theme-axis`,
`validate:structure`, `validate:testids`, `type-check`, `lint`, `biome:check`, `tsdoc:check`,
`sync:check`, `docs:lint`); the full `pnpm test`.

## 9. The route — the ordered ledger

| #   | Work item                                                      | Kind       | Depends on | Skill/driver                                    | Acceptance                           | Assignee | Status |
| --- | -------------------------------------------------------------- | ---------- | ---------- | ----------------------------------------------- | ------------------------------------ | -------- | ------ |
| L-1 | Parsing: handle, email out, `markWords`                        | foundation | —          | fe-test-generation                              | unit tests for each kind             | Claude   | open   |
| L-2 | The add row's chips; the quick add's Instagram field           | structural | L-1        | shadcn, frontend-design                         | BRIEF criteria 1–3                   | Claude   | open   |
| L-3 | Hosts carry the handle; `takesInstagram`; row words removed    | structural | L-2        | fe-code-structure                               | BRIEF criteria 1, 4; host suites     | Claude   | open   |
| L-4 | Copy across 11 locales; docs (design.md, testids inventory)    | copy       | L-2, L-3   | fe-i18n-constants, fe-documentation-maintenance | `validate:i18n-parity`, `sync:check` | Claude   | open   |
| L-5 | Verify with the clinozy-be sibling: before / after, 375 / 1440 | verify     | L-1–L-4    | fe-kickoff-iteration                            | BRIEF criteria 1–5, recordings       | Claude   | open   |
| L-6 | Gates, `AS-BUILT.md`, Status `done`, commit, push              | gate       | L-5        | fe-before-commit-guard                          | §8 green; no pull request            | Claude   | open   |
