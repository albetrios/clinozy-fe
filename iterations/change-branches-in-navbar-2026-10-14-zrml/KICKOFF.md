# KICKOFF — change-branches-in-navbar-2026-10-14-zrml

> The plan and the ordered ledger for a small iteration from a written brief, from scratch
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Iteration         | `change-branches-in-navbar-2026-10-14-zrml`                                                                                                         |
| Mode              | initial — from scratch                                                                                                                              |
| Baseline          | `none` ([D4](plans/decisions.md))                                                                                                                   |
| Intake mode       | brief — `BRIEF.md` alone, the whole snapshot ([D5](plans/decisions.md))                                                                             |
| Intake hash       | `0f0e65789bf1` (gate passed 2026-10-14)                                                                                                             |
| Schema-routes     | — (no `schema-routes.md`: the brief names the one enum value it adds)                                                                               |
| Sources           | `intake-files/BRIEF.md` (the change), the current code of the parts it affects                                                                      |
| Date              | 2026-10-14                                                                                                                                          |
| Evidence notation | `BRIEF.md:<line>` in `intake-files/`, `src/…:<line>` in the code                                                                                    |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills)                                                                |
| Sibling           | `clinozy-be/iterations/change-branches-in-navbar-2026-10-14-zrml` — the `branches` section, its pins and its catalog row ([D1](plans/decisions.md)) |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — Branches is its own room and section in both repositories; codes unchanged.
2. **D2** — Pinned by default after Payments; saved pins are kept.
3. **D3** — Users loses its Branches tab; `/users/branches…` redirects.
4. **D4** — Baseline `none`.
5. **D5** — Intake mode `brief`.
6. **D6** — `feat/branches-in-navbar` in both repositories; pushed, no pull request yet.
7. **D7** — After Users in nav order; the 1–0 keys keep Today … Users.
8. **D8** — Tone `stone` (the design's eleventh section tone).
9. **D9** — Icon `Building`.
10. **D10** — `ENUM_AMENDMENTS` in the schema generator; `api:types` regenerated.
11. **D11** — Module `app-branches`.
12. **D12** — A `branches` namespace in 11 locales; the room also loads `users` for hours.
13. **D13** — `useRoleDirectory` promoted; team fixtures shared; the room's own test router.
14. **D14** — Test ids under `branches`; `branch-drawer` kept.
15. **D15** — The room toolbar draws its h1 divider only before views.
16. **D16** — The phone tab bar keeps four slots.
17. **D17** — Visual baselines recorded by the user.
18. **D18** — Approved by the user's request.

## 3. Foundation (before any screen)

### 3.1 Contract

- `Section` gains `branches` (after `users`) through `ENUM_AMENDMENTS` in
  `tooling/codegen/app-schema.mjs` → `src/shared/api/app/app-schema.ts`.
- `src/core/http/openapi-types.d.ts` regenerated from clinozy-be's OpenAPI document
  (`pinned_sections` accepts `branches`).
- `preferences-api.ts`: `API_PINNED_SECTIONS` gains it; `DEFAULT_APP_PREFERENCES.pinnedSections`
  ends with it.

### 3.2 Shell

The section maps gain the eleventh room: `APP_SECTION_ORDER`, `SECTION_TONES` (stone),
`APP_SECTION_ICONS` (Building), `APP_KEYS.sections.branches`, `APP_SECTION_ROUTES`,
`SECTION_ACTION_CODES` (`branch:read|create|update|delete`), `APP_MODULES` (`app-branches`). The
section bar, All sections, the phone sheet, ⌘K and the View-as pill read them — no shell component
changes.

### 3.3 Stores

None. Pins are server state (`usePreferences`, D32).

### 3.4 Icons

`Building` (already in the registry).

## 4. Route / island map

| Unit                                             | Kind                 | Change                                                                                |
| ------------------------------------------------ | -------------------- | ------------------------------------------------------------------------------------- |
| `/organization/$organizationSlug/branches`       | room (layout island) | moved from `users/branches/`; manifest `nav: { id: 'branches', section: 'branches' }` |
| `…/branches/create`, `…/branches/$branchId/edit` | dialog routes        | moved; `DIALOG_ROUTES.branchCreate` / `branchEdit`                                    |
| `…/users/branches/$`                             | redirect             | new: to the same place in the room, search and hash kept                              |
| `/organization/$organizationSlug/users`          | room                 | children `create`, `$userId`, `roles` (no `branches`)                                 |
| `src/lib/routes/branches-builders.ts`            | builders             | new: `organizationBranches`, `organizationBranchCreate`, `organizationBranchEdit`     |
| `src/shared/hooks/useRoleDirectory/`             | shared hook          | promoted from `users/shared/hooks/`                                                   |

## 5. State management map

| Surface           | Server state                        | Client state | URL state                     | Form state        |
| ----------------- | ----------------------------------- | ------------ | ----------------------------- | ----------------- |
| The header's pins | `usePreferences` (`pinnedSections`) | —            | —                             | —                 |
| The Branches room | unchanged (`useBranchRows`, …)      | —            | `?created`, the dialog routes | the branch drawer |

No rule is under pressure.

## 6. Per-screen build notes

### 6.1 The shell — `fe-routing-tenancy`, `fe-i18n-constants`

```text
DESKTOP — 1440 × 900 (a member with the starting pins)
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ [C] clinozy │ (⊙) │ Appointments  Leads  Patients  Payments  [Branches] │ 🔍 … │ ⌖ │ DU │
└──────────────────────────────────────────────────────────────────────────────────────┘
  All sections: Today … Offerings · Users "Team, roles & access" · Branches "Every branch: …"

PHONE — 390 × 844
  tab bar: Appointments · Leads · Patients · Payments · More   (four slots, D16)
  More → the sheet, Branches last, pinned
```

### 6.2 The Branches room — `fe-route-island`, `fe-component-promotion`

The page keeps its table, filters, row action, export and drawer. Its toolbar is the shared room
toolbar with no tabs: h1 "Branches" · Filters · "New branch" (D15: no divider after the h1). The
drawer's step tone follows the section (stone).

### 6.3 Users — `fe-route-island`

`UsersToolbar` has two tabs; the Roles & access matrix shows Branches as a section row after Users
(`roles-matrix.ts`: `branch` moves from a sub-row of `users` to a section row of `branches`).

### 6.4 Settings › Clinic — `fe-i18n-constants`

`UsersRoomLinkCard target="branches"` links to `/branches` with the section's tile (stone,
Building) and the test id `settings-branches-open-branches`; the body says "… in Branches".

