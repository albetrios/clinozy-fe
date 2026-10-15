# Design Language

The **principles** behind Core — the point of view, the feel, and the rules
that keep every screen coherent. This is the _why_; for the _how_ (token names,
adopting a shadcn-create theme, the one look and its axes) see
[theming.md](theming.md), and for accessibility/UX review criteria use the
`web-design-guidelines` skill. Everything here lives **within the guardrails**:
shadcn/ui components, semantic tokens only (no raw palette), the configured
fonts/brand. Craft is elevated inside those rails, never around them.

## 1. Point of view

This product is a **quiet, neutral control surface.** It wears one look — the
launch's Clinozy Zinc Pastel (`clinozy-zinc-pastel`) — in light or dark: monochrome
and content-first, so the chrome recedes and data and actions lead. The mode is the
user's; the look is not (the Appearance studio that varied it is retired).

Three commitments shape every decision:

- **Neutral by default.** The base palette is black/white/grey in OKLCH. Colour
  is a tool for _meaning_ (success, warning, destructive) or _identity_ (one
  accent), not decoration. A screen with no semantic state should read as
  near-grayscale.
- **Semantic, never literal.** Components reference `bg-background`,
  `text-muted-foreground`, `border-border`, `bg-primary` — never `bg-white` or
  `text-zinc-500`. A new theme is then a different set of token _values_ with
  zero component churn. This is enforced (`pnpm validate:tokens`).
- **Themeable to the core.** Light/dark, the accent, radius, elevation and the
  rest are **token-driven axes** in `index.css` that compose. The system is
  designed so a single CSS file can restyle the whole app and still read correctly
  in both modes — the one look is exactly that file's worth of values.

The litmus test for any new UI: _remove the accent and the data — does it still
feel calm, legible, and intentional?_

## 2. Typography

A single, highly-legible sans carries the product; hierarchy comes from **size,
weight, and colour**, not from many typefaces.

| Role      | Token            | Default        | Use                                                        |
| --------- | ---------------- | -------------- | ---------------------------------------------------------- |
| Body / UI | `--font-sans`    | Inter          | Everything by default                                      |
| Headings  | `--font-heading` | Inter          | `h1`–`h6` (its own token, so a theme can split it)         |
| Mono      | `--font-mono`    | JetBrains Mono | Code, IDs, keys, tabular figures (fixed stack in `@theme`) |

Principles:

- **Hierarchy through restraint.** Step sizes deliberately (e.g. page title →
  section → label → body → meta) and lean on `text-muted-foreground` to demote
  secondary text rather than shrinking everything. Two weights (regular +
  medium/semibold) cover most needs.
- **Headings are their own token.** `--font-heading` is separate from
  `--font-sans` so a theme can pair a characterful display face with a calm body
  face without touching markup.
- **Measure and rhythm.** Keep body copy to a comfortable measure; prefer
  consistent vertical rhythm (the spacing scale) over ad-hoc margins.
- **Minimum readable size.** Product UI labels and hints use at least `text-xs`
  (12px). Sub-12px arbitrary sizes are for decorative meta only — not dashboard
  stats, quick actions, or form labels.
- **Fonts never come from a CDN.** The CSP is `font-src 'self'`: Inter (400–700)
  and JetBrains Mono (400–500) are self-hosted from `@fontsource` — Latin subsets
  only, declared in `src/index.css`.

## 3. Colour

The palette is **OKLCH** end to end — perceptually uniform lightness, so tints
and dark-mode variants stay balanced.

- **Foundation (neutral).** `background` / `foreground` / `card` / `popover` /
  `muted` / `border` / `input` and the parallel `sidebar-*` set are pure grey
  ramps. They define the room; everything else is furniture.
- **Card copy.** Each surface has a paired foreground token: `text-card-foreground`
  on `bg-card`, `text-popover-foreground` on popovers, etc. Custom markup on
  cards must use the paired token — not `text-foreground` by default.
- **One accent.** `primary` (with `ring` + `sidebar-primary`) is the single brand
  hue — in the one look, its zinc ink. Dominant-neutral-plus-one-accent beats an
  evenly-distributed rainbow every time.
