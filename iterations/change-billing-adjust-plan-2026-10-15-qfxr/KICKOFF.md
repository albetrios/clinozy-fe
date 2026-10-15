# KICKOFF — change-billing-adjust-plan-2026-10-15-qfxr

> The plan and the ordered ledger for a small iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `change-billing-adjust-plan-2026-10-15-qfxr`                                         |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D3](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot                                         |
| Intake hash       | `0b692fa1b659` (gate passed 2026-10-15)                                              |
| Schema-routes     | — (no entity or route changes)                                                       |
| Sources           | `intake-files/BRIEF.md`; the current code (rounds one and two on this branch)        |
| Date              | 2026-10-15                                                                           |
| Evidence notation | `BRIEF.md` §n in `intake-files/`, `src/…` in the code                                |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing                                                    |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — Billing as easy as Claude's: one plan row with "Adjust plan", one notice, then payment and invoices.
2. **D2** — A new iteration: round two is `done`, which moves only to `frozen`.
3. **D3** — Baseline `none`, brief, clinozy-fe only, `feat/plan-comparison`; the screenshot stays out.
4. **D4** — The plan header: mark, name, price and seats on one line, one button by plan and role.
5. **D5** — The notice: renews / will be canceled + Resubscribe / trial / past due / incomplete.
6. **D6** — Cancellation only while the plan renews.
7. **D7** — Invoices: Date, Total, Status, "Download PDF" or "View invoice".
8. **D8** — The status pill only when something needs attention.
9. **D9** — Payment methods unchanged.
10. **D10** — Evidence in ladder order: Free → Starter → Growth, then a plan set to end.
11. **D11** — Approved on the user's instruction; reviewed with the build.

## 3. Foundation (before any screen)

### 3.1 Theme

No token added. The notice is the `bg-muted/40` strip with a hairline (`border rounded-xl`), as
Settings' other inline notes; the status pill keeps round two's tones.

### 3.2 Shell

n/a.

### 3.3 Stores

None.

### 3.4 Icons

`Calendar` and `TriangleAlert` from `@/shared/icons/index.ts` (both in the registry); the plan
marks as round two.

## 4. Route / island map

No route, island, manifest or registration changes.

| Unit                                                                  | Kind          | Change                                                                |
| --------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------- |
| `…/BillingPlanComparison/BillingCurrentPlan.tsx`                      | unit file     | the one-row plan header with its button                               |
| `…/BillingPlanComparison/BillingSubscriptionNotice.tsx`               | new unit file | the notice and "Resubscribe"                                          |
| `…/account/AccountBillingPanel.tsx`                                   | panel         | header → notice → payment → payment methods → invoices → cancellation |
| `…/account/BillingCancellationSection/BillingCancellationSection.tsx` | unit file     | renders only while the plan renews                                    |
| `…/account/BillingInvoicesTable/BillingInvoicesTable.tsx`             | unit file     | no Due column; "Download PDF" / "View invoice"                        |
| `src/locales/*/app.json` › `billingPlans`, `settings.json` (invoices) | copy          | new keys in 11 locales                                                |
| `tests/e2e/billing.e2e.test.ts`                                       | E2E           | the header button opens the picker                                    |

## 5. State management map

| Surface     | Server state                         | Client state | URL state | Form state |
| ----------- | ------------------------------------ | ------------ | --------- | ---------- |
| Plan header | `useSubscription`, `useBillingPlans` | —            | —         | —          |
| Notice      | the same; `useResumeSubscription`    | —            | —         | —          |
| Invoices    | `useBillingInvoices`                 | —            | —         | —          |

## 6. Per-screen build notes

### 6.1 Billing — `frontend-design`, `web-design-guidelines`, `fe-e2e-testids`

```text
[◎]  Growth plan                                           [ Adjust plan ]
     $30 / month · 9 of 15 seats used
┌──────────────────────────────────────────────────────────────────────────┐
│ 📅 Your plan renews on Nov 14, 2026.                                      │
│    — or — Your subscription will be canceled on Nov 14, 2026. [Resubscribe]│
└──────────────────────────────────────────────────────────────────────────┘
Payment methods                                           [ Add payment method ]
Invoices   Date · Total · Status · Download PDF
Cancellation (renewing only)                              [ Cancel at period end ]
```

The header sits flat at the top of the panel, as Claude's does; the sections under it keep the
Settings cards.

## 7. Deviations

### 7.1 Brief over the code

Round two's "Your plan" card (eyebrow, big price, seat meter, includes, two buttons) and the
Cancellation card's "Resume" give way to the header and the notice.

### 7.2 Project rules over the brief

- Copy in `app` (lazy) where new; the invoice action labels live with the invoices in `settings`.
- No "Update" on a card (D9).

### 7.3 Standing deviations touched

None — from scratch.

## 8. Verification

By Intake mode `brief`: every `BRIEF.md` acceptance criterion, proved by the colocated tests, the
billing E2E spec on the live stack, and screenshots + recordings at 1440 and 375, light and dark,
in ladder order (D10); then the static gates and the pre-push hook (build, the full suite,
SonarQube).

## 9. The route — the ordered ledger

| #   | Work item                                                                              | Kind       | Depends on | Skill/driver                           | Acceptance                              | Assignee | Status             |
| --- | -------------------------------------------------------------------------------------- | ---------- | ---------- | -------------------------------------- | --------------------------------------- | -------- | ------------------ |
| L-1 | Copy: header buttons, the plan line, the notices, invoice actions in 11 locales        | copy       | —          | fe-i18n-constants                      | `validate:i18n`, `validate:i18n-parity` | Claude   | done → AS-BUILT #1 |
| L-2 | The plan header (one row, one button by plan and role, the pill only when needed)      | structural | L-1        | frontend-design · fe-e2e-testids       | header tests                            | Claude   | done → AS-BUILT #2 |
| L-3 | The notice and "Resubscribe"                                                           | structural | L-1        | frontend-design · fe-http-forms-errors | notice tests                            | Claude   | done → AS-BUILT #3 |
| L-4 | The panel's order; Cancellation only while renewing                                    | structural | L-2, L-3   | fe-code-smells-best-practices          | panel + cancellation tests              | Claude   | done → AS-BUILT #4 |
| L-5 | Invoices: no Due column; "Download PDF" / "View invoice"                               | styling    | L-1        | fe-code-structure                      | invoices tests                          | Claude   | done → AS-BUILT #5 |
| L-6 | Tests: unit, component and the billing E2E spec                                        | verify     | L-2–L-5    | fe-test-generation · fe-playwright-e2e | suites pass                             | Claude   | done → AS-BUILT #6 |
| L-7 | Verify in the running app: screenshots and recordings in ladder order; the review page | verify     | L-6        | fe-kickoff-iteration                   | every §8 criterion shown                | Claude   | done → AS-BUILT #7 |
| L-8 | Gates: static gates, pre-push (build, full suite, SonarQube)                           | gate       | L-7        | fe-before-commit-guard                 | green                                   | Claude   | done → AS-BUILT #8 |
| L-9 | Close: `AS-BUILT.md`, Status `done`                                                    | verify     | L-8        | fe-kickoff-iteration                   | README Status `done`                    | Claude   | done → AS-BUILT #9 |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                    | In plan at     |
| ---------------------- | ----------- | ---------- | ----------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | four changes, the rules, eight criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact                | Brief says                          | Code before says                                               | Winner | Action   |
| --- | ------------------- | ----------------------------------- | -------------------------------------------------------------- | ------ | -------- |
| R1  | the plan at the top | one row, one button                 | an eight-part card with two buttons (`BillingCurrentPlan.tsx`) | brief  | L-2      |
| R2  | renewal / end       | one notice, "Resubscribe" beside it | the seat line's "renews …"; "Resume" in the Cancellation card  | brief  | L-3, L-4 |
| R3  | invoices            | Date, Total, Status, Download PDF   | Date, Due, Total, Status, View invoice                         | brief  | L-5      |
