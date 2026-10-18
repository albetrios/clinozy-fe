# CLAUDE.md — Clinozy Frontend Project Conventions

This document is the single source of truth for understanding and working in this codebase. Read it before making any changes.

Nested `CLAUDE.md` files hold the detail for the folder you work in — Claude Code loads one when it works there: [`src/pages/`](src/pages/CLAUDE.md) (routes, page islands) · [`src/shared/`](src/shared/CLAUDE.md) (the shared layer, auth) · [`src/core/`](src/core/CLAUDE.md) (HTTP, environment variables, new-deployment detection, PWA) · [`src/app/`](src/app/CLAUDE.md) (routing) · [`iterations/`](iterations/CLAUDE.md) (design iterations) · [`.github/`](.github/CLAUDE.md) (quality gates, merge policy, lockfile discipline, branch naming) · [`tests/`](tests/CLAUDE.md) (testing). Read the one for the area you change, even from elsewhere.

## Quick Start

```bash
pnpm install
pnpm dev          # Vite dev server on port 5173
pnpm build        # Production build — in a terminal, asks which .env.<environment> to build with (--env <environment> skips the question; --sentry also uploads source maps, off by default)
pnpm type-check   # Type check (no emit, tsconfig.app.json)
pnpm lint         # ESLint
pnpm biome:check  # Biome lint lane (lint-only; Prettier owns formatting)
pnpm health       # Full project health check (all phases)
pnpm health:fix   # Auto-fix + full health check
pnpm sync:check   # Deterministic docs↔code drift (structure, testids, i18n, tree, agent-os, identity)
pnpm rebrand "<Product>"  # Rename the product (dry run; --apply to write) — see new-project.md
pnpm quality      # health + local SonarQube gate (Docker)
```

**Quality gates, the merge policy and lockfile discipline:** [`.github/CLAUDE.md`](.github/CLAUDE.md). In short: never merge on red — no bypass, a flaky required check is re-run to green; a dependency change and its `pnpm-lock.yaml` are one commit (`pnpm run validate:lockfile`).

## Documentation

- **Engineering principles:** `agent-os/rules/fe-engineering-principles.mdc` (auto-applied in Cursor; the same rules bind every agent). First among them — **reuse before you create**: use the helper, hook, component, service or env var that already does the job, and create something new only when nothing fits; if an existing one is close but not right, improve it (or say in the PR why new is better) **in the same PR**, never leaving old and new side by side.
- **Index by use case:** docs/README.md
- **Code review (severity ladder, findings format):** REVIEW.md — every reviewer, `/fe-pre-merge-review` and `/fe-prod-readiness` report in it
- **Derive a NEW product from this repo:** docs/getting-started/new-project.md — fork path, `pnpm rebrand` (a **total** rename, prose included; `clinozy-be` and `CHANGELOG.md` excluded), `previousNames` guard, upstream sync
- **Local setup:** docs/getting-started/setup.md
- **Requirement intake (format, types, skills, rules):** docs/getting-started/requirement-intake.md — template: docs/getting-started/requirement-format.md, example: docs/getting-started/requirements/sample-requirement.md
- **Deploy / CI-CD:** docs/deployment/cicd-and-netlify.md, docs/deployment/deployment-and-pre-launch.md; **release + versioning:** docs/process/release-versioning.md
- **Path to production (gate):** docs/deployment/path-to-production.md
- **Netlify CLI setup:** docs/deployment/netlify-cli-setup.md
- **Credentials / env:** docs/integrations/credentials-and-env.md; **env runbook:** docs/deployment/runbooks/environment-variables.md; Sentry: docs/integrations/sentry-sourcemaps.md
- **Cursor ↔ backend API (MCP):** agent-os/docs/cursor-backend-mcp.md
- **Git workflow:** docs/process/trunk-based-workflow.md
- **Routing & tenancy (implemented spec):** docs/reference/routing-and-tenancy.md
- **SonarQube local quality gate:** docs/reference/quality/sonarqube-local.md
- **Design iterations (Claude Design → build):** iterations/README.md (rules + commands), docs/design-workflow/process/README.md (the two phases), docs/design-workflow/process/iteration-walkthrough.md (every step as a text diagram) — see **Design iterations** below
- **Reference:** docs/reference/tools-and-usage.md, docs/reference/routes-and-ui.md, docs/reference/frontend-platform.md (platform kernel), docs/reference/pwa-manifest-and-app-icon.md (PWA install surface), docs/reference/local-production-perf.md (build + preview perf), docs/reference/cross-browser-support.md (Chrome/Firefox/Safari), docs/reference/design.md (design language), docs/reference/theming.md, docs/reference/theme-axis-audit-playbook.md (axis audit procedure), docs/reference/dependency-upgrades.md, docs/reference/internationalization.md, docs/reference/scheduled-jobs.md (scheduled + periodic jobs registry)

