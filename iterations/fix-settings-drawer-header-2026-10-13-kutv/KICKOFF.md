# KICKOFF — fix-settings-drawer-header-2026-10-13-kutv

> The plan and the ordered ledger for a small, incremental fix from a written brief
> (`intake-files/BRIEF.md`). Frozen at approval: afterwards only the ledger's Status column and
> `revised → AS-BUILT #n` markers change.

## 1. Header

| Field             | Value                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Iteration         | `fix-settings-drawer-header-2026-10-13-kutv`                                                              |
| Mode              | incremental                                                                                               |
| Baseline          | `launch-2026-09-30-jxmr` ([D2](plans/decisions.md))                                                       |
| Intake mode       | brief — `BRIEF.md` received, 22 files carried forward from the Baseline                                   |
| Intake hash       | `3c093f2c6cdc` (gate passed 2026-10-13 with `--baseline`; Baseline `036cbb592ac5` unchanged)              |
| Schema-routes     | unchanged from the Baseline — no entity, field, route or operation in the delta                           |
| Sources           | `intake-files/BRIEF.md` (the change), the carried-forward specs it touches, the current code              |
| Date              | 2026-10-13                                                                                                |
| Evidence notation | `BRIEF.md:<section>`, `<spec>.md:<line>` in `intake-files/`, `src/…:<line>` in the code today             |
| Plans with        | `fe-iteration-planning`; builds with `fe-kickoff-iteration` (rows name their skills)                      |
| Sibling           | none — clinozy-fe only ([D4](plans/decisions.md)); no backend route, table, job, seed or permission moves |

## 2. Locked decisions

Every decision is a row in [plans/decisions.md](plans/decisions.md).

1. **D1** — Delegated end to end: plan, approve, build and close; push the branch; no pull request until the user confirms.
2. **D2** — Baseline `launch-2026-09-30-jxmr`, the only iteration with a complete intake.
3. **D3** — Intake mode `brief`.
4. **D4** — Branch `fix/settings-drawer-header`, clinozy-fe only.
5. **D5** — At close the folder keeps only this fix's own files; the copied launch files go.
6. **D6** — The loading stand-in draws the section's own head row, from one source the section also reads.
7. **D7** — The stand-in's title is the section's heading, not its nav label.
8. **D8** — Integrations' sub line is chosen by one shared `webhook:read` check, in the stand-in and the section.
9. **D9** — Profile's stand-in carries the completeness pill the section opens with.
10. **D10** — Approved by delegation on 2026-10-13.
11. **D11** — Built on the launch's merged code although its README still reads `implementing`.
12. **D12** — The iteration ends at `done`; `frozen` waits for the user's go-ahead on the pull request.

## 3. Foundation (before any screen)

- **Theme preset** — n/a: no token, preset or colour changes; the four registration points are untouched.
- **Shell** — n/a: the clinic shell and the Settings drawer's frame (`RecordDrawer`, the rail, the
  phone section switch) are unchanged. No platform surface moves, so the relocation table is n/a.
- **Stores** — n/a: nothing new is stored. The stand-in reads the auth store's `user` and the
  organization store's permission set, both already read by the drawer.
- **Icons** — n/a: the head row's tile keeps each section's nav icon.

## 4. Route / island map

No route, island, manifest or registration is added, moved or removed. Settings stays the
`#settings/<scope>/<section>` hash modal.

| Unit                                                                               | Kind                     | Change                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------- |
| `src/shared/components/SettingsModal/settings.constants.ts`                        | constants                | NEW `SETTINGS_SECTION_HEADING_KEYS` — each section's title and sub-line keys |
| `src/shared/components/SettingsModal/settings-permissions.ts`                      | access                   | NEW `INTEGRATIONS_WEBHOOKS_CHECK` — the one `webhook:read` check (D8)        |
| `src/shared/components/SettingsModal/SettingsPanelShell.tsx`                       | shared unit              | NEW `SettingsSectionHeader` — `SectionHeader` with the section's own copy    |
| `src/shared/components/SettingsModal/SettingsModal.tsx` (`SettingsContentLoading`) | the drawer's stand-in    | draws `SettingsSectionHeader` for the active section                         |
| the ten section panels + `UsersRoomLink.tsx` (`account/`, `organization/`)         | settings sections (auth) | draw `SettingsSectionHeader` instead of passing their own title and sub line |

## 5. State management map

