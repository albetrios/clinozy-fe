---
name: fe-skill-registry
description: The catalog of project skills and how to choose one. Use when asked which skill to use, what skills exist or how to do X, or to find the right approach for a task.
---

# Skill Registry

How to choose the skill for a task: the decision tree, then the task table. The file → skill map (which skill(s) to run when a file changes) is generated into `agent-os/docs/skill-triggers.md`; per-skill notes the skills' own files do not hold (install sources, safety notes, project usage) and the broad skills-by-area table are in `agent-os/docs/skill-inventory.md`.

## Decision Tree

**"I want to..."**

- ...implement any requirement / build a feature end-to-end (master pipeline) -> **fe-auto-implement** (orchestrates all other skills)
- ...implement a requirement / add a feature / know where to put code -> **fe-code-structure**
- ...submit a requirement in standard format / request is vague or feature-sized -> **fe-requirement-format**
- ...create a new page/route -> **fe-page-scaffolding**
- ...move a component to shared -> **fe-component-promotion**
- ...optimize React performance -> **react-best-practices**
- ...review UI accessibility/design -> **web-design-guidelines**
- ...refactor component API/props -> **composition-patterns**
- ...add lint rules/security checks/CI -> **fe-code-quality-security**
- ...understand commit checks / fix pre-commit failures / run before-commit guard -> **fe-before-commit-guard**
- ...fix lint/type errors after implementation -> **fe-lint-guard** (auto-invoked, never needs user ask)
- ...check/fix code smells and best practices on new or changed code -> **fe-lint-guard** (its conventions pass, changed code only)
- ...add tests/write tests/coverage -> **fe-test-generation**
- ...E2E test ids / data-testid / Playwright selectors -> **fe-e2e-testids**
- ...write/refactor Playwright E2E specs -> **fe-playwright-e2e**
- ...visual regression / screenshot baselines / snapshot diff -> **fe-visual-regression** (local-only; needs clinozy-be)
- ...debug a bug / test failure / unexpected behavior (before any fix) -> **systematic-debugging** (root cause first)
- ...route island / self-contained path / nested sub-route folder -> **fe-route-island**
- ...plan a design iteration from its `intake-files/` ("plan iteration <name>", "iteration planning", "plan from legacy") -> **fe-iteration-planning** (no code: KICKOFF.md + ordered ledger, then stop for approval)
- ...implement an approved iteration ("kickoff", "kickoff iteration <name>", "start implementing <iteration>") -> **fe-kickoff-iteration** (one ledger row at a time, AS-BUILT.md per row)
- ...build one screen faithfully from `intake-files/` specs + prototype ("ditto", "ditto from legacy", "match the design exactly") -> **fe-design-ditto** (driven per row by fe-kickoff-iteration)
- ...org-scoped route, guards, gateway, session context, settings hash -> **fe-routing-tenancy**
- ...backend resource CRUD (list, URL dialogs, resource manifest) -> **fe-resource-crud**
- ...form mutation errors, 422 mapping, rate limit, QueryBoundary -> **fe-http-forms-errors**
- ...double-submit, a crash escaping its boundary, a toast that outruns the work, a screen guessing its shape -> **fe-resilient-interactions**
- ...platform config, knip, vite-env / client-env validators -> **fe-platform-hygiene**
- ...add a validate gate / lint restriction / static-sync CI step -> **fe-guard-authoring** (prove it fires)
- ...RTL mirroring / logical properties / physical ml-mr-left-right -> **fe-rtl-logical-css**
- ...render a date / time / timezone / number / currency -> **fe-locale-formatting** (never bare Intl)
- ...locale or direction preference, apply path, FOUC init, build mode -> **fe-locale-preferences**
- ...about to open a PR / "is this ready for review" -> **fe-pre-pr-sweep**
- ...sweep / codemod / rename across many files, bulk JSON edits -> **fe-safe-bulk-edits**
- ...add / rename / remove an agent-os skill or rule -> **fe-agent-os-authoring**
- ...handed a review report / PR review threads to address -> **fe-review-response** (verify each claim)
- ...recommend extensions, IDE setup, productivity, workspace settings -> **fe-extension-settings-recommendations**
- ...add/change docs, where to document, keep README/CLAUDE in sync -> **fe-documentation-maintenance**
- ...run a full project health check / verify everything works after major changes -> **fe-project-health-check**
- ...run full code review / generate code review report -> **fe-full-code-review**
- ...add/style/compose a shadcn component, run the shadcn CLI, choose a component -> **shadcn** (`agent-os/skills/shadcn/SKILL.md`)
- ...make a UI distinctive/polished/beautiful -> **frontend-design** (default) + **shadcn** + **web-design-guidelines**
- ...redesign / audit / polish product UI ("impeccable") -> **impeccable** + **shadcn** + **frontend-design** (guardrails win)
- ...implement Anime.js animation -> **animejs** (+ **emil-design-eng** for motion bar)
- ...review animation code in a PR -> **review-animations**
- ...look up design intelligence (styles, palettes, font pairings, UX/stack/chart guidelines) -> **ui-ux-pro-max** (`agent-os/skills/ui-ux-pro-max/SKILL.md`), advisory only
- ...find/install a skill that doesn't exist yet -> **find-skills** (`agent-os/skills/find-skills/SKILL.md`)
- ...audit Appearance/Shuffle theme axes, fix preset compliance, "do elevation" one-by-one -> **fe-theme-axis-audit** (`agent-os/skills/fe-theme-axis-audit/SKILL.md`)
- ...add/rename/remove env var, sync `.env.example`, Secret vs Variable -> **fe-env-schema-add** (`agent-os/skills/fe-env-schema-add/SKILL.md`)