- **Semantic state.** `success` (green), `warning` (amber), `info` (blue),
  `destructive` (red) each ship a `*-foreground` pair and are tuned per mode. Use
  them for _meaning only_ — a green button that isn't "success" is a mistake.
- **Special surfaces.** `brand` is the always-dark brand panel — constant across
  light/dark (the sign-in screen is the canvas, not a brand panel). `overlay` is the scrim, only ever used with opacity
  (`bg-overlay/50`). `chart-1..5` is a monochrome ramp by default; a theme can
  spread it from the accent.
- **Base tint (a hook, not offered).** `data-base` = `stone` · `slate` · `olive` ·
  `zinc` · `warm` (`neutral` = no attribute) warms or cools the neutrals by
  injecting a tiny chroma while preserving each token's per-mode lightness. The
  blocks stay in `index.css`; nothing sets the attribute since the studio retired,
  and the one look's own neutrals sit after them anyway.

Contrast is non-negotiable: every `*-foreground` token is chosen to clear WCAG AA
on its surface, in both modes.

## 4. Space, layout & shape

- **Spacing scale.** Use Tailwind's spacing steps; compose rhythm from a small
  set (e.g. 2 / 3 / 4 / 6 / 8). Generous, consistent negative space is the
  cheapest way to look considered. Density is intentional, never accidental.
- **Radius scale.** `--radius-sm` `0.25rem` · `md` `0.375` · `lg` `0.5` · `xl`
  `0.75`. Controls and inputs sit around `md`/`lg`; cards and popovers at `lg`.
  The whole scale derives from one base, so a theme can go sharp or soft in one
  move while keeping the _relationship_ between elements.
- **Surfaces & elevation.** Depth is communicated with `card`/`popover` surfaces,
  `border`, and restrained shadow — not heavy drop-shadows; the one look gives each
  platform slot the design's shadow (`--elevation-*`). The **elevation**,
  **separation** and **menu style** hooks (`[data-elevation]`, `[data-separation]`,
  `[data-menu]`) still retone every `[data-slot]` surface together, at their defaults
  unless set by hand. Overlays darken with the `overlay` scrim.
- **Composition.** Align to a grid; let related actions cluster and unrelated
  ones breathe. Asymmetry and overlap are welcome _when intentional_ — but an
  admin surface earns trust through predictability first.
- **Layout layers (product default).** Three tiers — do not collapse into one
  max-width:
  1. **App shell** — **full** width, the launch's (the clinic's wide tables); a
     deployment can pin `contained` → `max-w-screen-2xl` (1536px) centered in
     `AppMain`, growing to `112rem` at `3xl` and `136rem` at `4xl` so the column
     does not float in the middle of a big monitor, or **Reading** (~768px), with
     `VITE_LAYOUT_WIDTH`.
  2. **Page grid** — free responsive grids: `auto-fit` + `minmax()` for tile rows,
     `2fr / 1fr` splits for asymmetric panels.
  3. **Reading measure** — `max-w-prose` (~65ch) for paragraphs only; **not**
     the whole app. Claude-style ~768px caps belong on reading/chat pages
     locally, not on admin shells.