## Design iterations

A design change from Claude Design is an **iteration**: `iterations/<type>-<topic>-<YYYY-MM-DD>-<id>/` (type `launch | feat | change | fix`), planned (no code) by **`fe-iteration-planning`**, then built by **`fe-kickoff-iteration`**. **Before opening or working on one, read [`iterations/CLAUDE.md`](iterations/CLAUDE.md)** — the phases, intake modes, the gate, Baseline and Status rules.

## Agent-os naming

Every agent-os item this repo owns (skill folder, agent file, command file, rule file) starts
with `fe-`, so names stay unique when clinozy-fe and clinozy-be (whose items start with `be-`) are
loaded in one session. Skills installed from upstream keep their upstream names: every
`agent-os/skills-lock.json` entry, plus the three Vercel skills (`composition-patterns`,
`react-best-practices`, `web-design-guidelines`). A skill's frontmatter `name` always equals its
folder name. `pnpm agent-os:check` enforces both.

## Architecture Overview

```text
Layer          Purpose                                                    Files (approx)
─────────────  ─────────────────────────────────────────────────────────  ──────────────
src/app/       Application shell: routes, guards, providers, error        ~20
               boundaries, analytics + observability bootstrap
src/core/      HTTP, RBAC, config, data-provider, resources,             ~35
               version, types — pure framework-agnostic platform
src/pages/     Route islands (feature code) — custom + resource shapes    ~50
src/shared/    shadcn UI (flat), components/forms/hooks/layouts          ~380
               (folder-per-unit), global Zustand store, standard CRUD,
               cross-page api helpers, auth + tenancy runtime, errors,
               icons, analytics, billing, notifications/notify, theme
src/lib/       Pure utilities (cn, animations, route-island helpers)      ~45
tests/         E2E (Playwright), shared test utils                         ~75

agent-os/      Agents, skills, rules, hooks, MCP, platforms, docs           ~50+
               (.cursor/, .claude/, .codex/ symlink into this)
```

```text
tests/              # At project root: utils, e2e, security, ci, performance (see tests/README.md)
src/
├── app/            # Application shell: route tree, guards, providers, error boundaries
├── core/           # Framework-agnostic services: HTTP, RBAC, config, data-provider, resources, version
├── pages/          # Page-first feature directories (each = a frontend route)
├── shared/         # Cross-page reusables: components, forms, hooks, layouts, store
├── lib/            # Pure utilities: cn(), animations, helpers (no side effects)
├── App.tsx         # Root component
├── main.tsx        # Entry point
└── index.css       # Tailwind CSS v4 entry with @theme tokens
```

All Zustand stores live in **`src/shared/store/<X>Store/`** (folder-per-unit) — `useAuthStore`, `useOrganizationStore`, `useThemeStore`, `useUIStore`, `useOnboardingStore`, `useConsentStore`, `useLocaleStore`. Cross-page API helpers (auth-screen schemas + fetchers `auth-api.ts`/`auth-contracts.ts`, organization-domain schemas + fetchers) live in **`src/shared/api/`**. Organization/tenancy runtime (URL-driven context, membership, `/` resolver, my-organizations) lives in **`src/shared/tenancy/`** — the URL is the single source of truth for organization context. Auth infrastructure (token, refresh-timer, idle-timeout, login/logout service) lives in **`src/shared/auth/`**.

**Dependency rule (one-way, importer → importee):** `app → pages → shared → core → lib`; `shared/components/ui` is a leaf that imports only `lib` and other ui primitives, and `lib` may reach only `core/types`. Pages never import from other pages. One documented exception: the core kernel (`core/http`, `core/rbac`) may import the shared runtime trio — `shared/auth`, `shared/errors`, `useAuthStore`/`useOrganizationStore` (see `agent-os/rules/fe-file-structure.mdc` → Import Rules; enforced in `eslint.config.mjs`).

## Routes and page islands

`src/pages/` mirrors the URL tree 1:1, and every page folder keeps the same four files — `<page>.route.tsx`, `<page>.manifest.ts`, `<Page>Page.tsx` (or `Layout`), `<PAGE>.OVERVIEW.md` — plus its registration in `routeTree.tsx` and `docs/reference/routes-and-ui.md`. The rules, the `route.tsx` contract, dialogs vs pages and the CRUD URLs: **[`src/pages/CLAUDE.md`](src/pages/CLAUDE.md)**; the page directory shape: [`docs/reference/route-island-structure.md`](docs/reference/route-island-structure.md).

