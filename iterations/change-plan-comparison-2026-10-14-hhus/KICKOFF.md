# KICKOFF — change-plan-comparison-2026-10-14-hhus

> The plan and the ordered ledger for a small iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                |
| ----------------- | ------------------------------------------------------------------------------------ |
| Iteration         | `change-plan-comparison-2026-10-14-hhus`                                             |
| Mode              | initial — from scratch                                                               |
| Baseline          | `none` ([D3](plans/decisions.md))                                                    |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot ([D4](plans/decisions.md))              |
| Intake hash       | `7a4a006ce781` (gate passed 2026-10-14)                                              |
| Schema-routes     | — (no `schema-routes.md`: no entity or route changes)                                |
| Sources           | `intake-files/BRIEF.md` (the change), the current code of the parts it affects       |
| Date              | 2026-10-14                                                                           |
| Evidence notation | `BRIEF.md:<line>` in `intake-files/`, `src/…:<line>` in the code                     |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills) |
| Sibling           | none — clinozy-be changes nothing ([D1](plans/decisions.md))                         |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — clinozy-fe only; the comparison reads what `GET /billing/plans` already sends.
2. **D2** — Type `change`, topic `plan-comparison`, branch `feat/plan-comparison`.
3. **D3** — Baseline `none`, from scratch.
4. **D4** — Intake mode `brief`.
5. **D5** — Claude's plan picker is the model: tiers that build on each other, one action each, a savings-aware cycle switch, a full table for the detail.
6. **D6** — Every card reads per month; yearly shows its monthly equivalent, the yearly total and "Save N%".
7. **D7** — No description → a tagline from the seat allowance; "Workspace billing plan." retired.
8. **D8** — A frontend feature catalog owns the known keys (`audit_log`, `sso`, `priority_support`); seats from `limits.seats`; unknown keys skipped.
9. **D9** — "Current plan" (disabled) · "Upgrade to …" (primary) · "Switch to …" (outline) · "Choose …" (no subscription).
10. **D10** — The cycle switch keeps its rule: managers, before a subscription.
11. **D11** — "Compare all features" is a disclosure in the Change plan card, closed by default.
12. **D12** — A container-query grid: 1 → 2 (`@lg`) → all in one row (`@4xl`, two to four plans).
13. **D13** — Approved on the user's build-now instruction; their review comes before the PR; `frozen` waits for it.

## 3. Foundation (before any screen)

### 3.1 Theme

No token is added or changed. Cards keep the settings card frame (`data-slot="card"`, hairline,
`rounded-xl`, `p-(--step-pad)`); ticks use `text-success`; the current plan keeps the ink edge
(`border-foreground ring-1 ring-foreground`, `src/shared/components/SettingsModal/account/AccountBillingPanel.tsx:173`)
and its table column a `bg-muted/50` tint. Chips are the existing `TonePill` (`sage` for savings,
`neutral` for "Current"). Dark mode, every preset and every theme axis follow.

### 3.2 Shell

n/a — the Settings hash modal and its panel shell are untouched.

### 3.3 Stores

None. The disclosure's open state is component `useState` (D11).

### 3.4 Icons

None new: `Check`, `Minus`, `ChevronDown` from `@/shared/icons/index.ts` (already exported,
`src/shared/icons/index.ts:139,142,198`).

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed.

| Unit                                                                                                  | Kind                          | Change                                                                                 |
| ----------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------- |
| `#settings/account/billing` — auth, org-scoped, plan changes need `subscription:manage` on a team org | settings hash panel           | unchanged URL and gate                                                                 |
| `src/shared/api/billing-contracts.ts` · `billing-api.ts`                                              | contract + mapper             | `BillingPlan.features` mapped from the wire (already parsed, then dropped)             |
| `src/shared/components/SettingsModal/account/BillingPlanComparison/`                                  | shared unit (folder-per-unit) | new: `plan-comparison.ts` (catalog + pure rules), the cards, the table, the grid       |
| `src/shared/components/SettingsModal/account/AccountBillingPanel.tsx`                                 | panel                         | the old `PlanCard` and its grid replaced by `BillingPlanComparison`; the switch's chip |
| `src/locales/*/settings.json` + `settings.constants.ts`                                               | copy                          | new `panels.billing.*` keys in all 11 locales                                          |

