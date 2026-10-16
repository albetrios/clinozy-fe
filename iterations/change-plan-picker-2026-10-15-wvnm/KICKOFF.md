# KICKOFF — change-plan-picker-2026-10-15-wvnm

> The plan and the ordered ledger for a small iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `change-plan-picker-2026-10-15-wvnm`                                                 |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D3](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot                                         |
| Intake hash       | `a2ebe21997e2` (gate passed 2026-10-15)                                              |
| Schema-routes     | — (no entity or route changes)                                                       |
| Sources           | `intake-files/BRIEF.md`; the current code (round one's build on this branch)         |
| Date              | 2026-10-15                                                                           |
| Evidence notation | `BRIEF.md:<line>` in `intake-files/`, `src/…:<line>` in the code                     |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing                                                    |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — Plans side by side with their features (claude.com) and confirms that show the change first.
2. **D2** — A new iteration: the first is `done`, which moves only to `frozen`.
3. **D3** — Baseline `none`, brief, clinozy-fe only, `feat/plan-comparison`.
4. **D4** — claude.com's anatomy: one row of plans, then "Compare features across plans".
5. **D5** — The picker is a stacked 1040px `RecordDrawer` over Settings; no URL.
6. **D6** — The confirm is the app's `ConfirmPanel`: from → to, prices, gains or losses, when, seats.
7. **D7** — Paid ↔ paid takes effect now, prorated on the next invoice; no amount shown.
8. **D8** — Free is the cheapest zero-price plan; current with no subscription; "Switch to Free" cancels at period end.
9. **D9** — A downgrade below the seats in use names the members who will be suspended.
10. **D10** — "Next step up" on the plan above the current; no "Most popular".
11. **D11** — Registry icons and room tones by rank.
12. **D12** — Approved on the user's instruction; reviewed with the build.

## 3. Foundation (before any screen)

### 3.1 Theme

No token added. Tier discs use `TONE_CLASSES[tone].surface` and `.dot`/ink from
`src/shared/app/app-tones.ts`; the current plan keeps the ink edge; "Next step up" is a `TonePill`
in the plan's tone; the seat meter is `ui/progress.tsx`.

### 3.2 Shell

n/a — Settings stays the hash modal; the picker stacks on it as its other child drawers do.

### 3.3 Stores

None: the picker's and the confirm's open state are `useState` in the Billing panel.

### 3.4 Icons

None new: `Sparkles`, `Users`, `Rocket`, `Building`, `Check`, `Minus`, `ArrowUpRight`, `ArrowDown`
from `@/shared/icons/index.ts`.

## 4. Route / island map

No route, island, manifest or registration changes.

| Unit                                                                                               | Kind          | Change                                                                  |
| -------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------- |
| `SettingsModal/account/AccountBillingPanel.tsx`                                                    | panel         | "Your plan" card; opens the picker and the confirm                      |
| `SettingsModal/account/BillingPlanComparison/BillingCurrentPlan.tsx`                               | new unit file | the "Your plan" card                                                    |
| `SettingsModal/account/BillingPlanComparison/BillingPlanPicker.tsx`                                | new unit file | the stacked drawer: head, switch, cards row, comparison                 |
| `SettingsModal/account/BillingPlanComparison/BillingPlanChangeConfirm.tsx`                         | new unit file | the confirm                                                             |
| `…/BillingPlanCard.tsx`, `BillingPlanTable.tsx`, `BillingPlanComparison.tsx`, `plan-comparison.ts` | unit files    | the Claude-style card, the sticky table head, the row, the change rules |
| `src/locales/*/app.json` › `billingPlans`                                                          | copy          | new keys in 11 locales                                                  |
| `tests/e2e/billing.e2e.test.ts`                                                                    | E2E           | the plans are in the picker now                                         |

## 5. State management map

| Surface     | Server state                                    | Client state                                         | URL state | Form state |
| ----------- | ----------------------------------------------- | ---------------------------------------------------- | --------- | ---------- |
| Your plan   | `useSubscription`, `useBillingPlans`            | —                                                    | —         | —          |
| The picker  | the same                                        | open, the chosen cycle (unchanged), the pending plan | —         | —          |
| The confirm | `useSelectBillingPlan`, `useCancelSubscription` | the target plan (null = closed)                      | —         | —          |

## 6. Per-screen build notes

### 6.1 Your plan — `frontend-design`, `fe-e2e-testids`

```text
┌ [◎] Starter                         ● active ┐   tone disc 40px, name 15px/600
│ For teams of up to 5                          │
│ $10 / month · billed monthly · renews 13 Nov  │
│ Seats  ███████░░░░  1 of 5                     │   ui/progress
│ ✓ Up to 5 seats  ✓ Audit log                  │   what it includes (whole list)
│ [ Compare plans ]  [ Upgrade to Growth ↗ ]    │
└───────────────────────────────────────────────┘
```

### 6.2 The picker — `frontend-design`, `web-design-guidelines`, `fe-e2e-testids`

```text
1040px stacked drawer · "Plans" · sub: "Every plan includes the whole clinic. Pick the size and controls you need."
            [ Monthly | Yearly  Save up to 17% ]          (before a subscription, managers)
┌ Free ─────────┐┌ Starter ──────┐┌ Growth ── Next ┐┌ Pro ──────────┐
│ ◎             ││ ◎   Current   ││ ◎  step up     ││ ◎             │
│ For one …     ││ For teams … 5 ││ For teams … 15 ││ For teams … 25│
│ $0 / month    ││ $10 / month   ││ $30 / month    ││ $99 / month   │
│ Free for ever ││ Billed monthly││ Billed monthly ││ Billed monthly│
│ [Switch to F.]││ [Current plan]││ [Upgrade to G.]││ [Upgrade to P]│
│ Includes:     ││ Everything in ││ Everything in  ││ Everything in │
│ ✓ 1 seat      ││ Free, plus: … ││ Starter, plus: ││ Growth, plus: │
└───────────────┘└───────────────┘└────────────────┘└───────────────┘
Compare features across plans
[ table: plan names head row sticky at the drawer's top while it scrolls ]
```

Grid: `grid gap-3 sm:grid-cols-2 lg:grid-cols-4` by plan count (the drawer is the viewport's width
on a phone and 1040px from `md`, so viewport breakpoints are right here); cards stretch to equal
height; the action pinned under the price so actions line up across cards.

### 6.3 The confirm — `frontend-design`, `fe-http-forms-errors`

`ConfirmPanel` with: title = the action ("Upgrade to Growth"); description = from → to chips;
body = price before → after (the subscription's cycle), "What you get" or "What you lose" (the
checklist difference), "When" (D7 / D8), the seat warning (D9); footer = "Keep Starter" (initial
focus) and the action button (busy while it runs; the panel's exits held).

## 7. Deviations

### 7.1 Brief over the code

Round one's in-panel grid and its "Compare all features" disclosure are replaced by the picker; the
summary card by "Your plan".

### 7.2 Project rules over the brief

- No proration amount (D7): the backend has none to give.
- Copy in `app` (lazy), icons from the registry, room tones, `ConfirmPanel`, `RecordDrawer` — the
  app's own parts.

### 7.3 Standing deviations touched

None — from scratch.

## 8. Verification

By Intake mode `brief`: every `BRIEF.md` acceptance criterion, proved by the colocated tests, the
billing E2E spec on the live stack, and screenshots + recordings at 1440 and 375, light and dark;
then `pnpm health`, the pre-push hook (build, the full suite, SonarQube) and `pnpm size` against
`main`.

## 9. The route — the ordered ledger

| #    | Work item                                                                                   | Kind       | Depends on | Skill/driver                            | Acceptance                              | Assignee | Status              |
| ---- | ------------------------------------------------------------------------------------------- | ---------- | ---------- | --------------------------------------- | --------------------------------------- | -------- | ------------------- |
| L-1  | Change rules in `plan-comparison.ts`: free plan, current/next plan, gains/losses, tier look | foundation | —          | fe-code-structure · fe-test-generation  | unit tests                              | Claude   | done → AS-BUILT #1  |
| L-2  | Copy: the new `app` › `billingPlans` keys in 11 locales                                     | copy       | L-1        | fe-i18n-constants                       | `validate:i18n`, `validate:i18n-parity` | Claude   | done → AS-BUILT #2  |
| L-3  | The Claude-style card (tone disc, badges, aligned action) and the sticky table head         | styling    | L-1, L-2   | frontend-design · web-design-guidelines | card + table tests                      | Claude   | done → AS-BUILT #3  |
| L-4  | The picker drawer: head, switch, one row, comparison                                        | structural | L-3        | frontend-design · fe-e2e-testids        | picker test; §8                         | Claude   | done → AS-BUILT #4  |
| L-5  | The confirm: upgrade, switch, first plan, to Free, seats                                    | structural | L-1, L-2   | frontend-design · fe-http-forms-errors  | confirm test; §8                        | Claude   | done → AS-BUILT #5  |
| L-6  | "Your plan" in the Billing panel; wiring the picker and the confirm                         | structural | L-4, L-5   | fe-code-smells-best-practices           | panel tests                             | Claude   | done → AS-BUILT #6  |
| L-7  | Tests: unit, component and the billing E2E spec                                             | verify     | L-1–L-6    | fe-test-generation · fe-playwright-e2e  | suites pass                             | Claude   | done → AS-BUILT #7  |
| L-8  | Verify in the running app: screenshots, recordings; the review page                         | verify     | L-7        | fe-kickoff-iteration                    | every §8 criterion shown                | Claude   | done → AS-BUILT #8  |
| L-9  | Gates: health, size against `main`, pre-push                                                | gate       | L-8        | fe-before-commit-guard                  | green                                   | Claude   | done → AS-BUILT #9  |
| L-10 | Close: `AS-BUILT.md`, Status `done`                                                         | verify     | L-9        | fe-kickoff-iteration                    | README Status `done`                    | Claude   | done → AS-BUILT #10 |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                   | In plan at     |
| ---------------------- | ----------- | ---------- | ---------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | three changes, the rules, ten criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact               | Brief says                          | Code before says                                                                         | Winner | Action   |
| --- | ------------------ | ----------------------------------- | ---------------------------------------------------------------------------------------- | ------ | -------- |
| R1  | where plans live   | a picker, one row (`BRIEF.md` §2)   | a 2 × 2 grid in the panel (`BillingPlanComparison.tsx`, `@lg:grid-cols-2`)               | brief  | L-4      |
| R2  | the table          | open under the cards, head sticky   | behind "Compare all features", closed (`BillingPlanComparison.tsx` `compareOpen`)        | brief  | L-3–L-4  |
| R3  | Free, unsubscribed | "Current plan", no button           | "Choose Free", which the backend refuses with a provider configured                      | brief  | L-1, L-3 |
| R4  | a change           | a confirm first                     | the button changes the plan at once (`AccountBillingPanel.tsx` `handlePlanSelect`)       | brief  | L-5–L-6  |
| R5  | the summary        | "Your plan" with seats and includes | a title, the seat line and the status pill (`AccountBillingPanel.tsx` `billing-summary`) | brief  | L-6      |
