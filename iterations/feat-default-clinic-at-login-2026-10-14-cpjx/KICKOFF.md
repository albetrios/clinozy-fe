# Sign-in opens your last clinic — kickoff plan

> **Status: approved on 2026-10-14** under the user's instruction "please go ahead with your
> recommendation" (D6). Every decision is in [`plans/decisions.md`](plans/decisions.md).
> `fe-kickoff-iteration` builds the ledger in order (§ 6); what was built goes in `AS-BUILT.md`. The
> backend's half — where the default is remembered and restored — is clinozy-be's same-named
> iteration.

## 1. Header

| Field            | Value                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/feat-default-clinic-at-login-2026-10-14-cpjx/` · **initial** (type `feat`, Baseline `none`, D1)           |
| Intake           | none — the requirement is § 2 (D1)                                                                                    |
| Date             | 2026-10-14                                                                                                            |
| Branch           | `feat/default-clinic-at-login` (D2)                                                                                   |
| Planned by       | `fe-iteration-planning` (this file)                                                                                   |
| Built by         | `fe-kickoff-iteration`                                                                                                |
| Sibling          | clinozy-be `feat-default-clinic-at-login-2026-10-14-cpjx` — the remembered clinic and the new login default (DC4–DC7) |

## 2. The request

"After login every time it's asking for clinic selection — can we have default for user? Please go
ahead with your recommendation."

**What happens today.** The login token names the personal workspace (clinozy-be DC3), and
`resolveRootTarget` sends a personal workspace to the clinic picker (`/organization`, D44) — so every
sign-in stops at "Select organization", even right after the person picked a clinic.

**After.** Sign-in opens the clinic the person last worked in, on their role home (Today for most
roles). The picker appears only when there is no clinic to open.

**In scope:** verifying the real sign-in flow against the changed backend; the `/` resolution flow
doc (`src/shared/tenancy/TENANCY.FLOWS.md`).

**Out of scope:** frontend code (D4); an explicit "default clinic" control (clinozy-be DC11).

## 3. Locked decisions

| #   | Decision                                                                            |
| --- | ----------------------------------------------------------------------------------- |
| D3  | The backend remembers the clinic and mints the login token for it — not the browser |
| D4  | No frontend code change: the resolver already lands an active clinic on its home    |
| D5  | Verified in the real app on the local stack, recorded before and after              |

## 4. Surfaces

| Surface           | Where                                         | Change                                                      |
| ----------------- | --------------------------------------------- | ----------------------------------------------------------- |
| `/` resolution    | `src/shared/tenancy/organization-resolver.ts` | none — reads the active organization from `me/context`      |
| The clinic picker | `src/pages/organization/`                     | none — now reached only when there is no clinic to open     |
| The flow doc      | `src/shared/tenancy/TENANCY.FLOWS.md`         | the active team clinic at login is the one last switched to |

## 5. Acceptance

- **F-1** Sign in → the picker (first time, with a personal workspace) or a clinic; pick Ojas; sign
  out; sign in again → lands on `/organization/ojas-dermatology-aesthetics/today` with no picker.
  A third sign-in lands there too.
- **F-2** Before the backend change the same script lands on the picker on every sign-in (the
  recorded baseline).
- **F-3** `organization-resolver.test.ts` and `OrganizationPickerPage.test.tsx` still pass.

## 6. Ledger

| #   | Work item                                                             | Skill                           | Acceptance | Status |
| --- | --------------------------------------------------------------------- | ------------------------------- | ---------- | ------ |
| 1   | Record the flow before and after clinozy-be's change; check F-1 – F-3 | `fe-kickoff-iteration` (verify) | F-1 – F-3  | done   |
| 2   | `TENANCY.FLOWS.md` — `/` root resolution names the remembered clinic  | `fe-documentation-maintenance`  | —          | done   |