| Surface             | Server state | Client state                                                                   | URL state                     | Form state                                    |
| ------------------- | ------------ | ------------------------------------------------------------------------------ | ----------------------------- | --------------------------------------------- |
| Section head row    | —            | reads `useAuthStore.user` (Profile's pill) and the permission set via `useCan` | the active section (the hash) | —                                             |
| Profile's live pill | —            | —                                                                              | —                             | the panel's own form values, passed as `meta` |

No rule is under pressure: nothing new is stored, no API data is copied into a store.

## 6. Per-screen build notes

### 6.1 The Settings drawer's head row (shell › Settings) — `fe-code-structure`, `fe-test-generation`

**Cause**, read in the code: while a section's chunk loads (`Suspense` in `ActivePanel`,
`SettingsModal.tsx:382–401`) — and while me/context or the permission set is still answering
(`contextReady` false, `SettingsModal.tsx:294–301`) — the pane draws `SettingsContentLoading`, whose
head row is `<SectionHeader title={sectionLabel} />` (`SettingsModal.tsx:372`): the **nav label**
only. The section, once loaded, draws `SectionHeader` with its own heading **and** its sub line
(e.g. `AccountSessionsPanel.tsx:65`). So the header gains a line (13px × 1.4 + 2px gap ≈ 20px) and
everything under it moves down; on Organization › General the title also changes ("General" →
"Organization · General"); on a phone, Profile's completeness pill adds a third line
(`SettingsPanelShell.tsx:69`, `max-sm:basis-full`).

```text
BEFORE — the stand-in, then the section a beat later
  ┌─ head row ─────────────────────────────┐      ┌─ head row ─────────────────────────────┐
  │ [▣] General                             │  ──► │ [▣] Organization · General             │
  └─────────────────────────────────────────┘      │     Identity for your organization …   │  ← a new line
  ░░░░░░░░░░░░ skeleton ░░░░░░░░░░░░░░░░░░         └─────────────────────────────────────────┘
                                                    content (pushed down ≈ 20px)

AFTER — one head row from the first frame
  ┌─ head row ─────────────────────────────┐      ┌─ head row ─────────────────────────────┐
  │ [▣] Organization · General             │  ──► │ [▣] Organization · General             │  identical:
  │     Identity for your organization …   │      │     Identity for your organization …   │  only the body
  └─────────────────────────────────────────┘      └─────────────────────────────────────────┘  below swaps
  ░░░░░░░░░░░░ skeleton ░░░░░░░░░░░░░░░░░░          content

ONE SOURCE
  SETTINGS_SECTION_HEADING_KEYS[section] ─┐
  INTEGRATIONS_WEBHOOKS_CHECK (useCan) ───┼─► useSettingsSectionHeading(section) ─► SettingsSectionHeader
  useAuthStore.user → completeness ───────┘          { title, description, meta }        │
                                                                        ┌─────────────────┴──────────────┐
                                                           SettingsContentLoading (stand-in)   every section panel
                                                                                                (Profile passes its live meta)
```

| Section       | Title key                    | Sub-line key                                                                   | Meta                                    |
| ------------- | ---------------------------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| profile       | `panels.profile.title`       | `panels.profile.description`                                                   | `panels.profile.completeness` (percent) |
| account       | `panels.account.title`       | `panels.account.description`                                                   | —                                       |
| security      | `security.heading`           | `security.description`                                                         | —                                       |
| notifications | `panels.notifications.title` | `panels.notifications.description`                                             | —                                       |
| sessions      | `panels.sessions.title`      | `panels.sessions.description`                                                  | —                                       |
| billing       | `panels.billing.title`       | `panels.billing.description`                                                   | —                                       |
| integrations  | `panels.integrations.title`  | `panels.integrations.description` / `…descriptionApiKeysOnly` without webhooks | —                                       |
| general       | `panels.general.title`       | `panels.general.description`                                                   | —                                       |
| members       | `panels.members.title`       | `panels.members.description`                                                   | —                                       |
| roles         | `panels.roles.title`         | `panels.roles.description`                                                     | —                                       |

- `SectionHeader` keeps its drawing and its props (title, description, meta) — it stays the one
  head-row drawing; `SettingsSectionHeader` only binds a section's copy to it.
- Members and Roles draw the same header whether they manage in place or point to the Users room
  (`UsersRoomLink`), as today.
- The skeleton under the head row, its accessible name (the nav label) and the polite `output`
  announcing the section are unchanged (`SettingsModal.tsx:364–380`).
