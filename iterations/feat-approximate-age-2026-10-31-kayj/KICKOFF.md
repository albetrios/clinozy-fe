# KICKOFF — feat-approximate-age-2026-10-31-kayj

> The plan and the ordered ledger for an iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field       | Value                                                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Iteration   | `feat-approximate-age-2026-10-31-kayj`                                                                                                 |
| Mode        | initial — from scratch                                                                                                                 |
| Baseline    | `none`                                                                                                                                 |
| Intake mode | brief — `BRIEF.md` alone, the whole snapshot (byte-identical to clinozy-be's)                                                          |
| Intake hash | `1ece1c50c902` (gate passed 2026-10-31)                                                                                                |
| Sources     | `intake-files/BRIEF.md`; clinozy-be's `plans/routes-final.md` § 1 and `plans/frontend-handoff.md`; the current code                    |
| Date        | 2026-10-31                                                                                                                             |
| Plans with  | `fe-iteration-planning`; builds with `fe-kickoff-iteration`                                                                            |
| Sibling     | clinozy-be `iterations/feat-approximate-age-2026-10-31-kayj/` — `age`, `date_of_birth_is_approximate`, `age_from` / `age_to` (PR #185) |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md): D1 scope, D2 who builds, D3–D10
the frontend defaults (AMBER), D11 approval.

## 3. Foundation

No token, shell, store or icon change. The API types are regenerated from clinozy-be's OpenAPI
document (`pnpm api:types`).

## 4. Unit map

| Unit                                                                                          | Change                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/http/openapi-types.d.ts`                                                            | regenerated: `age`, `date_of_birth_is_approximate`, `age_from`, `age_to`                                                                                                     |
| `src/shared/api/app/contacts-contracts.ts`, `patients-contracts.ts`                           | the wire fields; `ContactProfile.age` / `dateOfBirthIsApproximate`; `PatientFields.age`; the body sends `age` or `date_of_birth`; an edit leaves an unchanged birth out (D9) |
| `src/shared/api/app/app-list-filters.ts`, `patients-api.ts`, `leads-api.ts`, `*-contracts.ts` | `AGE_BANDS`, `ageBandQueryOf`; the list params' `age`                                                                                                                        |
| `src/shared/components/PatientDrawer/`                                                        | `birthMode` + `age` in the form; `PatientBirthField` (Birth date · Age); the age check; the badge "· approx."                                                                |
| `src/shared/components/RoomToolbar/`                                                          | `ageFilterSection` and `AGE_FILTER_KEYS`                                                                                                                                     |
| Patients and Leads rooms (`*.search.ts`, params, filter fields, toolbars)                     | the Age section, `?age=`                                                                                                                                                     |
| `PatientCells`, `rail-about.tsx`, `ContactCard`                                               | "approx." (D5, D6)                                                                                                                                                           |
| `src/locales/*/app.json` (11 locales)                                                         | the new copy                                                                                                                                                                 |

## 5. State management map

Form state in react-hook-form (`birthMode`, `age`); the filter in the URL (`?age=`); server state
unchanged in TanStack Query.

## 6. Build notes

The drawer's Contact step is the contact/patient form the brief names (New and Edit patient, and the
lead's "Create patient record"); there is no separate contact form in the frontend.

## 7. Verification

By Intake mode `brief`: each `BRIEF.md` criterion (frontend: acceptance 6) and the handoff's F-1 – F-7
with their proof — unit tests (form ↔ body ↔ edit diff, the age check, the bands, the list queries,
the toolbars' sections, the age cell) and `pnpm health`.

## 8. The route — the ordered ledger

| #   | Row                                                              | Skill                                                         | Status |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| L-1 | Contracts and API types: the new fields, the body, the edit diff | `fe-code-structure`, `fe-test-generation`                     | done   |
| L-2 | The drawer's Birth date · Age field, the check, the badge        | `fe-http-forms-errors`, `fe-i18n-constants`, `fe-e2e-testids` | done   |
| L-3 | The Age filter on Patients and Leads                             | `fe-route-island`, `fe-i18n-constants`                        | done   |
| L-4 | "approx." where the age shows                                    | `fe-i18n-constants`, `fe-test-generation`                     | done   |
| L-5 | Close: gates, AS-BUILT, freeze                                   | `fe-kickoff-iteration`                                        | done   |
