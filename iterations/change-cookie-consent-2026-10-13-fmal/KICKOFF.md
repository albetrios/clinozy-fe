# Cookie consent the claude.com way — kickoff plan

> **Status: approved on 2026-10-13** under the user's instruction to plan both sides, take the
> recommendations and finalize and approve without stopping (D18). Every RED and AMBER is in
> [`plans/decisions.md`](plans/decisions.md) and can be reopened by moving the iteration back to
> `planning`. `fe-kickoff-iteration` builds §3–§6 in ledger order (§9); what was actually built goes
> in `AS-BUILT.md`. The backend's half is clinozy-be's same-named iteration.

## 1. Header

| Field            | Value                                                                                                                                                                                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Iteration · mode | `iterations/change-cookie-consent-2026-10-13-fmal/` · **incremental** (type `change`, Baseline `launch-2026-09-30-jxmr`, D17)                                                                                                                                                                                              |
| Intake           | mode `brief` · note "1 received (BRIEF.md) · 22 carried forward from launch-2026-09-30-jxmr" · placed 2026-10-13 · Intake hash `a8a0e5889cc1` · Schema-routes `5f90325208e1`                                                                                                                                               |
| Date             | 2026-10-13                                                                                                                                                                                                                                                                                                                 |
| Sources          | `intake-files/BRIEF.md` (the change list); the carried-forward launch drop (unchanged — `iteration:diff`: only `BRIEF.md` added); claude.com's cookie banner as read on 2026-10-13 from its public bundle (`ConsentContainer`, `ConsentBanner`, `ToggleSwitch`, the cookie helpers, the `ConsentBanner-module` stylesheet) |
| Evidence         | `BRIEF.md:n` = brief line n · `CC:` = claude.com's bundle (component or CSS rule named) · `path:n` = this repo                                                                                                                                                                                                             |
| Planned by       | `fe-iteration-planning` (this file)                                                                                                                                                                                                                                                                                        |
| Built by         | `fe-kickoff-iteration`, driving the skills named per ledger row (§9)                                                                                                                                                                                                                                                       |
| Sibling          | clinozy-be `change-cookie-consent-2026-10-13-fmal` — the account keeps a **receipt** (CC2), sign-out pinned (CC4); no API change                                                                                                                                                                                           |

## 2. Locked decisions

All in [`plans/decisions.md`](plans/decisions.md), locked with the approval on 2026-10-13.

| #   | Decision                                                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | The answer is the **browser's** (claude.com): sign-out never forgets it, sign-in never replaces it — supersedes launch D161 in part; `consent-account-sync.ts` goes                                       |
| D2  | One cookie `clinozy-consent-preferences` = `{analytics, version, decidedAt}`, one year, `Path=/`, `SameSite=Lax`, `Secure` on https, host-only; policy version **2**; the old localStorage answer removed |
| D3  | Categories **Necessary** (Required) and **Analytics**; no Marketing                                                                                                                                       |
| D4  | Everyone is asked; no region check                                                                                                                                                                        |
| D5  | Signed in, an answer is sent to the account as a **receipt** (never read back); signed out, nothing                                                                                                       |
| D6  | **GPC** = Reject all, never asked, Analytics locked off with a note                                                                                                                                       |
| D7  | **Escape** inside the card = Reject all (not document-wide)                                                                                                                                               |
| D8  | **Bottom-start** corner, ≤ 456px, 24px from the edges from `sm`, inset sheet on a phone, above the tab bar, mirrored under RTL                                                                            |
| D9  | The surface **follows the theme** (claude.com forces dark)                                                                                                                                                |
| D10 | Title in the heading font (claude.com: serif) — AMBER                                                                                                                                                     |
| D11 | claude.com's copy, adapted; the Privacy Policy link only when configured — AMBER                                                                                                                          |
| D12 | **Privacy choices**: a footer on the signed-out frame; Settings › Account › Privacy as the Customize rows                                                                                                 |
| D13 | Other tabs re-read the cookie when shown — AMBER                                                                                                                                                          |
| D14 | Customize moves focus to the Analytics switch; opening takes no focus — AMBER                                                                                                                             |
| D15 | claude.com's test ids; `consent-decline` / `consent-close` retired — AMBER                                                                                                                                |

## 3. Foundation (before any screen)

- **Theme preset** — n/a: no token, preset or contrast change. The card uses `bg-card`,
  `text-card-foreground`, `text-muted-foreground`, `bg-muted`, `border`, the floating lift
  (`data-slot="surface"` + `data-floating`) and a named radius step (`rounded-3xl` = claude.com's
  24px at the default Corner radius).