## 7. Deviations

### 7.1 Brief over the code

From scratch there is no carried-forward spec: the brief is the design. The code's Users › Branches
tab (the launch's `users.md` › Branches) is moved, not redesigned.

### 7.2 Project rules over the brief

- Semantic tokens only (`TONE_CLASSES[SECTION_TONES.branches]`).
- Pages never import pages: the shared hook and fixtures move up the promotion ladder (D13).
- The frozen launch contract is never edited (D10).

## 8. Verification

By Intake mode `brief`: the `BRIEF.md` acceptance criteria, each with its proof.

| Criterion (`BRIEF.md`)                       | Proof                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Branches tab after Payments, opens the list  | screenshots 1440 light + dark; the recording; `usePreferences` / `preferences-api` tests           |
| All sections, phone sheet, ⌘K; pin and unpin | screenshots (popover, phone sheet); the recording; `access-api`, `app-sections`, `useAppNav` tests |
| Users shows Team and Roles & access only     | screenshot; `UsersToolbar` test                                                                    |
| Roles & access: Branches is its own row      | screenshot; `roles-matrix` tests                                                                   |
| `/users/branches…` lands in the room         | the live check (list, `create` with the drawer, `?created=today`); the recording                   |
| Settings › Clinic links to the room          | `UsersRoomLink`, `OrganizationClinicPanel` tests                                                   |
| clinozy-be accepts and pins `branches`       | the sibling iteration (migration, integration test); the live app's starting pins                  |
| light and dark, desktop and phone            | screenshots                                                                                        |
| gates                                        | `pnpm health`                                                                                      |

## 9. The route — the ordered ledger

| #   | Work item                                                                                                    | Kind       | Depends on | Skill/driver                             | Acceptance                          | Assignee | Status |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------- | ---------- | ---------------------------------------- | ----------------------------------- | -------- | ------ |
| L-1 | Contract: `ENUM_AMENDMENTS`, `app-schema.ts`, `api:types`, preferences pins                                  | global     | sibling    | fe-code-structure                        | `app:schema:check`, type-check      | Claude   | done   |
| L-2 | Shell maps: order, tone, icon, labels (11 locales), home route, access codes, module                         | global     | L-1        | fe-routing-tenancy · fe-i18n-constants   | §8 rows 1–2                         | Claude   | done   |
| L-3 | Move the island to `branches/`: manifests, routes, dialog routes, builders, redirect, namespace, test router | structural | L-2        | fe-route-island · fe-component-promotion | §8 rows 1, 5; `validate:structure`  | Claude   | done   |
| L-4 | Users: two tabs; the matrix's Branches row                                                                   | structural | L-3        | fe-route-island                          | §8 rows 3–4                         | Claude   | done   |
| L-5 | Settings › Clinic link, the toolbar divider                                                                  | styling    | L-3        | fe-i18n-constants · frontend-design      | §8 row 6                            | Claude   | done   |
| L-6 | Tests: unit, the e2e helpers and specs                                                                       | verify     | L-1–L-5    | fe-test-generation · fe-playwright-e2e   | the suites pass                     | Claude   | done   |
| L-7 | Docs: overviews, routes-and-ui, test-id inventory, routing, platform, env catalog, project tree              | copy       | L-1–L-6    | fe-documentation-maintenance             | `pnpm sync:check`, `pnpm docs:lint` | Claude   | done   |
| L-8 | Verify in the running app: screenshots and a recording, before and after                                     | verify     | L-1–L-7    | fe-kickoff-iteration                     | every §8 row proven                 | Claude   | done   |
| L-9 | Gates and close: `pnpm health`, `AS-BUILT.md`, Status `done`                                                 | gate       | L-8        | fe-before-commit-guard                   | README Status `done`                | Claude   | done   |

## Appendix A — Coverage matrix

| File (`intake-files/`) | Read fully? | Kind       | Facts it owns here                               | In plan at     |
| ---------------------- | ----------- | ---------- | ------------------------------------------------ | -------------- |
| `BRIEF.md`             | yes         | the change | six changes, rules, eight criteria, out of scope | §2, §6, §8, §9 |

## Appendix B — Reconciliation (BRIEF ↔ code)

| #   | Fact                 | Brief says                    | Code before says                                         | Winner | Action   |
| --- | -------------------- | ----------------------------- | -------------------------------------------------------- | ------ | -------- |
| R1  | where Branches lives | its own room in the navbar    | Users' third tab (`users/branches/`)                     | brief  | L-3, L-4 |
| R2  | the section list     | eleven, Branches after Users  | ten (`SECTION_VALUES`, the launch contract)              | brief  | L-1, L-2 |
| R3  | starting pins        | + Branches                    | Appointments · Leads · Patients · Payments               | brief  | L-1      |
| R4  | tone                 | stone (the design's eleventh) | every other tone taken; stone forbidden by the tone test | brief  | L-2 (D8) |
| R5  | old links            | redirect                      | `/users/branches…` would 404 once moved                  | brief  | L-3      |