## 5. State management map

| Surface              | Server state                                     | Client state                                    | URL state | Form state |
| -------------------- | ------------------------------------------------ | ----------------------------------------------- | --------- | ---------- |
| The plan cards       | `useBillingPlans`, `useSubscription` (unchanged) | the chosen cycle + the pending plan (unchanged) | —         | —          |
| The comparison table | the same plans                                   | open / closed (`useState`)                      | —         | —          |

No rule is under pressure: plans stay in TanStack Query; nothing new is stored.

## 6. Per-screen build notes

### 6.1 The Change plan card — `frontend-design`, `web-design-guidelines`, `fe-i18n-constants`, `fe-e2e-testids`

```text
1440 — the settings panel (content ≈ 728px): 2 × 2
┌ Change plan ───────────────────────────────────────── [ Monthly | Yearly  Save up to 17% ] ┐
│ Compare plans and switch when your team is ready.                                          │
│ ┌ Free ─────────────────────────────┐  ┌ Starter ───────────────────────────┐             │
│ │ For one practitioner              │  │ For teams of up to 5               │             │
│ │ $0  / month                       │  │ $8.33 / month        [Save 17%]    │             │
│ │ Free for ever                     │  │ Billed yearly · $100 a year        │             │
│ │ [ Choose Free ]                   │  │ [ Choose Starter ]                 │             │
│ │ Includes:                         │  │ Everything in Free, plus:          │             │
│ │ ✓ 1 seat                          │  │ ✓ Up to 5 seats                    │             │
│ └───────────────────────────────────┘  │ ✓ Audit log                        │             │
│ ┌ Growth ───────────────────────────┐  └────────────────────────────────────┘             │
│ │ …                                 │  ┌ Pro ───────────────────────────────┐             │
│ │ Everything in Starter, plus:      │  │ Everything in Growth, plus:        │             │
│ │ ✓ Up to 15 seats                  │  │ ✓ Up to 25 seats ✓ SSO ✓ Priority  │             │
│ └───────────────────────────────────┘  └────────────────────────────────────┘             │
│ [ Compare all features ⌄ ]                                                                 │
│ ┌──────────────┬────────┬──────────┬─────────┬────────┐                                    │
│ │              │ Free   │ Starter  │ Growth  │ Pro    │  ← plan column headers (th scope=col)
│ │ PRICING      │        │          │         │        │                                    │
│ │ Monthly      │ $0     │ $10      │ $30     │ $99    │                                    │
│ │ Yearly       │ —      │ $100     │ $300    │ $990   │                                    │
│ │ TEAM         │        │          │         │        │                                    │
│ │ Seats        │ 1      │ 5        │ 15      │ 25     │                                    │
│ │ FEATURES     │        │          │         │        │                                    │
│ │ Audit log    │ –      │ ✓        │ ✓       │ ✓      │  ← row headers (th scope=row) + hint
│ │ SSO          │ –      │ –        │ –       │ ✓      │                                    │
│ │ Priority     │ –      │ –        │ –       │ ✓      │                                    │
│ └──────────────┴────────┴──────────┴─────────┴────────┘                                    │
└────────────────────────────────────────────────────────────────────────────────────────────┘

375 — cards stacked (1 column); the table scrolls sideways, the row-name column sticky at the inline start
```

