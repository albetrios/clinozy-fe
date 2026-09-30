# Preset: Clinozy Zinc Pastel

- Id: clinozy-zinc-pastel
- Scope: full-surface

## Colour tokens

| Token                           | Light                                                                                                        | Dark                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| background                      | oklch(1 0 0) (#ffffff); page canvas behind lists oklch(0.985 0 0) (#fafafa)                                  | cards #141417 · canvas #0e0e10                                                             |
| foreground                      | oklch(0.141 0.005 285.8) (#09090b)                                                                           | #fafafa (ink #f4f4f5)                                                                      |
| primary                         | oklch(0.21 0.006 285.9) (#18181b)                                                                            | #f4f4f5                                                                                    |
| primary-foreground              | oklch(0.985 0 0) (#fafafa)                                                                                   | #141417                                                                                    |
| accent                          | oklch(0.967 0.001 286.4) (#f4f4f5)                                                                           | #1e1e22                                                                                    |
| accent-foreground               | oklch(0.21 0.006 285.9)                                                                                      | #f4f4f5                                                                                    |
| muted / muted-foreground        | oklch(0.967 0.001 286.4) (#f4f4f5) / oklch(0.552 0.016 285.9) (#71717a)                                      | #1e1e22 / #9d9da6                                                                          |
| border · input · ring           | oklch(0.92 0.004 286.3) (#e4e4e7) · #e4e4e7 · oklch(0.21 0.006 285.9) (#18181b)                              | #2c2c31 · #2c2c31 · #f4f4f5                                                                |
| destructive · success · warning | oklch(0.53 0.2 25) · oklch(0.52 0.12 150) · butter ink oklch(0.38 0.085 65) on oklch(0.935 0.06 85)          | oklch(0.67 0.2 25) · oklch(0.66 0.12 150) · oklch(0.855 0.064 65) on oklch(0.245 0.042 85) |
| chart-1 … chart-5               | oklch(0.52 0.12 150) · oklch(0.68 0.09 235) · oklch(0.74 0.11 75) · oklch(0.68 0.1 295) · oklch(0.68 0.1 20) | oklch(0.66 0.12 150) · dots unchanged                                                      |

Neutral ramp (zinc): 100 #fafafa · 200 #f4f4f5 · 300 #e4e4e7 · 400 #d4d4d8 · 500 #a1a1aa (disabled only) · 600 #71717a (min muted text) · 700 #52525b · 800 #3f3f46 · 900 #18181b.

### Section tones (TN) — one per section, never shared

Each tone = bg / ink / line / dot. Text sits in ink on bg. Selected state on a tone = ink fill + white text.

| Tone   | Section      | bg                     | ink                  | line                  | dot                  |
| ------ | ------------ | ---------------------- | -------------------- | --------------------- | -------------------- |
| butter | Today        | oklch(0.935 0.06 85)   | oklch(0.38 0.085 65) | oklch(0.85 0.08 80)   | oklch(0.74 0.11 75)  |
| lav    | Leads        | oklch(0.925 0.045 295) | oklch(0.37 0.09 295) | oklch(0.83 0.06 295)  | oklch(0.68 0.1 295)  |
| sky    | Appointments | oklch(0.925 0.04 235)  | oklch(0.37 0.08 235) | oklch(0.83 0.055 235) | oklch(0.68 0.09 235) |
| sage   | Patients     | oklch(0.925 0.045 150) | oklch(0.37 0.08 150) | oklch(0.83 0.06 150)  | oklch(0.66 0.1 150)  |
| blush  | Medical      | oklch(0.925 0.04 20)   | oklch(0.38 0.1 20)   | oklch(0.83 0.06 20)   | oklch(0.68 0.1 20)   |
| mint   | Clinic stock | oklch(0.93 0.04 190)   | oklch(0.37 0.07 195) | oklch(0.83 0.055 190) | oklch(0.68 0.08 190) |
| peach  | Payments     | oklch(0.93 0.045 55)   | oklch(0.4 0.1 50)    | oklch(0.84 0.07 55)   | oklch(0.72 0.12 55)  |
| plum   | Tasks        | oklch(0.925 0.04 330)  | oklch(0.38 0.1 330)  | oklch(0.83 0.06 330)  | oklch(0.68 0.1 330)  |
| lime   | Offerings    | oklch(0.935 0.055 120) | oklch(0.38 0.08 125) | oklch(0.85 0.07 120)  | oklch(0.72 0.11 120) |
| slate  | Users        | oklch(0.925 0.02 255)  | oklch(0.37 0.04 255) | oklch(0.83 0.03 255)  | oklch(0.66 0.05 255) |
| stone  | fallback     | #f4f4f5                | #3f3f46              | #e4e4e7               | #d4d4d8              |

Dark tones (computed per tone): bg L = 0.2 + (0.99 − L)·1 with C × 0.7 (≈ 0.255–0.265) · line L 0.4, C × 0.8 · dot unchanged · ink L = 0.87 − (L − 0.35)·0.5, C × 0.75 (≈ 0.86). Ink/bg ≈ 10:1. Theme = user menu › Appearance (Light · Dark · System), html[data-theme], dark only under @media screen (print stays light).

Rules: white text only on fills with L ≤ 0.53 (success green, destructive red, #18181b). Muted text never lighter than #71717a. Dropdown options with no explicit tone hash to one of sky · sage · lav · butter · blush · mint.

## Contrast

| Pair                                  | Mode  | Ratio                      | Passes AA (4.5:1)? |
| ------------------------------------- | ----- | -------------------------- | ------------------ |
| primary / primary-foreground          | light | 16.97                      | yes                |
| primary / primary-foreground          | dark  | ≈16.5 (#141417 on #f4f4f5) | yes                |
| accent / accent-foreground            | light | 16.12                      | yes                |
| accent / accent-foreground            | dark  | ≈14.9 (#f4f4f5 on #1e1e22) | yes                |
| tone ink / tone bg                    | dark  | ≈10                        | yes                |
| #9d9da6 / #141417                     | dark  | ≈7.0                       | yes                |
| tone ink / tone bg (all 10)           | light | ≈8.0–8.4                   | yes                |
| white / success · white / destructive | light | ≈5.5 · ≈5.3                | yes                |
| #71717a / #ffffff                     | light | 4.83                       | yes                |

Brand colour does not fail: primary is zinc-900. The brand green is used both as non-text (splash dot, charts) and as a fill under white text (5.5:1).

## Typography

| Field                    | Value                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| Heading family + weights | Inter 600 (screen h1 20px / 1.2, letter-spacing -0.015em); drawer titles 600           |
| Body family + weights    | Inter 400 / 500 / 600; body 13–14px; labels 12px; chip text 12px; tooltip 11.5px / 500 |
| Mono family              | JetBrains Mono 400 / 500 (IDs, kbd, codes)                                             |
| Type scale               | 11.5 · 12 · 13 · 14 · 16 · 20 px                                                       |
| Self-hosted or CDN?      | CDN — Google Fonts (`Inter:wght@400;500;600;700`, `JetBrains+Mono:wght@400;500`)       |

## Shape, density, motion

| Field                                   | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radius (base + per-component overrides) | 4 kbd/tiny · 6 inner controls, tab triggers, tooltip · 8 controls, list cards · 12 boxes, panels, popovers · 999 pills, avatars, chips                                                                                                                                                                                                                                                                                                                                                        |
| Spacing / density scale                 | 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 px only. Controls 36px (sm 32, lg 44). Chips 24px. Table rows "comfortable" (no row-height control). Compact mode below 1440 wide or 800 tall: drawer sides 24→20, table sides 20→16, page gutter 20→12                                                                                                                                                                                                                                                     |
| Elevation / shadows                     | sm `0 1px 2px rgb(0 0 0/.05)` · md `0 4px 6px -1px rgb(0 0 0/.08), 0 2px 4px -2px rgb(0 0 0/.06)` · lg `0 10px 15px -3px rgb(0 0 0/.1), 0 4px 6px -4px rgb(0 0 0/.08)` (popovers, drawers)                                                                                                                                                                                                                                                                                                    |
| Border vs hairline vs shadow separation | 1px #e4e4e7 hairlines between regions and around cards; shadow only on floating layers                                                                                                                                                                                                                                                                                                                                                                                                        |
| Motion durations + easing               | Popover czddin 160ms cubic-bezier(.2,.8,.2,1) (opacity 0→1, translateY -4px→0, scale .985→1; czddup +4px when opening upward). Drawer czdrawer 340ms cubic-bezier(.32,.72,0,1) translateX 100%→0. Backdrop czbd 340ms same curve, background rgb(9 9 11/0)→dim. Floating drawer × czpop 200ms after 200ms delay (scale .9→1). Bulk bar czbulk translateY 100%→0. Search expand 220ms cubic-bezier(.2,.8,.2,1). Input border/box-shadow 150ms. Tooltip delay 160ms. Skeleton shimmer czsk 1.1s |
| Focus treatment                         | ring on inputs (border #a1a1aa + 3px rgb(161 161 170/.25)); inset tint on buttons/tabs/options (:focus-visible background #ececee, no outline)                                                                                                                                                                                                                                                                                                                                                |

## Ambient effects

n/a — no gradients anywhere (backgrounds, skeletons, headers, rings, brand chips are flat fills). Only painted pattern: calendar grid lines via an SVG pattern. Scrollbars: 10px track, #d4d4d8 pill thumb (#a1a1aa on hover), transparent track, `scrollbar-gutter: stable` on every overflow container.
