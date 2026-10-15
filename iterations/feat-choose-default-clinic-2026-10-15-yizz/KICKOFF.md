# Choose the clinic that opens at sign-in — kickoff plan

> **Status: approved on 2026-10-15** under the user's standing answer (D9). Every decision is in
> [`plans/decisions.md`](plans/decisions.md). The backend half — the stored choice and the login
> order — is clinozy-be's same-named iteration.

## 1. Header

| Field            | Value                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/feat-choose-default-clinic-2026-10-15-yizz/` · **initial** (type `feat`, Baseline `none`, D1)   |
| Intake           | none — the requirement is § 2                                                                               |
| Date             | 2026-10-15                                                                                                  |
| Branch           | `feat/default-clinic-at-login` (D2)                                                                         |
| Sibling          | clinozy-be `feat-choose-default-clinic-2026-10-15-yizz` — `default_organization_id` on `/users/me/settings` |

## 2. The request

"After default — they can change their default if they want somehow in a better way — please
implement that as well."

**After.** Sign-in still opens the clinic used last by default; anyone with two or more clinics can
pin one instead, or go back to automatic, from Settings or in one tap from the account menu.

## 3. Surfaces

| Surface                    | Where                                                             | Change                                                 |
| -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| "Clinic at sign-in" card   | Settings › Account (`SettingsModal/account/SignInClinicCard/`)    | NEW — radio list: the clinic I used last · each clinic |
| "Opens at sign-in" submenu | Account menu (`AppLayout/components/AccountMenu/`)                | NEW — the same choices as menu radio items             |
| "Default" label            | Switch clinic list (`OrganizationSwitcher`)                       | NEW — on the pinned clinic's row                       |
| Data                       | `shared/api/user-settings-*.ts` + `shared/hooks/useSignInClinic/` | NEW — `GET`/`PATCH /users/me/settings`, one query key  |

```text
Account menu                          Settings › Account
┌──────────────────────────────┐      ┌───────────────────────────────────────────┐
│ Demo User                    │      │ Clinic at sign-in                          │
│ Switch clinic            ▸   │      │ Choose which clinic opens when you sign in │
│ Opens at sign-in         ▸ ──┼──┐   │ ◉ The clinic I used last                   │
│ …                            │  │   │   Follows you as you move between clinics  │
└──────────────────────────────┘  │   │ ○ Ojas Dermatology & Aesthetics            │
   ┌──────────────────────────┐   │   │ ○ Demo Organization                        │
   │ ◉ The clinic I used last │ ◀─┘   └───────────────────────────────────────────┘
   │ ○ Ojas Dermatology …     │
   │ ○ Demo Organization      │
   └──────────────────────────┘
```

## 4. Acceptance

- **F-1** The card and the submenu show "The clinic I used last" selected for someone with no pin,
  and the pinned clinic once one is chosen; both are absent with fewer than two clinics.
- **F-2** Choosing saves at once, confirms with a toast, and updates the other surface; a failed
  save reverts and reports the error.
- **F-3** The Switch clinic list labels the pinned clinic "Default".
- **F-4** In the real app: pin Ojas from the account menu, sign out and in → Ojas; switch to Demo
  Organization, sign out and in → still Ojas; choose "The clinic I used last" in Settings, sign out
  and in → Demo Organization.
- **F-5** Every shipped language has the strings; tests pass with `vitest-axe`; the gates pass.

## 5. Ledger

| #   | Work item                                                                  | Skill                                           | Acceptance | Status |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------- | ---------- | ------ |
| 1   | API types; `user-settings` contracts + API; `useSignInClinic` hook         | `fe-resource-crud`, `fe-test-generation`        | F-2        | done   |
| 2   | Settings › Account "Clinic at sign-in" card                                | `shadcn`, `fe-e2e-testids`, `fe-i18n-constants` | F-1, F-2   | done   |
| 3   | Account menu "Opens at sign-in" submenu + "Default" label in Switch clinic | `shadcn`, `fe-e2e-testids`, `fe-i18n-constants` | F-1 – F-3  | done   |
| 4   | Every language, docs, recordings, gates                                    | `fe-kickoff-iteration` (verify)                 | F-4, F-5   | done   |