- **Shell** — n/a: the clinic shell is untouched. The signed-out frame (`PublicFrame`) gains a
  footer (§6.3) — nothing is relocated or removed; its main area keeps centring on the viewport.
- **Stores** — `useConsentStore` is rewritten (§6.1). Scope: this browser (a cookie), not the tab,
  not the account. Default: undecided (`preferences: null`) → every optional category off.
- **Icons** — none added. The card drops its `ShieldCheck` chip (claude.com's card has no icon); the
  export stays (used elsewhere).

## 4. Route / island map

No route, island or manifest changes. The surfaces:

| Surface                      | Where                                                                          | Access                                      | Kind                       |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------- | -------------------------- |
| The card                     | `src/shared/components/ConsentBanner/` (`ConsentBannerLazy` on the root route) | everyone                                    | non-modal floating surface |
| Privacy choices              | `src/shared/components/PublicFrame/PublicFrame.tsx` footer                     | signed out (every `PublicFrame` page)       | button                     |
| Settings › Account › Privacy | `src/shared/components/SettingsModal/account/AccountPrivacyCard/`              | signed in, `#settings/account/…` hash modal | card                       |

## 5. State management map

| Piece                                                                | Server state                              | Client state                                    | URL | Form                            |
| -------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------- | --- | ------------------------------- |
| The answer                                                           | none read (the receipt is write-only, D5) | `useConsentStore` ← the cookie                  | —   | —                               |
| Card view (summary / customize) and the Analytics switch before Save | —                                         | component `useState`                            | —   | — (two switches; no RHF needed) |
| "Reopened" (Privacy choices)                                         | —                                         | `useConsentStore.preferencesOpen`               | —   | —                               |
| GPC                                                                  | —                                         | read once from `navigator.globalPrivacyControl` | —   | —                               |

No server state in Zustand: the account's receipt is sent, never stored.

## 6. Per-surface build notes

### 6.1 The answer — `useConsentStore` on a cookie (CC-1)

```text
 cookie  clinozy-consent-preferences = {"analytics":true,"version":2,"decidedAt":"2026-10-13T…Z"}
         Max-Age=31536000 · Path=/ · SameSite=Lax · Secure (https)            ← CC: setCookie

 state   preferences : { analytics: boolean } | null     null = undecided (nothing optional runs)
         decidedAt   : string | null
         preferencesOpen : boolean                        Privacy choices reopened the card
 actions savePreferences(p) · openPreferences() · closePreferences() · reloadFromCookie()
 reads   hasAnalyticsConsent()  = !GPC && preferences?.analytics === true
         selectAnalyticsAllowed(state) · selectShouldAsk(state) = !GPC && preferences === null
         isGlobalPrivacyControlOn()
```

- A cookie that is missing, unreadable, or for another `version` → undecided. Its `Max-Age` is the
  one-year re-ask (D2).
- `ACCEPT_ALL_CONSENT_PREFERENCES` / `REJECT_ALL_CONSENT_PREFERENCES` (claude.com's names).
- At start the legacy `clinozy-consent` localStorage key is removed (D2).
- `followConsentFromOtherTabs()` re-reads the cookie on `visibilitychange` (D13), started from `main.tsx`.

### 6.2 The card (CC-4)

```text
 SUMMARY — sm and up (≤ 456px, bottom-start, 24px in)      SUMMARY — phone (inset sheet, above the tab bar)
 ┌──────────────────────────────────────────────┐         ┌──────────────────────────────────┐
 │ Cookie settings                              │         │ Cookie settings                  │
 │                                              │         │ We use cookies to deliver and    │
 │ We use cookies to deliver and improve our    │         │ improve our services and, if you │
 │ services and, if you agree, to analyze how   │         │ agree, to analyze how Clinozy is │
 │ Clinozy is used. You can read our Privacy    │         │ used. … Privacy Policy here.     │
 │ Policy here.                                 │         │ ┌─────────┐┌────────┐┌────────┐  │
 │ ┌──────────────────────────────────────────┐ │         │ │Customize││ Reject ││ Accept │  │
 │ │        Customize cookie settings         │ │         │ └─────────┘└────────┘└────────┘  │
 │ └──────────────────────────────────────────┘ │         └──────────────────────────────────┘
 │ ┌────────────────────┐ ┌───────────────────┐ │          ═══════════ tab bar ═══════════════
 │ │ Reject all cookies │ │Accept all cookies▓│ │
 │ └────────────────────┘ └───────────────────┘ │         CC: grid 2 columns, Customize spans 2;
 └──────────────────────────────────────────────┘             below 35.4em 3 columns, short labels

 CUSTOMIZE — the same card, body swapped (no new popup)
 ┌──────────────────────────────────────────────┐
 │ Cookie settings                              │
 │ Cookies let us tell you apart from other     │
 │ people, keep you signed in and secure, and — │
 │ if you allow it — show how features are used.│
 │ You can choose not to allow some types.      │
 │ ┌──────────────────────────────────────────┐ │
 │ │ Necessary                 Required  [●━] │ │  ← disabled, always on
 │ │ Enables security and basic functionality.│ │
 │ └──────────────────────────────────────────┘ │
 │ ┌──────────────────────────────────────────┐ │
 │ │ Analytics                      Off  [━○] │ │  ← focus lands here (D14)
 │ │ Enables product analytics and session    │ │
 │ │ recordings that show how features are    │ │
 │ │ used.                                    │ │
 │ └──────────────────────────────────────────┘ │
 │ ┌──────────────────────────────────────────┐ │
 │ │             Save preferences            ▓│ │
 │ └──────────────────────────────────────────┘ │
 └──────────────────────────────────────────────┘
```

- **Element:** a non-modal `<dialog open>` (claude.com: `<dialog>` + `show()`), labelled by its
  title and described by its paragraph; `data-slot="surface"` + `data-floating`; `data-testid="consent-banner"`.
- **Card:** `p-4 sm:p-8`, `rounded-3xl`, `border`, `bg-card` (D9); title `text-lg font-semibold`
  heading font, 16px below (D10); paragraph `text-sm text-muted-foreground`, 16px below; the link
  `underline` (claude.com: tertiary, primary on hover).
- **Buttons:** shadcn `Button` `size="sm"`: Customize `outline`, Reject `outline`, Accept `default`;
  long label from `sm`, short label below it (two spans, one hidden) — Reject and Accept equal width.
  Grid: `grid-cols-3` below `sm` (one row), `sm:grid-cols-2` with Customize `sm:col-span-2`.
- **Customize rows:** `bg-muted rounded-lg p-3`, title `text-sm font-medium` (a `<label>` for the
  switch), description `text-xs text-muted-foreground`, then status text (`Required` / `On` / `Off`)
  and shadcn `Switch`; 8px between rows, 32px before Save (claude.com: gap 8, margin 32); Save
  full-width `default`.
- **Keyboard:** `Escape` on the card → Reject all (D7). Customize → focus the Analytics switch (D14).
- **GPC (D6):** the card never opens on its own; opened from Privacy choices it shows the note
  `consent-gpc-note` and the Analytics switch locked off; Accept all is disabled.
- **After an answer:** `savePreferences`, close, then `recordConsentDecision` (lazy, §6.5).
- **Placement (D8):** `inset-x-3` + `bottom: calc(--floating-bottom-offset + safe-area + 0.75rem)`
  below `sm`; `sm:start-6 sm:bottom-[…+1.5rem] sm:w-[28.5rem]` (456px). The measured-height variable
  `--consent-card-height` stays (the page's last control can be scrolled clear of it on a phone).
- **Lazy:** `ConsentBannerLazy` keeps the card off the entry chunk; it mounts when
  `selectShouldAsk` or `preferencesOpen`.

### 6.3 Privacy choices on the signed-out frame (CC-5)

```text
 ┌ header: logo ······································· language · theme ┐
 │                                                                           │
 │                          ┌─────────────────┐                              │
 │                          │  sign-in card   │      main: centred           │
 │                          └─────────────────┘                              │
 │                                                                           │
 └ footer (same height as the header) ·········· Privacy choices ···········┘  ← new; opens the card
```

- The frame's bottom padding (`pb-13 md:pb-15`, "the header's height given back") becomes a footer
  of that height, so the card stays centred; a text button `Privacy choices` (`privacy-choices`)
  calls `openPreferences()`.

### 6.4 Settings › Account › Privacy (CC-6)

```text
 ┌ Privacy ─────────────────────────────────────────────────────────┐
 │ Cookie settings for this browser. Changes apply at once.          │
 │ ┌───────────────────────────────────────────────────────────────┐ │
 │ │ Necessary                                     Required  [●━]  │ │
 │ │ Enables security and basic functionality.                     │ │
 │ └───────────────────────────────────────────────────────────────┘ │
 │ ┌───────────────────────────────────────────────────────────────┐ │
 │ │ Analytics                                          On  [●━]   │ │
 │ │ Enables product analytics and session recordings …            │ │
 │ │ Saved on 13 Oct 2026                                          │ │
 │ └───────────────────────────────────────────────────────────────┘ │
 │ (GPC: "Your browser sends Global Privacy Control, so analytics    │
 │  stays off.")                                    Privacy policy ↗ │
 └───────────────────────────────────────────────────────────────────┘
```

- The same two rows as Customize; the switch saves at once (`savePreferences`) and records the
  decision (§6.5, `source: settings`). Test ids kept: `account-privacy`, `account-privacy-analytics`,
  `account-privacy-status`, `account-privacy-policy`; new `account-privacy-necessary`, `consent-gpc-note`.

### 6.5 Analytics follows the answer (CC-2)

```text
 person ─► card / Privacy choices / Settings
              │ savePreferences({ analytics })
              ▼
     useConsentStore ──► cookie clinozy-consent-preferences (1 year)
              │
              ├─► main.tsx      analytics on  → start / resume PostHog + web-vitals
              │                 analytics off → opt out + purge ph_* (cookies + storage)
              ├─► sentry.ts     replay on / off (profiling from the next load)
              └─► recordConsentDecision (lazy chunk)
                     on → one analytics_consent_decision event
                     signed in → PATCH /users/me/settings
                                 { analytics_consent, analytics_consent_version: 2 }
                                   └─► clinozy-be: receipt + audit row (CC2)

 sign-out ─► session ends · PostHog identity reset (posthog.ts, as today) · the cookie STAYS
 sign-in  ─► nothing about consent (no read, no copy — D1, D5)
```

- `consent-account-sync.ts` and its test are deleted; `main.tsx` starts `followConsentFromOtherTabs()` instead.
- `capture-consent-decision.ts` → `recordConsentDecision(decision, source)`: the event or the purge
  (as today) **plus** the receipt when a user is signed in (failures swallowed — consent never
  stands between a person and the app).

### 6.6 The answer's life (all surfaces)

```text
 boot ─► read cookie ──── standing (v2, < 1 year) ─────────────────────► answered · card hidden
           │ none / old version / unreadable
           ▼
        GPC on? ── yes ─► Reject all applies · card hidden · never asked
           │ no
           ▼
   ┌──────── SUMMARY ────────┐   Customize   ┌───── CUSTOMIZE ─────┐
   │ Reject all │ Accept all │ ────────────► │ switches · Save     │
   └─────┬──────┴─────┬──────┘               └─────────┬───────────┘
         │ (Escape)   │                                │
         └────────────┴───── savePreferences ──────────┴─► answered · card hidden
                                                               │
     Privacy choices (signed out) ─► reopen card ◄─────────────┤
     Settings › Privacy (signed in) ─► change at once ◄────────┘
     sign-out / sign-in ─► no change · 1 year later or policy v3 ─► asked again
```

## 7. Deviations

### 7.1 BRIEF over claude.com (adaptations the brief asks for)

| claude.com                                           | Built as                                     | Why |
| ---------------------------------------------------- | -------------------------------------------- | --- |
| Necessary · Analytics · Marketing                    | Necessary · Analytics                        | D3  |
| asked only in explicit-consent countries             | everyone asked                               | D4  |
| `.claude.com` domain cookie `{analytics, marketing}` | host-only `{analytics, version, decidedAt}`  | D2  |
| no account involvement                               | a write-only receipt while signed in         | D5  |
| footer "Privacy choices" on every page               | signed-out frame footer + Settings › Privacy | D12 |

### 7.2 Project rules over the source

| claude.com                     | Built as                         | Rule                                                          |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------- |
| bottom-right corner            | bottom-start, mirrored under RTL | the feedback trigger owns bottom-end; logical properties (D8) |
| forced dark card               | follows the theme                | semantic tokens + theme axis (D9)                             |
| serif headline                 | heading font                     | configured fonts (D10)                                        |
| custom toggle                  | shadcn `Switch`                  | shadcn primitives                                             |
| Escape anywhere                | Escape inside the card           | Escape closes the app's own surfaces (D7)                     |
| English strings                | i18n keys, 11 locales            | every string a key (D11)                                      |
| focus left on a removed button | focus to the Analytics switch    | web-design-guidelines (D14)                                   |

### 7.3 The Baseline's Standing deviations this change touches

| Item                | Design says                                        | Built as (Baseline)                                                                                                                                              | Since               | This iteration                                                                                                                                                                                                                                                         |
| ------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cookie consent card | Accept and Decline, the answer kept in the browser | a close button that declines; the answer is the person's (account, later wins at sign-in, forgotten at sign-out), six-month re-ask; Settings › Account › Privacy | launch (#108, D161) | **resolved and replaced**: the answer is the browser's again (as the design said) — the new deviation is the claude.com card itself (Customize, categories, Reject/Accept all, Privacy choices, GPC, a one-year cookie, the account receipt), carried in `AS-BUILT.md` |

Every other Standing deviation of the Baseline is untouched and carried forward.

## 8. Verification

- **By Intake mode (`brief`)** — every `BRIEF.md` acceptance criterion (`BRIEF.md:88–100`) checked
  per row; the surfaces it touches still match the carried-forward specs except where the brief
  changes them (only the signed-out frame gains a footer).
- **Static gates** — `pnpm validate:tokens && pnpm validate:theme-axis && pnpm validate:structure &&
pnpm validate:testids && pnpm type-check && pnpm lint`, plus `pnpm biome:check`,
  `pnpm sync:check`, `pnpm tsdoc:check`.
- **Colocated Vitest** per unit (store, card, lazy shell, frame, privacy card, record, Sentry,
  main-boot follow), the `ci-policy` seed test, the `security` project.
- **E2E** — `consent-card.e2e.test.ts` rewritten (claude.com flows, sign-out keeps the answer) and
  run against a local clinozy-be when it is up; the full baseline set when possible (a skipped run is
  recorded, never claimed).
- **Close** — `AS-BUILT.md` summary with the Standing deviations, `pnpm iteration:status <iteration>
done`; `frozen` in the last commit before the branch merges.

## 9. The route — the ordered ledger

| #    | Work item                                                                                                                                                                                    | Kind       | Depends on       | Skill/driver                                                      | Acceptance                                                                                                | Assignee | Status |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- | ------ |
| CC-1 | The answer on a cookie — `useConsentStore` rewritten (§6.1): per-category preferences, policy v2, one-year cookie, GPC, legacy key removed, other tabs                                       | global     | —                | fe-code-structure · fe-test-generation                            | store unit tests (read, write, version, unreadable, GPC, legacy removal, reload); `pnpm type-check`       | Claude   | done   |
| CC-2 | Analytics follows it (§6.5): `main.tsx`, `sentry.ts`, `posthog.ts`; `recordConsentDecision` with the receipt; `consent-account-sync.ts` deleted                                              | global     | CC-1             | fe-http-forms-errors · fe-test-generation                         | tests: receipt only when signed in, version 2; Sentry follows; nothing resets at sign-out (BRIEF:93, :97) | Claude   | done   |
| CC-3 | Copy — the card, Customize, Privacy choices, Settings rows, GPC note in 11 locales; retired keys removed                                                                                     | copy       | —                | fe-i18n-constants                                                 | `pnpm sync:check` (i18n); no raw strings (lint)                                                           | Claude   | done   |
| CC-4 | The card (§6.2): summary + customize, Escape, focus, GPC, placement, test ids                                                                                                                | structural | CC-1, CC-3       | fe-design-ditto (brief) · shadcn · web-design-guidelines          | BRIEF:88–92, :96, :99; component + lazy-shell tests with axe                                              | Claude   | done   |
| CC-5 | Privacy choices on the signed-out frame (§6.3)                                                                                                                                               | structural | CC-1, CC-3       | fe-design-ditto · fe-e2e-testids                                  | BRIEF:94; `PublicFrame` tests                                                                             | Claude   | done   |
| CC-6 | Settings › Account › Privacy as the Customize rows (§6.4)                                                                                                                                    | structural | CC-1, CC-2, CC-3 | fe-design-ditto · shadcn                                          | BRIEF:95–96; card tests with axe                                                                          | Claude   | done   |
| CC-7 | E2E seed as a cookie, `consent-card.e2e.test.ts` rewritten, the test-id inventory, docs (security model, PostHog, Sentry, testing, design, production readiness, platform), the project tree | gate       | CC-4, CC-5, CC-6 | fe-playwright-e2e · fe-e2e-testids · fe-documentation-maintenance | the seed policy test; `pnpm sync:check`; e2e against clinozy-be when up                                   | Claude   | done   |
| CC-8 | Verify and close: static gates, the full unit suite, `AS-BUILT.md` summary + Standing deviations, status `done`                                                                              | verify     | CC-1 – CC-7      | fe-kickoff-iteration › Close                                      | every gate in §8 green                                                                                    | Claude   | done   |