## Shared Layer

Code used by 2+ page islands lives in `src/shared/` (components, forms, hooks, layouts, api, auth, tenancy, the global Zustand stores); everything starts colocated and climbs one rung of the promotion ladder per force. Layout, the ladder and auth: **[`src/shared/CLAUDE.md`](src/shared/CLAUDE.md)**.

## Import Conventions

- Use the `@/` path alias for all cross-layer imports from `src/`; **within a page island use relative imports** (eslint forbids `@/pages/**` even from the same island).
- **Always** include `.ts`/`.tsx` extensions in import paths.
- Use `type` imports for type-only imports: `import type { User } from './types.ts'`
- **Icons:** import from `@/shared/icons/index.ts` — never `lucide-react` directly (eslint-enforced; vendored `components/ui/` is exempt). One-file icon-library swap.
- **Heavy deferred modules** (`@sentry/react`, `posthog-js`, the SettingsModal/CommandPalette trees) are **dynamic-import only** — a single static import drags their chunk onto the first-paint preload path (`pnpm build:check` tripwires this).
- **`routeTree.tsx` IS the entry chunk.** A surface the root route mounts exports **only its lazy shell** from its barrel (`SettingsModalLazy`, `AppearanceDialogLazy`, `ConsentBannerLazy`), and an entry-resident module never imports a large constants table for a few keys — declare them locally and pin them with a drift test. A URL-driven dialog route never imports its manifest there — register it with `...dialogRoute(name)`, its manifest and component in `src/app/routes/dialog-routes.ts` — and a room's route builders are imported by their own path (`@/lib/routes/<room>-builders.ts`), never through the `@/lib/routes/index.ts` barrel; `pnpm build:check` trips on either. Attribution method + the other levers: `agent-os/skills/fe-bundle-performance/SKILL.md`.

```tsx
// Good
import { Button } from '@/shared/components/ui/button.tsx';
import type { User } from './contracts.ts';

// Bad
import { Button } from '@/shared/components/ui/button';
import { User } from './contracts';
```

## TypeScript

- Strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `noUnusedLocals: true`
- Define data shapes as **Zod schemas** in `contracts.ts`; infer TS types from them.
- Never use `any` — use `unknown` and narrow with type guards.
- **No digits in names we own** — components, variables, functions, hooks, stores, types, files, test ids, translation keys. A digit is a version, a duplicate, or a shrug; state the distinction in words (`InlineLoader`, not `Loader2`). A third-party export name is the one exemption and stays **on the import side**, renamed immediately: `import { Loader2 as LuLoader } from 'lucide-react'` so app code only ever writes `Loader`. Values keep their numbers (`size-8`, `z-[70]`, `401`). Rule: `agent-os/rules/fe-no-digits-in-names.mdc`.

## State Management

| Scope                                        | Library                   | Location                                                          |
| -------------------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| Server state                                 | TanStack Query            | `pages/<page>/hooks/use<X>/` or `shared/hooks/use{List,One,...}/` |
| Global client state                          | Zustand                   | `src/shared/store/use<X>Store/`                                   |
| Cross-page API helpers (org domain, tenancy) | Plain modules             | `src/shared/api/`                                                 |
| Page-local UI state                          | Zustand                   | `src/pages/<page>/store/use<X>Store/` (rare)                      |
| Component-local                              | `useState` / `useReducer` | Inline; extract reducer to `<Component>.reducer.ts` when complex  |
| Form state                                   | react-hook-form + Zod     | Inside the form component                                         |
| URL state                                    | TanStack Router           | `<page>.search.ts` (validateSearch schema)                        |

**Never** store API data in Zustand — TanStack Query owns server state. Page-local stores are an escape hatch (try `useState` → `useReducer` → URL search params first). Reducers live next to their component; no `reducers/` directory.

## Component Patterns

- **shadcn skill (single source of truth):** for all shadcn/ui work — adding, fixing, styling, composing, CLI, **and choosing which component to use** — follow **`agent-os/skills/shadcn/SKILL.md`** (installed via `pnpm dlx skills add shadcn/ui`). It contains the CLI workflow, Critical Rules, and the project's allowed-sources/selection policy (the former `shadcn-component-selection` skill is merged into it). Add components with `pnpm dlx shadcn@latest add …`; the always-applied rule is `agent-os/rules/fe-ui-sources.mdc`.
- Functional components only (no class components).
- shadcn/ui components use **plain functions** (not `React.forwardRef`) — React 19 forwards refs automatically — with `data-slot` attributes. Two deliberate exceptions keep `React.forwardRef`: `input.tsx` and `textarea.tsx` (for react-hook-form `register()`).
- shadcn/ui imports from `radix-ui` monorepo (not individual `@radix-ui/react-*` packages).
- Compose styles with `cn()` from `@/lib/utils.ts` (clsx + tailwind-merge).
- Use `cva` (class-variance-authority) for variant-based component APIs.
- All interactive elements must have proper ARIA attributes.

