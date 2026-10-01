# Clinozy — design brief preset (answer to `design-brief-prompt.md`)

## MY PRODUCT

- Name: `Clinozy`
- Brand color: `#18181b (zinc-900 ink) + brand green oklch(0.52 0.12 150) for the splash mark / success`
- What it does: `Runs a skin & aesthetic clinic end to end — leads, appointments, patient files, prescriptions, medicine store, clinic stock, payments, tasks and offerings — in one app.`
- Who uses it: `Front desk, doctors, therapists, counsellors, pharmacist, accountant and owner of a multi-branch clinic, on desktop and tablets at the counter and in the treatment room.`
- Content density: `data-dense`
- Feel: `calm, clinical, precise`

## Preset JSON

```json
{
  "preset": {
    "id": "clinozy-zinc-pastel",
    "label": "Clinozy Zinc Pastel",
    "scope": "full-surface",
    "rationale": "A shadcn-style zinc neutral surface keeps a data-dense clinic app calm and legible, while ten deeper-pastel section tones (one per section) give instant wayfinding without loud fills. Ink-dark primary and hairline separation read clinical and precise."
  },
  "axes": {
    "accentColor": "emerald",
    "baseColor": "zinc",
    "harmony": "monochromatic",
    "intensity": "muted",
    "contrast": "crisp",
    "density": "cozy",
    "typeScale": "compact",
    "headingFont": "inter",
    "bodyFont": "inter",
    "radius": "default",
    "shape": "mixed",
    "elevation": "soft",
    "separation": "hairline",
    "focus": "ring",
    "motion": "smooth",
    "menu": "default",
    "iconLibrary": "lucide",
    "iconWeight": "regular",
    "layoutWidth": "full"
  },
  "tokens": {
    "light": {
      "--color-primary": "oklch(0.21 0.006 285.9)",
      "--color-primary-foreground": "oklch(0.985 0 0)",
      "--color-accent": "oklch(0.967 0.001 286.4)",
      "--color-accent-foreground": "oklch(0.21 0.006 285.9)",
      "--color-ring": "oklch(0.21 0.006 285.9)",
      "--color-chart-1": "oklch(0.52 0.12 150)",
      "--color-chart-2": "oklch(0.68 0.09 235)",
      "--color-chart-3": "oklch(0.74 0.11 75)",
      "--color-chart-4": "oklch(0.68 0.1 295)",
      "--color-chart-5": "oklch(0.68 0.1 20)"
    },
    "dark": {
      "--color-primary": "oklch(0.985 0 0)",
      "--color-primary-foreground": "oklch(0.21 0.006 285.9)",
      "--color-accent": "oklch(0.274 0.006 286)",
      "--color-accent-foreground": "oklch(0.985 0 0)",
      "--color-ring": "oklch(0.871 0.006 286.3)",
      "--color-chart-1": "oklch(0.7 0.13 150)",
      "--color-chart-2": "oklch(0.72 0.1 235)",
      "--color-chart-3": "oklch(0.78 0.11 75)",
      "--color-chart-4": "oklch(0.72 0.1 295)",
      "--color-chart-5": "oklch(0.72 0.1 20)"
    }
  },
  "accessibility": {
    "verifiedPairs": [
      {
        "pair": "primary / primary-foreground",
        "mode": "light",
        "resolvedHex": "#fafafa on #18181b",
        "ratio": 16.97,
        "pass": true
      },
      {
        "pair": "primary / primary-foreground",
        "mode": "dark",
        "resolvedHex": "#18181b on #fafafa",
        "ratio": 16.97,
        "pass": true
      },
      {
        "pair": "accent / accent-foreground",
        "mode": "light",
        "resolvedHex": "#18181b on #f4f4f5",
        "ratio": 16.12,
        "pass": true
      },
      {
        "pair": "accent / accent-foreground",
        "mode": "dark",
        "resolvedHex": "#fafafa on #27272a",
        "ratio": 14.29,
        "pass": true
      },
      {
        "pair": "section tone ink / tone bg (e.g. sky oklch(0.37 0.08 235) on oklch(0.925 0.04 235))",
        "mode": "light",
        "resolvedHex": "≈#1f4a66 on ≈#dae9f4",
        "ratio": 8.3,
        "pass": true
      },
      {
        "pair": "white text / success green oklch(0.52 0.12 150)",
        "mode": "light",
        "resolvedHex": "#ffffff on ≈#2e7d4a",
        "ratio": 5.5,
        "pass": true
      },
      {
        "pair": "white text / destructive oklch(0.53 0.2 25)",
        "mode": "light",
        "resolvedHex": "#ffffff on ≈#c62a2a",
        "ratio": 5.28,
        "pass": true
      },
      {
        "pair": "muted-foreground #71717a / background #ffffff",
        "mode": "light",
        "resolvedHex": "#71717a on #ffffff",
        "ratio": 4.83,
        "pass": true
      }
    ],
    "nonTextExemptions": {
      "--color-ring": "Focus indicator only (WCAG 1.4.11 non-text, needs 3:1). Light ring #18181b on white is 17.9:1.",
      "--color-chart-1": "Chart strokes / fills and the brand splash dot are non-text; labels always sit in foreground ink.",
      "tone dot (oklch L 0.66–0.74)": "10px status dots beside a text label; decorative, the label carries the meaning."
    }
  },
  "notes": "1) Dark mode is implemented (user menu › Appearance: Light · Dark · System). App dark values: cards #141417, canvas #0e0e10, ink #f4f4f5, muted #9d9da6, border #2c2c31; section tones get computed dark variants (bg L≈0.26, ink L≈0.86). 2) accentColor enum has no 'zinc/ink'; 'emerald' is chosen because the brand green oklch(0.52 0.12 150) is the only saturated brand hue (splash mark, success, 'Plan ready'). The actual --color-accent is zinc-100 (shadcn accent = hover surface), not green. 3) Section colour-coding (10 pastel tones, bg L≈0.925 / ink L≈0.37) is outside the --color-* token set; it is listed in preset.md, not invented as tokens here. 4) Tone ratios are approximated from OKLCH L (luminance ≈ L³); recompute before shipping. 5) Focus in the app is a background tint (#ececee) on buttons/tabs and a 3px zinc-400/25% ring on inputs; 'ring' is the nearest enum."
}
```