## Task → Required Skills (read in this order)

For each common task, the skills below are required/auto-invoked. `fe-auto-implement` orchestrates the starred (★) chain; `fe-lint-guard` runs after **any** code change (lint, types and its conventions pass); `fe-documentation-maintenance` runs when routes/features/docs change.

| Task                                                                | Required skills (in order)                                                                                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implement a feature / requirement (end-to-end)**                  | fe-auto-implement ★ → fe-requirement-format (if vague) → fe-code-structure → fe-page-scaffolding (if new route) → shadcn + frontend-design (UI) → fe-test-generation → fe-lint-guard → fe-documentation-maintenance |
| **New page / route / sub-route**                                    | fe-route-island → fe-page-scaffolding → fe-code-structure → shadcn (UI) → fe-test-generation → fe-e2e-testids → fe-lint-guard → fe-documentation-maintenance                                                        |
| **Build a design iteration from `iterations/<iteration>/` (ditto)** | **fe-iteration-planning** (plan, stop for approval) → **fe-kickoff-iteration** → **fe-design-ditto** → fe-route-island → fe-page-scaffolding → shadcn → fe-test-generation → fe-e2e-testids → fe-visual-regression  |
| **Org-scoped route / guards / gateway**                             | fe-route-island → **fe-routing-tenancy** → fe-test-generation → fe-lint-guard → fe-documentation-maintenance                                                                                                        |
| **Backend resource CRUD island**                                    | fe-route-island → **fe-resource-crud** → **fe-routing-tenancy** (if org-scoped) → **fe-http-forms-errors** (forms) → fe-test-generation → fe-e2e-testids → fe-lint-guard                                            |
| **Form + API mutation**                                             | composition-patterns → **fe-http-forms-errors** → **fe-resilient-interactions** → fe-test-generation → fe-lint-guard                                                                                                |
| **Platform / env hygiene**                                          | **fe-platform-hygiene** → fe-env-schema-add (if key changed) → fe-documentation-maintenance → fe-lint-guard                                                                                                         |
| **New machine-enforced invariant (gate / lint rule)**               | **fe-guard-authoring** (probe both directions) → fe-code-quality-security (CI wiring) → fe-documentation-maintenance                                                                                                |
| **Any user-visible date / number / money value**                    | **fe-locale-formatting** → fe-i18n-constants (labels) → fe-test-generation                                                                                                                                          |
| **New / restyled component (RTL correctness)**                      | shadcn → frontend-design → **fe-rtl-logical-css** → web-design-guidelines → fe-test-generation                                                                                                                      |
| **Locale / direction preference or apply path**                     | **fe-locale-preferences** → fe-locale-formatting → fe-i18n-constants → fe-test-generation                                                                                                                           |
| **Opening a PR / requesting review**                                | **fe-pre-pr-sweep** → fe-before-commit-guard → fe-documentation-maintenance (PR body accuracy)                                                                                                                      |
| **Codemod / sweep / bulk rename across many files**                 | **fe-safe-bulk-edits** → fe-lint-guard → fe-pre-pr-sweep                                                                                                                                                            |
| **Adding / changing an agent-os skill or rule**                     | **fe-agent-os-authoring** → fe-documentation-maintenance → `/fe-agent-os-sync`                                                                                                                                      |
| **Addressing a code review / review report**                        | **fe-review-response** → (the skill each finding names) → fe-pre-pr-sweep → fe-documentation-maintenance                                                                                                            |
| **New / changed UI component**                                      | shadcn (add/compose) → frontend-design (craft) → ui-ux-pro-max (guidance, advisory) → web-design-guidelines (a11y) → composition-patterns (API) → fe-test-generation → fe-lint-guard                                |
| **Design decision (style/palette/font/chart)**                      | ui-ux-pro-max (query DB, advisory) → frontend-design (direction) → shadcn (tokens/components) — never override neutral tokens/brand without user ask                                                                |
| **Add/choose a shadcn component or run the CLI**                    | shadcn (single skill: CLI + critical rules + 20 allowed sources)                                                                                                                                                    |
| **Style / beautify / restyle existing UI**                          | frontend-design (within tokens/brand) → shadcn (primitives) → web-design-guidelines (a11y) → fe-lint-guard                                                                                                          |
| **Redesign / audit / polish product UI ("impeccable")**             | shadcn → impeccable → frontend-design → web-design-guidelines → fe-lint-guard                                                                                                                                       |
| **Add Anime.js motion**                                             | animejs → emil-design-eng (motion bar) → fe-lint-guard                                                                                                                                                              |
| **Review animation code (PR / diff)**                               | review-animations                                                                                                                                                                                                   |
| **Data table / list / filters**                                     | shadcn (Table + DataTable) → react-best-practices (perf) → web-design-guidelines → fe-test-generation → fe-lint-guard                                                                                               |
| **Promote a component to shared/**                                  | fe-component-promotion → fe-code-structure → fe-test-generation → fe-lint-guard                                                                                                                                     |
| **Refactor a component API / remove boolean-prop sprawl**           | composition-patterns → react-best-practices → fe-test-generation → fe-lint-guard                                                                                                                                    |
| **Fix React performance / re-renders / bundle size**                | react-best-practices → fe-lint-guard                                                                                                                                                                                |
| **Add or update tests**                                             | fe-test-generation → fe-lint-guard                                                                                                                                                                                  |
| **E2E selectors / data-testid on UI**                               | fe-e2e-testids → fe-test-generation (unit tests) → fe-lint-guard                                                                                                                                                    |
| **Playwright E2E specs (hybrid selectors)**                         | fe-playwright-e2e → fe-e2e-testids → fe-lint-guard                                                                                                                                                                  |
| **Accessibility / UX audit**                                        | web-design-guidelines (→ frontend-design if visual polish also needed)                                                                                                                                              |
| **Lint / type-check failures**                                      | fe-lint-guard (then fe-code-quality-security if config changes)                                                                                                                                                     |
| **Code smells on changed code**                                     | fe-lint-guard (conventions pass)                                                                                                                                                                                    |
| **ESLint / Husky / CI / security pipeline change**                  | fe-code-quality-security → fe-before-commit-guard                                                                                                                                                                   |
| **Before committing**                                               | fe-before-commit-guard (env docs, assets, format, lint, types)                                                                                                                                                      |
| **Add/rename/remove env var**                                       | **fe-platform-hygiene** → fe-env-schema-add → tool:sync-env-example → fe-documentation-maintenance (runbook)                                                                                                        |
| **PWA manifest / favicon / app icon**                               | **fe-pwa-manifest** → `app-manifest.test.ts` + `validate:public` → fe-documentation-maintenance                                                                                                                     |
| **Docs change / new route affecting README/CLAUDE**                 | fe-documentation-maintenance                                                                                                                                                                                        |
| **Extensions / IDE setup / new tooling**                            | fe-extension-settings-recommendations                                                                                                                                                                               |
| **Full project health check**                                       | fe-project-health-check (chains docs, tests, lint, build, bundle)                                                                                                                                                   |
| **Full code review report**                                         | fe-full-code-review                                                                                                                                                                                                 |
| **Theme axis audit** (appearance/shuffle compliance)                | fe-theme-axis-audit → fe-lint-guard → fe-documentation-maintenance (playbook tracker)                                                                                                                               |
| **"Which skill do I use?"**                                         | fe-skill-registry (this file)                                                                                                                                                                                       |
| **"Is there a skill for X?" / capability missing**                  | find-skills (discover + install, then wire into router/registry/docs)                                                                                                                                               |

> If a task has **no** matching row here or in `fe-skill-router.mdc`, use **find-skills** to look for one before building from scratch; if none exists, proceed with general capabilities.

## Skill Inventory

<!-- GENERATED:START -->

**Skill Inventory (52 skills)** — generated by `pnpm agent-os:generate` from each
skill's frontmatter and `agent-os/skills/groups.json`. What each skill is for is its description (the skill
listing, and the skill's own file); per-skill notes: `agent-os/docs/skill-inventory.md`.

| Skill                                   | Group         | Path                                                             |
| --------------------------------------- | ------------- | ---------------------------------------------------------------- |
| `animejs`                               | external      | `agent-os/skills/animejs/SKILL.md`                               |
| `composition-patterns`                  | ui-design     | `agent-os/skills/composition-patterns/SKILL.md`                  |
| `emil-design-eng`                       | external      | `agent-os/skills/emil-design-eng/SKILL.md`                       |
| `fe-agent-os-authoring`                 | workflow      | `agent-os/skills/fe-agent-os-authoring/SKILL.md`                 |
| `fe-auto-implement`                     | workflow      | `agent-os/skills/fe-auto-implement/SKILL.md`                     |
| `fe-before-commit-guard`                | quality       | `agent-os/skills/fe-before-commit-guard/SKILL.md`                |
| `fe-bundle-performance`                 | platform      | `agent-os/skills/fe-bundle-performance/SKILL.md`                 |
| `fe-code-quality-security`              | quality       | `agent-os/skills/fe-code-quality-security/SKILL.md`              |
| `fe-code-structure`                     | quality       | `agent-os/skills/fe-code-structure/SKILL.md`                     |
| `fe-component-promotion`                | quality       | `agent-os/skills/fe-component-promotion/SKILL.md`                |
| `fe-dependency-management`              | platform      | `agent-os/skills/fe-dependency-management/SKILL.md`              |
| `fe-design-ditto`                       | workflow      | `agent-os/skills/fe-design-ditto/SKILL.md`                       |
| `fe-documentation-maintenance`          | docs          | `agent-os/skills/fe-documentation-maintenance/SKILL.md`          |
| `fe-e2e-testids`                        | testing       | `agent-os/skills/fe-e2e-testids/SKILL.md`                        |
| `fe-env-schema-add`                     | platform      | `agent-os/skills/fe-env-schema-add/SKILL.md`                     |
| `fe-extension-settings-recommendations` | platform      | `agent-os/skills/fe-extension-settings-recommendations/SKILL.md` |
| `fe-full-code-review`                   | quality       | `agent-os/skills/fe-full-code-review/SKILL.md`                   |
| `fe-guard-authoring`                    | quality       | `agent-os/skills/fe-guard-authoring/SKILL.md`                    |
| `fe-http-forms-errors`                  | routing-pages | `agent-os/skills/fe-http-forms-errors/SKILL.md`                  |
| `fe-i18n-constants`                     | i18n          | `agent-os/skills/fe-i18n-constants/SKILL.md`                     |
| `fe-iteration-planning`                 | workflow      | `agent-os/skills/fe-iteration-planning/SKILL.md`                 |
| `fe-kickoff-iteration`                  | workflow      | `agent-os/skills/fe-kickoff-iteration/SKILL.md`                  |
| `fe-lint-guard`                         | quality       | `agent-os/skills/fe-lint-guard/SKILL.md`                         |
| `fe-locale-formatting`                  | i18n          | `agent-os/skills/fe-locale-formatting/SKILL.md`                  |
| `fe-locale-preferences`                 | i18n          | `agent-os/skills/fe-locale-preferences/SKILL.md`                 |
| `fe-page-scaffolding`                   | routing-pages | `agent-os/skills/fe-page-scaffolding/SKILL.md`                   |
| `fe-platform-hygiene`                   | platform      | `agent-os/skills/fe-platform-hygiene/SKILL.md`                   |
| `fe-playwright-e2e`                     | testing       | `agent-os/skills/fe-playwright-e2e/SKILL.md`                     |
| `fe-pre-pr-sweep`                       | quality       | `agent-os/skills/fe-pre-pr-sweep/SKILL.md`                       |
| `fe-project-health-check`               | quality       | `agent-os/skills/fe-project-health-check/SKILL.md`               |
| `fe-pwa-manifest`                       | ui-design     | `agent-os/skills/fe-pwa-manifest/SKILL.md`                       |
| `fe-requirement-format`                 | docs          | `agent-os/skills/fe-requirement-format/SKILL.md`                 |
| `fe-resilient-interactions`             | routing-pages | `agent-os/skills/fe-resilient-interactions/SKILL.md`             |
| `fe-resource-crud`                      | routing-pages | `agent-os/skills/fe-resource-crud/SKILL.md`                      |
| `fe-review-response`                    | quality       | `agent-os/skills/fe-review-response/SKILL.md`                    |
| `fe-route-island`                       | routing-pages | `agent-os/skills/fe-route-island/SKILL.md`                       |
| `fe-routing-tenancy`                    | routing-pages | `agent-os/skills/fe-routing-tenancy/SKILL.md`                    |
| `fe-rtl-logical-css`                    | ui-design     | `agent-os/skills/fe-rtl-logical-css/SKILL.md`                    |
| `fe-safe-bulk-edits`                    | quality       | `agent-os/skills/fe-safe-bulk-edits/SKILL.md`                    |
| `fe-skill-registry`                     | workflow      | `agent-os/skills/fe-skill-registry/SKILL.md`                     |
| `fe-test-generation`                    | testing       | `agent-os/skills/fe-test-generation/SKILL.md`                    |
| `fe-theme-axis-audit`                   | ui-design     | `agent-os/skills/fe-theme-axis-audit/SKILL.md`                   |
| `fe-visual-regression`                  | testing       | `agent-os/skills/fe-visual-regression/SKILL.md`                  |
| `find-skills`                           | external      | `agent-os/skills/find-skills/SKILL.md`                           |
| `frontend-design`                       | ui-design     | `agent-os/skills/frontend-design/SKILL.md`                       |
| `impeccable`                            | ui-design     | `agent-os/skills/impeccable/SKILL.md`                            |
| `react-best-practices`                  | quality       | `agent-os/skills/react-best-practices/SKILL.md`                  |
| `review-animations` (manual only)       | external      | `agent-os/skills/review-animations/SKILL.md`                     |
| `shadcn`                                | ui-design     | `agent-os/skills/shadcn/SKILL.md`                                |
| `systematic-debugging`                  | quality       | `agent-os/skills/systematic-debugging/SKILL.md`                  |
| `ui-ux-pro-max`                         | ui-design     | `agent-os/skills/ui-ux-pro-max/SKILL.md`                         |
| `web-design-guidelines`                 | ui-design     | `agent-os/skills/web-design-guidelines/SKILL.md`                 |

<!-- GENERATED:END -->

## Always-Active Rules (not skills)

These Cursor rules are always loaded and do not need to be invoked:

| Rule                      | File                                           | Purpose                                                                                                   |
| ------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| fe-project-conventions    | `agent-os/rules/fe-project-conventions.mdc`    | Architecture, imports, state management                                                                   |
| fe-ui-sources             | `agent-os/rules/fe-ui-sources.mdc`             | Allowed 20 shadcn UI sources; for all shadcn work read the single skill `agent-os/skills/shadcn/SKILL.md` |
| fe-file-structure         | `agent-os/rules/fe-file-structure.mdc`         | Directory layout, route.tsx convention                                                                    |
| fe-testing-requirements   | `agent-os/rules/fe-testing-requirements.mdc`   | Test generation auto-trigger, data-testid convention                                                      |
| fe-context7-libraries     | `agent-os/rules/fe-context7-libraries.mdc`     | Library doc lookup via Context7 MCP                                                                       |
| fe-skill-router           | `agent-os/rules/fe-skill-router.mdc`           | Auto-routes tasks to the right skill; complete all steps without asking                                   |
| fe-routing-tenancy-sync   | `agent-os/rules/fe-routing-tenancy-sync.mdc`   | Org routes, guards, gateway — read fe-routing-tenancy skill                                               |
| fe-platform-hygiene-sync  | `agent-os/rules/fe-platform-hygiene-sync.mdc`  | Env/platform config — read fe-platform-hygiene skill                                                      |
| fe-pwa-manifest-sync      | `agent-os/rules/fe-pwa-manifest-sync.mdc`      | PWA manifest/icon — read fe-pwa-manifest skill                                                            |
| fe-env-schema-add-sync    | `agent-os/rules/fe-env-schema-add-sync.mdc`    | Env schema / `.env.example` — read fe-env-schema-add skill                                                |
| fe-agent-behavior         | `agent-os/rules/fe-agent-behavior.mdc`         | Complete tests, route reg, RBAC, docs without asking; never ask "Do you want X?"                          |
| fe-resilient-interactions | `agent-os/rules/fe-resilient-interactions.mdc` | 30 UI-resilience rules: single-flight writes, contained crashes, honest loading/empty/error states        |

## Orchestration manifests (machine-readable)

The relationships above are also declared as data, eval-gated by
`agent-os/evals/check.ts` so they cannot drift:

| Manifest                          | Declares                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent-os/skills/chains.json`     | Named ordered skill sequences (page-change, fe-resource-crud, form-mutation, …)                                                                   |
| `agent-os/skills/groups.json`     | Every skill in exactly one group (ui-design, quality, platform, …)                                                                                |
| `agent-os/agents/pipelines.json`  | Reviewer-agent pipelines (`fe-pre-merge-review`, `fe-prod-readiness`) + handoffs                                                                  |
| `agent-os/docs/skill-triggers.md` | File-pattern → skill routing, generated from `chains.json` and each skill's `trigger` frontmatter (Tier-2 tested via `evals/cases/triggers.json`) |

Read-only reviewer agents are catalogued in `agent-os/docs/agents-catalog.md`.

## Enterprise Platform Integration

| Tool           | Config File                                                                        | Purpose                                    |
| -------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| Backstage      | `catalog-info.yaml`                                                                | Service catalog registration               |
| Netlify        | `netlify.toml`, `dist/_headers`, `.github/workflows/reusable-netlify-deploy.yml`   | SPA serving, caching, security headers     |
| PWA            | `src/core/config/app-manifest.ts`, `public/manifest.webmanifest`, `vite.config.ts` | Install surface; skill **fe-pwa-manifest** |
| release-please | `.github/release-please/config.json`, `.github/release-please/manifest.json`       | Human-gated releases                       |
| Sentry         | `src/app/observability/sentry.ts`                                                  | Error tracking + PII scrubbing             |
| PostHog        | `src/app/analytics/posthog.ts`                                                     | Product analytics                          |
| Web Vitals     | `src/app/observability/performance.ts`                                             | Performance monitoring → PostHog + Sentry  |
