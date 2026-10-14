# feat-default-clinic-at-login-2026-10-14-cpjx — as built

What was actually built, ledger row by ledger row, against the approved plan in
[`KICKOFF.md`](KICKOFF.md). Started 2026-10-14. Baseline: `none` (D1).

## Rows

| #   | Ledger row | Planned                                                         | Actually built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Difference                                                                         | Why                                                                                                                      | Decision | Commit        |
| --- | ---------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- | ------------- |
| #1  | 1          | Record the flow before and after clinozy-be's change; F-1 – F-3 | Playwright (Chromium, 1440 × 900) against `pnpm dev` and clinozy-be's local stack, signed in as `demo@example.com` by email code. **Before** (clinozy-be at `main`): 1st, 2nd and 3rd sign-in all land on `/organization` ("Select organization"), even right after picking Ojas. **After** (clinozy-be on this branch): 1st sign-in → `/organization/ojas-dermatology-aesthetics/today` (newest clinic, no picker); switch to Demo Organization from the account menu; 2nd sign-in → `/organization/demo-org/today` (remembered); switch back; 3rd sign-in → Ojas. `organization-resolver.test.ts` + `OrganizationPickerPage.test.tsx` 38/38. Videos and screenshots are in the review artifact | the "after" script switches clinics through the account menu instead of the picker | with a clinic to open, sign-in no longer shows the picker, so a menu switch is what the remembering is demonstrated with | D4, D5   | (this commit) |
| #2  | 2          | `TENANCY.FLOWS.md` — `/` root resolution                        | `TENANCY.FLOWS.md` › `/` root resolution gains "Which org is active after a sign-in" (clinozy-be decides; last clinic → newest clinic → personal; nothing stored in the browser); `docs/reference/routing-and-tenancy.md` § 2 says the same                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `routing-and-tenancy.md` also updated                                              | it carries the same `/` description                                                                                      | D3       | (this commit) |

**Verified:** `organization-resolver.test.ts` and `OrganizationPickerPage.test.tsx` 38/38 ✓ ·
`pnpm docs:lint` ✓ · `pnpm sync:check` ✓. No source file changed, so the code gates have nothing new
to check.

**Found while recording (not a change):** driven from `http://127.0.0.1:5173`, a clinic switch whose
in-flight request still carried the retired token fell back to `POST /auth/refresh`, which clinozy-be
refused with `403` — `127.0.0.1:5173` is not in the local `ALLOWED_ORIGINS`
(`http://localhost:3000,http://localhost:5173`), so the app signed out. From `http://localhost:5173`
the same switch refreshes and stays signed in. Local configuration only; the recordings use
`localhost`.

## Revisions to upcoming rows

None.

## Summary

- **Built:** no frontend code — clinozy-be's login now names the clinic the person last switched to,
  and the existing `/` resolver lands it on the clinic's home (D3, D4).
- **Verified:** F-1 ✓ (after: three sign-ins, three clinic landings, the second on the clinic
  switched to), F-2 ✓ (before: three sign-ins, three pickers), F-3 ✓.
- **Planned, not built:** none. **Built, not planned:** the `routing-and-tenancy.md` line (#2).

## Standing deviations

None. This iteration has no design input.
