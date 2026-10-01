# Screen: Splash

- Route: / (boot, before the app)
- Purpose: Branded load sequence while data loads.
- Entry points: app open / reload
- Exit points: fades into the role's home section (Today for most roles)
- Access: signed-in user
- Layout shell: full-bleed
- Breakpoints: desktop 1440 · tablet 1024 · mobile 390 (same centred composition)

## Regions (top to bottom)

| Region            | Contains                              | Desktop        | Mobile     | Notes |
| ----------------- | ------------------------------------- | -------------- | ---------- | ----- |
| Mark              | dark Clinozy mark, drawn C, green dot | centred        | centred    |       |
| Wordmark          | "Clinozy"                             | under mark     | under mark |       |
| Greeting + ticker | greeting line + 3-step ticker         | under wordmark | same       |       |
| Progress          | 180px hairline bar                    | under ticker   | same       |       |

## Data display

Primitive: none — n/a, no data shown.

## Forms

n/a — no input.

## Popups

n/a — full-bleed boot screen; the only overlay is the inline offline notice.

## Multi-step flow

n/a — timed sequence, not user steps.

## Preview / animated panels

| Field                  | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces               | 1                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Switching              | automatic                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Surface per input type | n/a — no input                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Frame sequence         | 1 mark fades/scales in (czsplMark, scale .6→1) · 2 green halo breathes once (czsplHalo) · 3 C strokes in (czsplashC, dashoffset 40→0) · 4 dot lands (czsplashDot 0→1.25→1) · 5 wordmark fades up (czsplWord, 8px + blur 6px) · 6 greeting + ticker (czsplTick) + bar fills (czsplBar) · 7 cross-fade out                                                                                                                                                                  |
| Frame durations        | mark czsplMark 700ms @50ms cubic-bezier(.2,.9,.25,1.05) · halo czsplHalo 1400ms @550ms cubic-bezier(.2,.8,.2,1) · C stroke czsplashC 700ms @550ms cubic-bezier(.65,0,.35,1) · dot czsplashDot 500ms @1150ms cubic-bezier(.34,1.4,.64,1) · wordmark czsplWord 800ms @1250ms cubic-bezier(.16,1,.3,1) · greeting block czsplashUp 500ms @1900ms ease · bar czsplBar + ticker czsplTick 1500ms @2050ms · total ≈ 3700ms; exit cross-fade 500ms, app fades in over 450ms ease |
| Progressive reveal     | as frame sequence                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Static fallback        | prefers-reduced-motion: all animations 1ms, no delays                                                                                                                                                                                                                                                                                                                                                                                                                     |

## Icons

| Element         | Icon name               | Size           | Semantic? |
| --------------- | ----------------------- | -------------- | --------- |
| Mark + wordmark | custom SVG (not Lucide) | 64 / 34px type | no        |
| Retry (offline) | none — text button      | —              | n/a       |

Library: Lucide · Weight: regular (2px stroke)

## Motion

| Element               | Property                                 | Duration            | Easing                    |
| --------------------- | ---------------------------------------- | ------------------- | ------------------------- |
| Popover / dropdown    | opacity, translateY −4px→0, scale .985→1 | 160ms               | cubic-bezier(.2,.8,.2,1)  |
| Right drawer panel    | transform translateX 100%→0              | 340ms               | cubic-bezier(.32,.72,0,1) |
| Drawer backdrop       | background-color transparent→dim         | 340ms               | cubic-bezier(.32,.72,0,1) |
| Drawer floating ×     | opacity, scale .9→1                      | 200ms (200ms delay) | ease                      |
| Toolbar search expand | width 36px→200px                         | 220ms               | cubic-bezier(.2,.8,.2,1)  |
| Skeleton shimmer      | background-position                      | 1100ms loop         | ease                      |
| Bulk bar              | translateY 100%→0                        | 220ms               | cubic-bezier(.32,.72,0,1) |

Reduced-motion: every animation and transition runs 1ms with no delay, iteration count 1 (shimmer stops), no smooth scroll.

## States

| Surface | Loading                                                          | Empty                     | Error                                                                                                                                                                                     |
| ------- | ---------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Splash  | is the loading state (role=status, aria-label "Loading Clinozy") | n/a — nothing to be empty | offline (navigator.onLine false): splash stays, bar + ticker hide, role=alert line "Can’t reach Clinozy · check the internet connection" (12.5px) + 36px outline button "Retry" (reloads) |

## Copy

| Key           | Exact string                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| wordmark      | "clinozy" (lowercase; the "o" is a ring with a green centre dot)                                                                                              |
| greeting      | "Good morning, <first name>" (before 12:00) · "Good afternoon, <first name>" (12:00–16:59) · "Good evening, <first name>" (17:00+) — 15px / 500 / #18181b     |
| ticker step 1 | "Opening <Weekday>’s schedule" (e.g. "Opening Wednesday’s schedule") — grey dot #d4d4d8                                                                       |
| ticker step 2 | "Syncing patients and leads" — grey dot                                                                                                                       |
| ticker step 3 | "All set" — green dot oklch(0.52 0.12 150)                                                                                                                    |
| sizes         | mark 64×64 (rx 8 on 28 grid, #18181b) · wordmark "clin◉zy" 34px / 600 / -0.03em · bar 180×2px, track #ececee, fill #18181b · ticker 12.5px #71717a, 18px line |
