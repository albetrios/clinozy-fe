---
name: fe-bundle-performance
description: Keep the clinozy-fe production bundle within size-limit budgets — dynamic-import heavy or deferred modules off the first-paint path, lazy route-island boundaries, code-splitting, and heavy-import triage. Use when acting on a fe-bundle-size-reviewer finding or when a size budget is exceeded.
---

# Bundle performance

The procedural counterpart to the `fe-bundle-size-reviewer` agent: the agent finds,
this skill fixes. Use it when a size budget is exceeded or a chunk regresses.

## Measure first

`pnpm build` then `pnpm size` (size-limit budgets, `tooling/ci/run-size-limit.mjs`);
`pnpm size:check` emits JSON for before/after comparison. Never measure on the
dev server — see `docs/reference/local-production-perf.md`.

`pnpm size` sees the first-paint path only. What each signed-out route actually
downloads is `pnpm perf:routes` (`tooling/perf/public-route-budgets.json`, run
weekly by `lighthouse.yml`). Re-pin it with `pnpm perf:routes --update` on a
CI-equivalent build — no `.env.local`, no ambient `VITE_*` (see Verify): an env
that names a Sentry DSN loads Sentry's ~144 kB chunk after idle, which CI never
does, and the totals once sat ~155 kB loose for exactly that reason. `--update`
re-pins every key; keep the old value wherever it would rise (budgets only come
down) and itemise each change in `tests/performance/README.md` → Re-pins.

## The main levers

1. **Dynamic-import heavy / deferred modules.** `@sentry/react`, `posthog-js`,
   and the SettingsModal / CommandPalette trees must be `import()`-only — a
   single static import drags their chunk onto the first-paint preload path.
   `pnpm build:check` tripwires this; keep them lazy.
   Settings is intentionally warmed with the authenticated outlet while its
   bounded startup splash is held; dynamic splitting does not mean waiting for
   the first settings click. Application notification callers use `notify`, not
   direct Sonner imports; only its deferred runtime/components integrate Sonner.
2. **Lazy route islands.** Every route loads via its `<page>.route.tsx` lazy
   boundary; a route that becomes eagerly imported merges into the entry chunk.
   Keep the boundary intact. If a lazy layout is rendered inside a route wrapper,
   await its TanStack `preload` in the owning route loader before rendering it.
   The router cannot discover that nested layout from the wrapper alone. Preserve
   TanStack's chunk recovery; cover both auth and public layout loaders in route
   tests and check cold-entry browser warnings after router/React upgrades.
3. **Split vendor from entry.** A large new dependency added to a shared,
   eagerly-loaded module inflates the entry. Import it in the leaf that needs
   it, or dynamic-import it; reconsider the dependency (see
   `agent-os/skills/fe-dependency-management/SKILL.md`).
4. **CSP constraint.** `assetsInlineLimit: 0` in `vite.config.ts` is required for
   CSP — do not inline assets to shave requests.
5. **The root route's barrels.** Anything `routeTree.tsx` imports statically IS the
   entry chunk, on every load. A surface it mounts exports **only a lazy shell**
   from its barrel (`SettingsModalLazy`, `AppearanceDialogLazy`,
   `ConsentBannerLazy`) — re-export the real component and it is back on first
   paint. The cookie-consent card was there for every visitor, including the
   returning majority who never see it.
6. **Three keys do not justify a key table.** An entry-resident module that
   imports a big constants module for a handful of values drags the whole module
   in. `AppearanceDialog` read three header keys off `SETTINGS_KEYS` and put the
   entire Settings key table (~17 kB of source, ~3 kB gzipped) on the first paint
   of every load. Declare the few keys locally and **pin them to the originals
   with a drift test** (`appearance-dialog.constants.test.ts`) so they cannot diverge.
7. **Warm-ups must not cost what they save.** A boot-time `preload` helper lives
   in the entry chunk. Import the loaders it calls **dynamically, inside the
   function** — two tiny static imports were enough to break the budget. (That is
   an `import()` in a function body, not the module-scope one below.)