- **Screen tiers — phone to ultrawide.** Tailwind's scale stops at `2xl`
  (96rem, a 1536px laptop). Two more are declared in `index.css` for the
  big-monitor tier: **`3xl:` = 120rem (1920px)** and **`4xl:` = 160rem
  (2560px)**. Use them wherever a layout would otherwise stop growing — the
  content column, the auth hero's type and padding, large overlays. At the
  other end:
  - **There is no sidebar on any viewport.** The app's one shell is the section
    bar (`AppLayoutSectionBar.tsx`, `shell.md`): a single header holds the nav —
    All sections and the pinned tabs from `md`, the section chip on a phone.
  - **Below `md` there is a bottom tab bar** (`data-slot="mobile-nav"`): a
    floating glass capsule in the style of the iPhone tab bar (iteration
    `change-floating-tab-bar-2026-10-13-pkhy`) — 62px tall, 12px from the sides,
    lifted off the bottom by `--tab-bar-gap` (12px, or the safe-area inset less
    12px over a home indicator), with a selection lens that slides to the current
    room in its tone and a scroll-edge fade under it. Its geometry and its
    glass live in `index.css` (`--tab-bar-height`, `--tab-bar-gap`, two token
    `::before` layers — no `color-mix()`, which ships twice); the capsule is a
    `floating-edge` slot, so the Shape and Elevation axes own its corners and
    shadow. Anything else pinned to the bottom edge rides above it through
    `--floating-bottom-offset` — the capsule's top edge less the inset, which
    every consumer adds itself (published by `index.css` via `:has()`), never
    over it — the consent card and the Report a bug trigger both do, and the
    toasts sit 16px above the whole bottom stack (`AppToaster`).
  - **Overlays are a sheet on phones and a dialog from `sm`.** The `sm:` half
    has to _undo_ the sheet (`sm:w-[calc(100%-2rem)] sm:rounded-lg`), not just
    cap its width — `w-full` with only a `max-w` runs edge to edge on every
    tablet, and an unconditional `rounded-none` stays square under every radius
    setting.
  - **User data wraps.** A name with no break opportunity (email-derived) gets
    `wrap-anywhere`, or it runs past its card and is clipped mid-word.
  - **The end corner belongs to the Report a bug trigger and the edge handles.** A
    new floating surface takes the bottom-_start_ corner (`start-*`, so it
    mirrors under RTL) — see `ConsentBanner`. The clinic bottom stack is the
    designed exception: a floating "New" (phone) and the upload tray (every
    width) claim the bottom-end corner while they show, and the trigger steps
    aside for them in `index.css`.