## Styling

- **Tailwind CSS v4** with CSS-first config in `src/index.css`.
- Design tokens via `@theme` directive (OKLCH color space).
- Dark mode via `.dark` class — managed by `useThemeStore`.
- Never use inline styles — use Tailwind utility classes.
- **Corner radius + shape follow the theme, everywhere.** Use a **named** radius step (`rounded-xs` … `rounded-4xl` — all derive from the Corner radius axis); a bare `rounded` or `rounded-[3px]` follows nothing and fails `pnpm validate:theme-axis`. `rounded-full` on a surface (chip, count badge, icon disc, track) carries `data-slot="pill"` so the **Sharp** shape can square it; status dots and blurred glows stay round. Never an unconditional `rounded-none`.
- **Screen tiers:** Tailwind's scale plus `3xl` (1920px) and `4xl` (2560px) from `index.css` — layouts keep growing on big monitors. There is **no sidebar** — the section bar's one header holds the nav on every viewport; the bottom tab bar lives below `md` and anything else pinned to the bottom rides above it via `--floating-bottom-offset`. Full rules: `docs/reference/design.md` → Screen tiers.
- **Semantic tokens only** in app code — `bg-background`, `text-success`, `bg-brand`, `bg-overlay/50`, never raw palette classes (`bg-emerald-400`, `text-white`); enforced by `pnpm validate:tokens` (vendored `components/ui/` exempt). A future theme is then just a CSS file of token values.
- shadcn/ui components live in `src/shared/components/ui/`.
- **Aesthetic quality:** when building/styling/beautifying UI, apply **`agent-os/skills/frontend-design/SKILL.md`** (typography hierarchy, intentional theme, high-impact motion, composition, memorable details) — but **within** the guardrails: shadcn components, neutral semantic tokens (no raw colors), configured fonts/brand, and `web-design-guidelines` for a11y. It elevates craft; it does not override the component library, tokens, or brand.
- **Design intelligence (advisory):** query **`agent-os/skills/ui-ux-pro-max/`** for styles, palettes, font pairings, UX/stack/chart guidance (`python3 agent-os/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <…> [--stack shadcn]`). Advisory only — never overrides neutral tokens, configured fonts/brand, or shadcn choices.

## HTTP, environment, auth, routing, deployments

- **HTTP:** `apiClient` from `@/core/http/fetch-client.ts` for every API call (the auth service's raw `authFetch` is the one exception) — [`src/core/CLAUDE.md`](src/core/CLAUDE.md).
- **Environment:** `local` (default) · `development` · `production`, `.env.example` the only committed file; behavior is env-driven, never mode-sniffed, and one behavior is one env variable — [`src/core/CLAUDE.md`](src/core/CLAUDE.md).
- **Auth:** the access token lives in memory only (never localStorage/sessionStorage); `refreshAccessToken()` is the one refresh path; `logout({ reason })` ends a live session — [`src/shared/CLAUDE.md`](src/shared/CLAUDE.md).
- **Routing:** lazy `route.tsx` files, guards and RBAC in `routeTree.tsx` `beforeLoad`; Settings is a hash modal — [`src/app/CLAUDE.md`](src/app/CLAUDE.md).
- **New deployments and the PWA:** `version.json` polling, stale-chunk recovery, critical updates, the service worker and the manifest — [`src/core/CLAUDE.md`](src/core/CLAUDE.md).

## Testing

Colocated unit tests (`src/**/*.test.{ts,tsx}`), `tests/` for helpers, security, CI policy and Playwright E2E (needs clinozy-be on `:3000`; CI runs it against the backend's image in `e2e-backend.yml`). The matrix and conventions: **[`tests/CLAUDE.md`](tests/CLAUDE.md)**.

## Git branch naming

Working branches are `<type>/<short-description>`; `main` is the only long-lived branch (`.husky/pre-push`). A web session starts on a throwaway `claude/<slug>` branch: **rename it before the first push** (`git branch -m <type>/<short-description>`), because the cloud git proxy rejects every branch delete. The full rule and deriving the name: [`.github/CLAUDE.md`](.github/CLAUDE.md).