8. **Route registration is first-paint weight.** Every manifest, validator,
   builder and `import()` that `routeTree.tsx` holds ships on every load — and
   Vite gives each `import()` a preload list naming every chunk the island
   shares, which the entry carries too. L-54 measured that as most of the route
   registration: the clinic rooms' imports now sit behind ONE lazy module
   (`src/app/routes/room-routes.ts`, mounted with `roomRoute(name)` and warmed
   by the org shell's loader), the dialog routes' manifests behind another
   (`dialog-routes.ts`, `...dialogRoute(name)`, which awaits the manifest
   before the gate), and each room's builders are imported by their own path,
   never through the `@/lib/routes/index.ts` barrel. `pnpm build:check`
   (`check-entry-routes.mjs`) trips on a dialog manifest or a room builder in
   the first-paint chunks.
9. **The first paint is a handful of files, not a crowd.** Left to automatic
   splitting, every module the entry shares with a lazy chunk became a chunk of
   its own — the first paint shipped as ~24 files, and on a slow connection the
   router waited on round trips, not bytes. `vite.config.ts`'s `codeSplitting`
   gives `vendor`, `zod`, `query` (and the deferred `sentry`, `posthog`, `rhf`)
   their own groups and collects the rest of the static entry graph in one
   `boot` group (`tags: ['$initial']`), which is emitted as the entry chunk:
   five files, ~6.5 kB less gzipped. `vendor` has the highest priority — a
   group takes what its modules import, so the first library group to import
   React would take it (Sentry's 150 kB chunk then became a static import of the
   entry). Because a leak no longer has to arrive as a chunk of its own,
   `check-preload-graph.mjs` reads the first-paint code for each deferred
   library's signature as well as its chunk name.
10. **A control most visitors never open loads on intent.** The signed-out
    header's theme toggle drew Radix's menu — its popper, floating-ui and focus
    management, ~28 kB gzipped — onto every public page's first screen.
    `ThemeModeToggle` now draws the same trigger and fetches `ThemeModeMenu` on
    pointer-enter, focus or press (a press made before it lands opens it when it
    does; focus moves to the real trigger). The pattern for any such control:
    same markup and test id up front, `onceAsync` for the chunk, never a
    module-scope `import()`.

## Attribute a regression before you chase it

When `pnpm size` fails, find out **which modules moved into the entry** before
changing anything — the diff is usually one leak, not the code you just wrote.
Production builds emit hidden source maps, and each map lists its `sources`:

1. Build the branch (`pnpm build`), and build `main` in a throwaway worktree
   _outside the checkout_ (`git worktree add --detach <scratch>/wt-main main`,
   symlink `node_modules`, `pnpm build`; remove it with `git worktree remove`).
2. Read `dist/index.html` for the entry script + every `modulepreload`, open each
   `<chunk>.js.map`, and collect the non-`node_modules` `sources`.
3. Diff the two sets: **added** modules are the leak; for modules in both, compare
   comment-stripped `sourcesContent` length to see what grew.

This is how the Settings key table was found: it was not in the diff of the
change being made at all. Then **lower** the limit to lock the gain in
(`run-size-limit.mjs` — "lower as the bundle shrinks, never raise to absorb
growth") and say in the comment what was attributed.

## CSS: Tailwind generates from whatever it can read

The initial-CSS budget crept to its limit and the cause was not a component. Tailwind's
automatic detection reads **every tracked file in the repository**, so any class-shaped
string is emitted: a doc that says "never write `bg-blue-500`", an agent-os skill's examples,
a gate's test fixtures (`p-[24px]`, `rounded-[3px]`), an E2E spec. That was **196 utilities,
~2.2 kB gzipped** — 9% of the stylesheet — including raw-palette classes that
`validate:tokens` forbids in app code.

`src/index.css` scopes the scan, and tests are not the app either:

```css
@import 'tailwindcss' source('../src');
@source not './**/*.test.ts';
@source not './**/*.test.tsx';
```

Before widening it, know what it protects against: a class the app only **composes at
runtime** (`` `col-span-${n}` ``) was never safe — it merely worked while some doc happened to
spell it. Write the full class name in source.

**A surface no first paint draws can carry its own stylesheet.** The A4 print sheets' millimetre
utilities were ~0.9 kB gzipped of the initial CSS. `src/index.css` now leaves
`shared/components/PrintTemplate/` out of the scan (`@source not`), and
`print-template.css` there generates that folder's utilities with Tailwind's default theme,
imported by `PrintTemplate.tsx` — Vite ships it with the lazy chunks that print. Its limit:
the default theme knows no app token, so a sheet may use a token utility only where a screen
spells it too (`print-template-css.test.ts` fails otherwise). **A split stylesheet's utilities
go in a layer below `utilities`** (`@import 'tailwindcss/utilities' layer(components)`): it loads
after the main one, and outside a layer its copies of shared utilities (`w-full`, `flex`) outrank
every screen's responsive class. Every record drawer filled the viewport, and `flex md:hidden`
showed on desktop, once a sheet had loaded (the same test pins the layer).

- **Tripwire:** `pnpm build:check` → `tooling/ci/check-css-sources.mjs`. Every raw-palette
  utility in `dist/` must be spelled in non-test `src/` (vendored `ui/` is the legitimate
  source); one that is not means the scan has widened again. Tested both directions in
  `check-css-sources.test.mjs`.
- **Attribute CSS the way you attribute JS:** diff the class sets of two builds, not their
  byte counts. A size delta with no matching component change is a scan problem.
- **A CSS selector starting with a digit is escaped** (`3xl:p-8` → `.\33 xl\:p-8`). Grepping the
  build for the unescaped name reports 0 and looks like a regression that is not there.

## Module-scope `import()` is eager — it deletes the split

```ts
const sidebarImport = import('./variants/AppLayoutSidebar.tsx'); // fetches NOW
const Shell = lazy(() => sidebarImport.then((m) => ({ default: m.SidebarShell })));
```

A top-level dynamic import executes at **module evaluation**, so loading the
parent fetches every variant even though one renders. This shipped on clinozy-fe and
`pnpm build:check` did **not** catch it — that tripwires the static preload graph,
not runtime fetches.

Use `onceAsync()` (`src/lib/lazy-module.ts`): same shared module promise (so
`React.lazy` and any test preload resolve the identical promise), but nothing is
fetched until first render or an explicit preload. It deliberately does **not**
cache a rejection, so a chunk fetch that fails on a flaky network stays retryable
instead of leaving the surface unrenderable until a full reload.

```bash
# audit for module-scope dynamic imports (column 0 = module scope; indented = in a function)
grep -rnE '^(const|let|var) [^=]*= *(await )?import\(' src --include='*.ts' --include='*.tsx' \
  | grep -v '\.test\.'
```

## Verify

For dependency or loading changes, also follow these checks:

- Compare production builds with the same source and environment when attributing
  dependency growth. Keep experimental configs and output outside the checkout;
  record the installed versions and measured bytes, not only an estimate.
- Measure with no `VITE_*` exported in the shell, as CI builds. Vite inlines ambient
  `VITE_*` values even without an env file; a cloud container that exports
  `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` and `VITE_STRIPE_PUBLISHABLE_KEY` adds
  ~0.17 kB gzipped to the first-paint `env` chunk. Build with
  `env -u VITE_POSTHOG_KEY -u VITE_POSTHOG_HOST -u VITE_STRIPE_PUBLISHABLE_KEY pnpm build`
  (check `env | grep ^VITE_` first).
- Use `pnpm size` on the real entry and modulepreload graph. Preserve its budgets;
  moving required work to an unconditional startup `import()` is not a saving.
- Keep ready overlay shells and controls visible. Defer only the content or
  library that is not yet needed; await required translations before showing it.
- A deferred notification renderer must preserve message IDs, replacement,
  dismissal, Undo, promise settlement, and visible feedback if its chunk fails.
- Check a production build in desktop and mobile browsers with delayed and failed
  requests. Measure layout stability and verify settings, appearance, search,
  notifications, and locale changes affected by the patch.
- Final verification uses the actual installed dependency graph and normal hooks,
  not a temporary resolver, probe configuration, or disabled gate.

- `pnpm size` — every budget within limit.
- `pnpm build:check` — no heavy deferred module on the first-paint path.
- The module-scope `import()` audit above — no matches outside tests.

## Related

Check the production resource alias as well as the development loader. Single-locale
builds keep immediate shell labels but defer selected-language page namespaces;
policy tests must exercise the generated module and its emitted chunk boundaries.

Skills: `fe-platform-hygiene` (build env, knip, deploy validators),
`react-best-practices` (re-render / code-split patterns),
`fe-dependency-management` (dependency size). Agent: `fe-bundle-size-reviewer`
(read-only finder). Doc: `docs/reference/local-production-perf.md`.