- **Timings:** none — nothing animates; the fix removes a change rather than timing one.
- **States:** loading (stand-in) · loaded (section) — one head row in both; the section's error
  boundary keeps its own title (out of scope, `BRIEF.md` › Out of scope).
- **Test ids:** unchanged (`settings-section-tile`, `settings-content-loading`, every panel's id).
- **Strings:** no new key; every key above exists in all 11 locales.

## 7. Deviations

- **Brief over the carried-forward specs.** The design has no Settings drawer (`shell.md:61–62`); the
  launch kept the platform's Settings as a standing deviation, drawn as Users › Roles & access's
  head row (`users.md:61`). This fix keeps that deviation exactly as it is — it changes only when the
  head row's copy is known, not what it shows.
- **The design's loading state** (`_patterns.md` › States: "content is replaced in place by … bars")
  covers content, not the head row; the head row has always shown real text. Kept.
- **Baseline Standing deviations this change touches:**

| Item     | Design says                                                                             | Built as                                                                                    | Since                  | Decision        |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------- | --------------- |
| Settings | not designed — Status and Appearance are the only personal settings (`shell.md:61, 62`) | the platform's Settings as a 1040px record drawer in the design's language (unchanged here) | launch-2026-09-30-jxmr | kept, untouched |

## 8. Verification

- **The `BRIEF.md` acceptance criteria**, one by one: unit tests for the head row of every section
  in the stand-in; in the running app (signed in on :5173 against clinozy-be on :3000), the head
  row measured before and after a section's code arrives at 1440 × 900 and 375 × 667 (its height and
  text identical), General's title, Integrations' sub line and Profile's pill.
- **The full baseline set**, as far as this change reaches: every Settings section opens, switches
  and closes as before (the existing `SettingsModal` and panel suites).
- **Static gates:** `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure &&
pnpm validate:testids && pnpm type-check && pnpm lint`, plus `pnpm biome:check`, `pnpm tsdoc:check`
  and `pnpm knip`.
- **Tests:** the colocated Vitest suites of every touched unit, then the whole unit project.
- **Build:** `pnpm build` and `pnpm build:check` (the drawer is a lazy chunk; nothing may move onto
  the first-paint path).
- **Close:** `AS-BUILT.md` with its summary and Standing deviations (this fix's own — none), the
  folder trimmed to this fix's files (D5), `pnpm iteration:status <iteration> done`; `frozen` in the
  last commit before the merge, after the user's go-ahead (D12).

## 9. The route — the ordered ledger

| #   | Work item                                                                                                      | Kind       | Depends on | Skill/driver                              | Acceptance                                                                                         | Assignee | Status |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- | ------ |
| L-1 | `SETTINGS_SECTION_HEADING_KEYS` + `INTEGRATIONS_WEBHOOKS_CHECK`                                                | foundation | —          | `fe-i18n-constants`, `fe-code-structure`  | every section has a title and a sub-line key that resolves in `en`; type-check                     | Claude   | done   |
| L-2 | `SettingsSectionHeader` (+ its heading hook) in `SettingsPanelShell.tsx`                                       | structural | L-1        | `fe-code-structure`, `fe-test-generation` | unit tests: each section's copy; Integrations by access; Profile's pill, and `meta` overriding it  | Claude   | done   |
| L-3 | The stand-in (`SettingsContentLoading`) and every section panel + `UsersRoomLink` draw `SettingsSectionHeader` | structural | L-2        | `fe-code-structure`, `fe-test-generation` | `SettingsModal` test: the stand-in shows the section's title, sub line and pill; panel suites pass | Claude   | done   |
| L-4 | Docs: the Settings overview and design reference name the one head-row source                                  | copy       | L-3        | `fe-documentation-maintenance`            | `pnpm sync:check`; `pnpm docs:lint`                                                                | Claude   | done   |
| L-5 | Verify in the running app — the `BRIEF.md` criteria at 1440 × 900 and 375 × 667                                | verify     | L-3        | `fe-kickoff-iteration`                    | the head row's text and height identical before and after the section's code arrives               | Claude   | done   |
| L-6 | Gates — static, unit, build                                                                                    | gate       | L-4        | `fe-before-commit-guard`                  | §8 gates green                                                                                     | Claude   | done   |
| L-7 | Close — `AS-BUILT.md`, trim to this fix's files (D5), Status `done`                                            | verify     | L-5, L-6   | `fe-kickoff-iteration`                    | every row `done`; README Status `done`                                                             | Claude   | done   |
