# The shared layer and auth — clinozy-fe

Claude Code loads this file when it works in `src/shared/`. It holds sections moved out of the root [`CLAUDE.md`](../../CLAUDE.md), which keeps a pointer to each; the root rules apply here too.

## Shared Layer

```text
src/shared/
├── components/
│   ├── ui/                          # shadcn/ui primitives — FLAT (button.tsx, card.tsx, ...)
│   └── <Name>/                      # cross-page components — folder-per-unit
├── forms/<Name>/                    # cross-page forms — folder-per-unit
├── hooks/
│   ├── use<X>/                      # cross-page custom hooks — folder-per-unit
│   └── useList/, useOne/, useCreate/, useUpdate/, useDelete/   # standard CRUD hooks
├── layouts/<Name>/                  # AuthLayout, AppLayout, PublicLayout
├── api/                             # cross-page API helpers (auth, organization, billing, mfa,
│                                    #   passkeys, sessions, webhooks, notifications) — plain modules
│   └── app/                         # the clinic rooms' contracts + fetchers (clinozy-be /api/v1/app/*)
├── app/                             # the clinic rooms' shared layer (sections, tones, keys) — not src/app/;
│                                    #   `app` is the rooms' code name everywhere (fe-file-structure.mdc)
├── auth/                            # auth runtime (token, refresh-timer, idle-timeout, service, captcha)
├── tenancy/                         # URL-driven org context, membership, resolver, deployment-mode
├── icons/                           # icon registry (import from @/shared/icons, never lucide-react)
├── analytics/  billing/  notifications/  notify/  theme/  errors/   # cross-page feature areas
└── store/                           # global Zustand
    ├── useAuthStore/
    ├── useOrganizationStore/
    ├── useThemeStore/
    ├── useUIStore/
    ├── useOnboardingStore/
    ├── useConsentStore/
    └── useLocaleStore/
```

### Promotion ladder

Everything starts colocated with its page and climbs exactly one rung per force:

```text
ONE page                            → inside that page
page + its OWN nested children      → pages/<parent>/shared/   (family-shared)
DIFFERENT families, or any
src/shared component needs it       → src/shared/              (root shared)
platform-level                      → src/core/ or src/lib/
```

Family-shared is importable by the parent island and its descendants only — never by sibling families. Full rules: `agent-os/rules/fe-file-structure.mdc` → Promotion ladder.

## Auth & Security

- Access token stored in memory only (module closure in `shared/auth/token.ts`).
- Refresh token is an HttpOnly cookie (set by backend).
- Never store tokens in localStorage or sessionStorage.
- **One refresh path:** `refreshAccessToken()` in `shared/auth/service.ts` is the ONLY code
  allowed to call `/auth/refresh` — a module-level single-flight dedupes concurrent callers
  (proactive timer, 401 interceptor) and a `navigator.locks` Web Lock (`clinozy-auth:refresh`)
  serializes tabs. Never add a second refresh call: the backend rotates refresh sessions
  with reuse-detection, so parallel refreshes kill the session.
- **Ending a session is a server-side act.** `logout({ reason })` revokes (`POST /auth/logout`) and THEN clears locally; it is the ONE way to end a live session — user menu, command palette, **the idle-timeout dialog (button and deadline) and the absolute session cap**. `forceLogout()` is **local only**: used alone on a live session it signs nobody out (the HttpOnly refresh cookie survives, `/login` silently refreshes, the guest guard bounces the user back in) — it is right only when the server session is already gone. A revoke that cannot reach the server (offline on wake) is finished at the next boot via a `clinozy:logout-pending` flag; a deliberate end also suppresses auto-Google sign-in. Details: `src/shared/auth/AUTH.OVERVIEW.md`.
- **The idle timer** (`shared/auth/idle-timeout.ts`) is deaf to activity in its own tab while the warning is up (a press on the dialog's own button IS `document` activity), measures idle time on the wall clock (sleep/throttling cannot stretch it), and shares activity across tabs.
- `assetsInlineLimit: 0` in Vite config for CSP compliance.
- CSP ships as a build-generated **header** (`dist/_headers`, authoritative) plus an
  `index.html` meta fallback, both from `lib/csp-api-origin.ts`; set `VITE_CSP_REPORT_URI`
  to collect violations. Cross-tab logout (`shared/auth/auth-channel.ts`) kills every open
  tab when a session dies. Full model + accepted risks: **docs/reference/security-model.md**.