- **Not Claude-width by default.** Chat products cap ~720–768px for long answers.
  This product is a control surface — width is for tables and panels; constrain
  copy, not chrome. Full rules: [preset-product-design-rules.md § Layout](preset-product-design-rules.md#layout--grid-shell-vs-page-vs-prose).

## 5. Motion

Motion is **subtle, fast, and purposeful** — it orients, it doesn't perform.

- **Vocabulary.** `fade-in` (0.2s) for overlays; **`route-rise`** (0.28s, via the
  `animate-fade-in-up` utility name) for page/route reveals — **transform only, no
  opacity fade** so copy stays visible if animation is skipped or reduced-motion
  short-circuits duration. A flush room fills `<main>` exactly, so while the rise
  plays (`data-replaying`, set by `useReplayedAnimation`) the room frame clips its
  vertical overflow — the 6px never flashes `<main>`'s scrollbar. `accordion` for
  disclosure; `shimmer` for skeleton loading. Overlays use the shadcn enter/exit
  utilities (`tw-animate-css`). The sign-in showcase is the one ambient motion —
  the **journey dial**: one 15.4s turn in which the logo's green thread steps round
  the seven tone-coded stops (holding 1.54s on each, moving 0.66s), and every stop's
  lift, the centre label and the moment cards answer it on the same clock, started
  `--stop × 2.2s` in, so nothing drifts out of step. Its keyframes ship with the lazy
  auth chunk (`AuthShowcase/auth-showcase.css`), not with `index.css`; only the live
  dot's `pulse-dot` (2.4s) is global. Under reduced motion the dial stands still with
  every stop named. Motion never takes text below WCAG AA: a stop lifts (scale) and
  is never dimmed, pinned in `AuthShowcase.test.tsx`.
- **Tabs keep their place.** A tab drawn bolder when current keeps its bold width
  (`WeightStableLabel`), so switching tabs never moves its neighbours.
- **Product motion.** Prefer **Anime.js** for intentional numeric or timeline
  motion (`useOnboardingStepMotion` on the onboarding steps). Avoid stacking Framer-style page
  fades on content shells.
- **High-impact moments over confetti.** One well-orchestrated reveal on
  navigation reads as more polished than scattered micro-interactions. Prefer a
  single staggered entrance to many competing animations.
- **Honour reduced motion.** A global `prefers-reduced-motion` block neutralises
  animation/transition/scroll for users who ask for it — design so the
  motion-free experience is still complete.
- **Interaction affordance.** Interactive elements show a pointer cursor
  (restored app-wide after Tailwind v4 Preflight); hover/focus states are visible
  and never rely on colour alone.

### Loading States

- Render known interface structure immediately: dialog titles, navigation, search,
  close controls, widget headings, and section labels are real UI, not skeletons.
  Keep lazy boundaries inside that structure, around dynamic content only.
- Warm the settings shell alongside authenticated route chunks under the bounded
  boot splash. Keep it out of the anonymous entry bundle and keep the app outlet
  outside settings loading/error boundaries. Failed preloads must not hide or
  remount the page; opening settings can retry with a dismissible recovery surface.
- Match skeletons to the pending content and reserve its final dimensions. Never
  replace a whole dialog, navigation rail, or widget with a pulsing rectangle.
- Keep navigation and dismissal usable during loading. Preserve entered search
  text and focus when deferred content arrives; do not replay entrance animations.
- Keep already-loaded content visible during background refresh. Local failures
  get local retry controls without removing surrounding navigation or content.
- **A search someone is waiting on shows it is working.** Skeletons are flat by
  default; a wait at the desk opts in to the shimmer — `SkeletonBar` /
  `SkeletonRows` `shimmer`: a soft sheen (the page colour over the bar's fill,
  a faint lift of the text colour in dark) sweeping in the reading direction,
  rows 90ms apart (`data-sweep`). Its CSS, `skeleton-sheen.css`, loads the first
  time a bar shimmers (a dynamic import), never with the first paint. The shared `ProgressLine` (the
  bar `RouteProgressBar` draws inline at the page top) runs under the field and the
  glyph turns into the `Spinner`; a new answer loading over the last keeps the
  last rows, dimmed. `ContactQuickPick` and the Picker's loading rows use all of
  it (change-contact-quick-pick).
- **One person picker.** Every field that picks a person — New lead, the
  appointment's Who, New task's For, the Receive payment and Invoice patient —
  is `ContactQuickPick`: inline where the person is the drawer's first step,
  else behind a field in a popover (a sheet on a phone, `ContactQuickPickField`).
  Its list stops at 20rem with the add row pinned below; a Picker popover is
  never wider than 28rem.
- Announce loading once per pending region, hide decorative skeletons from
  assistive technology, and respect reduced motion. The startup splash must have
  a bounded exit deadline that late loading holds cannot restart or cancel.
- **The cold load is one continuous screen: splash → content.** The router runs a
  _boot_ pending policy until its first navigation resolves
  (`BOOT_PENDING_POLICY`: the pending component mounts at once on **every** cold
  URL and holds the splash; no 500ms pending minimum — on boot there is nothing
  for a spinner to flash over), then settles into the in-app one (keep the
  current screen ≤ 3s, 500ms minimum). The splash leaves within frames of the
  router settling (`markAppContentSettled`) rather than after a fixed grace
  window — but never before its wordmark lands (2,050ms; 500ms under reduced
  motion) — and cross-fades out over 500ms while the app comes in over 450ms.
  Its frames are CSS keyframes in `index.html`; on the org layout's first load
  the React slot (`AppSplashSlot`) adds the greeting, bar and ticker, and a device
  offline at mount holds the splash on its notice until Retry (KICKOFF §6.1).
  While `/auth/refresh` is in flight the boot warms
  the chunks the destination will need (`preloadBootRoutes`, steered by a
  session _hint_ that never authorizes anything). Invariants, proven in a browser
  by `tests/e2e/boot-splash.e2e.test.ts`: the splash fades **exactly once**, and
  the page is **never blank** behind it. Numbers and method:
  [local-production-perf.md](local-production-perf.md#cold-load-timeline).
- **Signing out goes straight to the login screen.** The app stays exactly as it
  is until the login screen replaces it: nothing it shows is cleared before the
  page goes (`pagehide`), and the `/login` load a sign-out hands the tab to skips
  the splash (`forceLogout` → `public/splash-init.js` → `APP_SPLASH_SKIP`: the splash is
  hidden and `#root` shown before the first paint, so the browser keeps the page
  being left on screen until the login screen paints). The login screen does not
  wait for a revoke still owed to the server — that finishes behind it.
- Verify first-open and repeat-open behavior with delayed chunks on desktop and
  mobile. Test close, keyboard focus, switching sections, and retry after failure.

## 6. Iconography

- **One surface.** Every icon flows through `@/shared/icons` (lint-enforced) —
  **Lucide**, named once for the app. Pick icons that read at 16px and match the
  calm tone — line icons, consistent metaphors.
- **Weight.** The look's thin **1.5** stroke (`--icon-stroke`), on the brand marks
  too.
- **Restraint.** Icons clarify; they don't decorate. Pair an icon with a label
  unless the glyph is unambiguous and space-constrained.

## 7. Themeability (one look, two modes)

The neutral foundation exists so the app could flex without breaking — and it
did, through an Appearance studio and a Shuffle that rolled whole looks. Both are
retired: the design has no theme studio, so the app wears one look,
`clinozy-zinc-pastel`, and the user picks only the mode (Light · Dark · System),
from the Account menu's pills or the Appearance drawer's Mode card. The drawer
keeps the device's language, text direction, date-time and number preferences.

The axes stay **token-driven and orthogonal** in `index.css`, at the launch's
defaults: contrast rules and slot hooks are fixed, and a component that honours
the tokens (a named radius step, a `data-slot` on a surface, no hardcoded shadow)
follows any future look for free. `VITE_THEME_LOCK=true` pins the mode: no surface
offers Light / Dark / System, and the drawer's Mode card becomes the "managed by your
organization" note.

**Catalog source of truth:** `src/shared/theme/presets.ts` (the one look) and
[theme-axis-audit-playbook.md](theme-axis-audit-playbook.md) (the hooks). Mechanics:
[theming.md](theming.md).

## 8. Principles checklist

**Do**

- Reach for semantic tokens (`bg-background`, `text-primary`, `border-border`).
- Earn attention with hierarchy and space before colour.
- Use colour for meaning (state) or identity (one accent).
- Verify every change in **both** light and dark, at AA contrast.
- Respect reduced-motion; keep motion fast and few.
- Compose from shadcn/ui primitives; extend via `cn()` + `cva` variants.
- Let the field do the work before the person types (feat-write-less-2026-10-14-oixr): build forms
  from the shared drawer pieces, which already take speech (every `DrawerTextarea`, a prose
  `DrawerInput` with `dictation` — the common `VoiceField`, with spoken marks, "scratch that" and
  ⌘ / Ctrl ⇧ Space), save on ⌘ / Ctrl Enter (`RecordDrawer`), work sums out (`DrawerNumberInput`:
  `1500+300`, `1.5k`, `2L`), read date shorthand (`DatePicker`: `2w`, `fri`), step on the arrow keys
  (`DrawerStepper`) and remember the last picks (`Picker` `recentKey`) — and offer known text as a
  chip (`suggestions`) instead of a placeholder the person must retype. A text field outside the
  drawer pieces takes speech by wrapping itself in `VoiceField` (`useVoiceField`); never a name, a
  code or a contact detail, where every letter has to be right.

**Don't**

- Use raw palette classes (`bg-white`, `text-zinc-500`) or inline styles —
  `pnpm validate:tokens` will fail.
- Introduce a second accent or a rainbow of status colours.
- Add bespoke fonts outside the configured stacks (CSP +
  brand).
- Animate for its own sake, or rely on colour alone to signal state.
- Hand-edit vendored `components/ui/*` — go through the `shadcn` skill.

## See also

- [theming.md](theming.md) — token map, shadcn-create adoption, the one look and its axes.
- [preset-product-design-rules.md](preset-product-design-rules.md) — **per-axis product floors** (type scale, density, WCAG, motion).
- `agent-os/skills/frontend-design/SKILL.md` — making UI distinctive within these rails.
- `agent-os/skills/web-design-guidelines` — accessibility/UX review criteria.
- `agent-os/skills/ui-ux-pro-max` — advisory design intelligence (palettes, pairings).
