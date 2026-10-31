# feat-approximate-age-2026-10-31-kayj — as built

What was actually built, ledger row by ledger row, against the approved plan in
[`KICKOFF.md`](KICKOFF.md). Built 2026-10-31 on `feat/approximate-age`, on clinozy-be PR #185's
contract.

## Rows

| #   | Ledger row | Planned                 | Actually built                                                                                                                                                                                                                                                                                                                                         | Difference                                                                                        |
| --- | ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| #1  | L-1        | Contracts and API types | `pnpm api:types` (only the four new fields changed). `contactFieldsWire` + `ContactProfile` gain `dateOfBirthIsApproximate`, `age`; `PatientFields.age`; `personBodyOf` sends `age` or `date_of_birth`; `patientChangeOf` uses `birthChangeOf` and leaves an unchanged birth out (D9). Wire fixtures and doubles carry the new fields                  | As planned                                                                                        |
| #2  | L-2        | The drawer field        | `PatientFormValues.birthMode` / `age`; `patientFormOf` opens an approximate person in Age mode (D4); `patientInputOf` → `birthInputOf`; `PatientBirthField` (chips `patient-drawer-birth-mode-*`, input `patient-drawer-age`); `isInvalidPatientAge` in the save's check; `contact.age` / `body.age` mapped to the field; the badge "34 yrs · approx." | The handoff's test ids became the drawer's own prefix (`patient-drawer-…`), as every drawer field |
| #3  | L-3        | The Age filter          | `AGE_BANDS` + `ageBandQueryOf`; `ageFilterSection` + `AGE_FILTER_KEYS`; `age` in both rooms' search, params, filter fields and toolbars                                                                                                                                                                                                                | Bands instead of two number inputs (D7)                                                           |
| #4  | L-4        | "approx."               | `PatientAgeCell` (`approximate`, `patient-age-approximate`), the contact card's About line, the patient rail (date row and birthday hidden when estimated), the drawer badge; 11 locales                                                                                                                                                               | The print sheet unchanged (D6)                                                                    |
| #5  | L-5        | Close                   | Tests: `patient-age.test.ts` (5), `app-list-filters.test.ts` (+2), `patients-api.test.ts` / `leads-api.test.ts` (+1 each), `PatientCells.test.tsx` (+1); updated toolbar order and fixture tests. `pnpm type-check`, `pnpm lint`, `pnpm sync:check` ✓; the touched suites 912 + 57 + 66 ✓; `pnpm health` — see the PR                                  | —                                                                                                 |

## Standing deviations

| Item               | Design says                     | Built as                           | Since iteration | Decision |
| ------------------ | ------------------------------- | ---------------------------------- | --------------- | -------- |
| Age filter control | two number inputs (handoff FE5) | age bands                          | this one        | D7       |
| Age words          | "34 y" (handoff FE3)            | "34 yrs" (the app's existing copy) | this one        | D5       |