- **Order** — cheapest monthly price first (ties keep the API order), `BRIEF.md:8`.
- **Card** — name (`text-field`, 600) and, at the inline end, "Current plan" when it is current;
  tagline (`text-xs` muted, D7); price row: the figure `text-2xl` 600 tabular, unit `/ month`
  `text-xs` muted, the `Save N%` chip (yearly only); the billing line `text-xs` muted; the action
  full width; a hairline; the checklist heading `text-xs` 500 ("Includes:" / "Everything in X,
  plus:") and its items `text-detail` with a `text-success` `Check`.
- **Highlights** — the first plan: its seats + every included capability. Each later plan: its
  seats when they beat the previous plan's (unlimited beats any number) + each capability whose
  value differs from the previous plan's and is not "not included". A plan that adds nothing lists
  "The same features, with more room" — never an empty list.
- **Price** — `formatCurrency(cents, currency, { minimumFractionDigits: 0 })` when the amount is
  whole, two digits otherwise; yearly equivalent `round(yearly ÷ 12)` cents.
- **Grid** — `@container` on the card body; `grid gap-3 @lg:grid-cols-2`, plus
  `@4xl:grid-cols-<n>` for 2–4 plans (D12).
- **Disclosure** — a ghost `Button` with `aria-expanded` + `aria-controls`, `ChevronDown` rotating
  180° (`transition-transform duration-150`, none under reduced motion); test id
  `plan-compare-toggle`; the table `plan-compare-table`.
- **Table** — `<table>` with `<caption class="sr-only">`; group rows (`th colSpan`, `text-xs`
  uppercase muted); row headers with the one-line hint under the label; the current column
  `bg-muted/50` and a "Current" chip in its header; a tick = `Check` + sr-only "Included", a dash =
  `Minus` + sr-only "Not included". Wrapper `overflow-x-auto`; the first column `sticky start-0
bg-card`.

### 6.2 The Monthly · Yearly switch — `frontend-design`

The Yearly segment carries a `TonePill tone="sage" size="sm"` "Save up to N%" when any plan saves
(N = the best saving, D6); hidden when none does. Rule unchanged (D10).

## 7. Deviations

### 7.1 Brief over the code

From scratch there is no carried-forward spec: the brief is the design. The previous grid (three
columns, identical tiles, mixed "/ mo" and "/ yr", every button primary) is replaced.

### 7.2 Project rules over the brief

- Claude's cards show the yearly total in the button area; here it sits on the billing line so the
  action stays one line in every locale.
- Every string is an i18n key in all 11 locales (`pnpm validate:i18n-parity`), the capability
  labels included — so an unknown key is skipped rather than shown raw (D8).
- Semantic tokens only; a named radius step; `rounded-full` chips carry `data-slot="pill"` through
  `TonePill` (`pnpm validate:tokens`, `pnpm validate:theme-axis`); logical CSS only
  (`pnpm validate:logical`).

### 7.3 Standing deviations touched

None — from scratch, no Baseline.

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof.

| Criterion (`BRIEF.md`)                                  | Proof                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| order + "Everything in X, plus:" (`:70–71`)             | `plan-comparison.test.ts` (sorting, highlights); `BillingPlanComparison` test; screenshots                                                                               |
| tagline from seats (`:72–73`)                           | `plan-comparison.test.ts`; `BillingPlanComparison` test; screenshots                                                                                                     |
| per-month figure, yearly line, savings (`:74–75`)       | `plan-comparison.test.ts` (savings); panel test (yearly view); screenshots monthly + yearly                                                                              |
| action labels, selection + payment unchanged (`:76–77`) | `AccountBillingPanel` tests (existing + upgrade/switch/current)                                                                                                          |
| the table, current marked, announced (`:78–79`)         | `BillingPlanComparison` test (roles, sr-only words); screenshot of the open table                                                                                        |
| 2 × 2 at 1440; phone stack + sideways table (`:80–81`)  | screenshots 1440 + 375; the grid classes                                                                                                                                 |
| light + dark, tokens, 11 locales (`:82`)                | screenshots light + dark; `pnpm validate:tokens`; `pnpm validate:i18n-parity`                                                                                            |
| gates (`:83`)                                           | `pnpm type-check`, `pnpm lint`, `pnpm validate:tokens`, `validate:theme-axis`, `validate:structure`, `validate:testids`, `validate:logical`, the colocated Vitest suites |

Then the close: `AS-BUILT.md` summary with its Standing deviations, `pnpm iteration:status
<iteration> done`; `frozen` in the last commit before the branch merges, after the user's
confirmation (D13).

## 9. The route — the ordered ledger

| #    | Work item                                                                                                  | Kind       | Depends on | Skill/driver                                             | Acceptance                            | Assignee | Status |
| ---- | ---------------------------------------------------------------------------------------------------------- | ---------- | ---------- | -------------------------------------------------------- | ------------------------------------- | -------- | ------ |
| L-1  | `BillingPlan.features` mapped from the wire                                                                | foundation | —          | fe-http-forms-errors · fe-test-generation                | `billing-api.test.ts`                 | Claude   | done   |
| L-2  | `plan-comparison.ts`: the feature catalog, ordering, savings, taglines, highlights, table rows             | foundation | L-1        | fe-code-structure · fe-test-generation                   | `plan-comparison.test.ts`             | Claude   | done   |
| L-3  | Copy: the new `panels.billing.*` keys in `settings.constants.ts` and all 11 locales                        | copy       | L-2        | fe-i18n-constants                                        | `pnpm validate:i18n-parity`; §8 row 7 | Claude   | done   |
| L-4  | The plan cards + the container grid (`BillingPlanComparison`, `BillingPlanCard`)                           | structural | L-2, L-3   | frontend-design · web-design-guidelines · fe-e2e-testids | §8 rows 1–4, 6                        | Claude   | done   |
| L-5  | The comparison table behind "Compare all features" (`BillingPlanTable`)                                    | structural | L-4        | frontend-design · web-design-guidelines                  | §8 rows 5–6                           | Claude   | done   |
| L-6  | `AccountBillingPanel`: the old grid out, the comparison in; the switch's "Save up to N%" chip              | styling    | L-4, L-5   | fe-code-smells-best-practices                            | the panel tests; §8 row 3             | Claude   | done   |
| L-7  | Tests: unit + component suites updated and added                                                           | verify     | L-1–L-6    | fe-test-generation                                       | the colocated suites pass             | Claude   | done   |
| L-8  | Docs: `frontend-platform.md` mention, the project tree                                                     | copy       | L-4–L-6    | fe-documentation-maintenance                             | `pnpm sync:check`                     | Claude   | done   |
| L-9  | Verify: the BRIEF criteria in the running app (screenshots 1440 + 375, light + dark, a video walk-through) | verify     | L-1–L-8    | fe-kickoff-iteration                                     | every §8 row proven                   | Claude   | done   |
| L-10 | Gates: type-check, lint, biome, the static design gates, Vitest                                            | gate       | L-9        | fe-before-commit-guard                                   | §8 last row                           | Claude   | done   |
| L-11 | Close: `AS-BUILT.md` (rows, summary, Standing deviations), Status `done`                                   | verify     | L-10       | fe-kickoff-iteration                                     | README Status `done`                  | Claude   | done   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                                | In plan at     |
| ---------------------- | ----------- | ---------- | ------------------------------------------------- | -------------- |
| `BRIEF.md`             | yes         | the change | five changes, rules, eight criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact              | Brief says                                                      | Code before says                                                                                                    | Winner | Action     |
| --- | ----------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| R1  | features          | a checklist and a table from the plan's capabilities (`:17–19`) | `features` parsed by `billingPlanWireSchema` and dropped by `toBillingPlan` (`src/shared/api/billing-api.ts:58–69`) | brief  | L-1, L-2   |
| R2  | tagline           | from the seat allowance when none (`:9–11`)                     | `plan.description ?? 'Workspace billing plan.'` (`AccountBillingPanel.tsx:183`)                                     | brief  | L-2, L-4   |
| R3  | price unit        | per month always (`:12–15`)                                     | `/ mo` or `/ yr` by the cycle (`AccountBillingPanel.tsx:48–62`)                                                     | brief  | L-2, L-4   |
| R4  | actions           | Current / Upgrade / Switch / Choose (`:20–23`)                  | a `TonePill` "Current plan"; "Switch to" or "Choose", all primary (`AccountBillingPanel.tsx:64–72,131–163`)         | brief  | L-4        |
| R5  | the switch's rule | unchanged (`:24–27`)                                            | managers, no subscription (`AccountBillingPanel.tsx:407–408`)                                                       | code   | kept (D10) |
| R6  | the grid          | 2 × 2 / all in a row (`:33–34`)                                 | `sm:grid-cols-3` (`AccountBillingPanel.tsx:412`)                                                                    | brief  | L-4 (D12)  |
| R7  | the payment step  | unchanged (`:59–60`)                                            | `handlePlanSelect` + `loadPaymentSetup` (`AccountBillingPanel.tsx:315–336`)                                         | code   | kept       |
