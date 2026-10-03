import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * WCAG contrast of the clinozy-zinc-pastel preset, recomputed from the shipped
 * stylesheet — the design's ratios are not trusted, they are re-derived (KICKOFF
 * §3.1, L-05). Method of `preset.md:114`: OKLCH → OKLab → linear sRGB → clipped
 * 8-bit sRGB → WCAG relative luminance.
 *
 * Text pairs need 4.5:1 (1.4.3), non-text 3:1 (1.4.11). Pairs the design marks
 * decorative (tone dots, charts 2–5 in light) or exempt (logo, disabled text)
 * are not asserted. The last block proves the guard fires: the two values the
 * design shipped failing still fail here.
 */

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../index.css'),
  'utf8',
).replaceAll(/\/\*[\s\S]*?\*\//g, '');

type Mode = 'light' | 'dark';
type Rgb = readonly [number, number, number];

/** The declarations of the first `selector { … }` block. */
function block(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`index.css has no "${selector}" block`);
  const body = css.slice(start + selector.length + 2, css.indexOf('}', start));
  const tokens = new Map<string, string>();
  for (const declaration of body.split(';')) {
    const colon = declaration.indexOf(':');
    const name = declaration.slice(0, colon).trim();
    if (colon > 0 && name.startsWith('--color-')) {
      tokens.set(name.slice('--color-'.length), declaration.slice(colon + 1).trim());
    }
  }
  return tokens;
}

const PRESET = "[data-theme='clinozy-zinc-pastel']";
const scopes = {
  theme: block('@theme'),
  dark: block('.dark'),
  presetLight: block(PRESET),
  presetDark: block(`.dark${PRESET}`),
  lightPinned: block(`.dark${PRESET} [data-surface='light-pinned']`),
};

/** A token's value under the preset — the cascade `index.css` sets up. */
function token(name: string, mode: Mode, pinned = false): string {
  const order =
    mode === 'light'
      ? [scopes.presetLight, scopes.theme]
      : [
          ...(pinned ? [scopes.lightPinned] : []),
          scopes.presetDark,
          scopes.presetLight,
          scopes.dark,
          scopes.theme,
        ];
  for (const scope of order) {
    const value = scope.get(name);
    if (value) return value;
  }
  throw new Error(`--color-${name} is not declared for ${mode}`);
}

function oklchToRgb(value: string): Rgb {
  const match = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value);
  if (!match) throw new Error(`not a plain oklch() colour: ${value}`);
  const [L, C, H] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const encode = (channel: number) => {
    const c = Math.min(1, Math.max(0, channel));
    const gamma = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(gamma * 255);
  };
  return [encode(linear[0] ?? 0), encode(linear[1] ?? 0), encode(linear[2] ?? 0)];
}

function hexToRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
}

/** `top` at `alpha` over an opaque `under` — what a `/55` utility paints. */
function over(top: Rgb, alpha: number, under: Rgb): Rgb {
  return top.map((c, i) =>
    Math.round(c * alpha + (under[i] ?? 0) * (1 - alpha)),
  ) as unknown as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

const rgb = (name: string, mode: Mode, pinned = false) =>
  oklchToRgb(token(name, mode, pinned));
const ratio = (fg: string, bg: string, mode: Mode) =>
  contrast(rgb(fg, mode), rgb(bg, mode));

const TEXT = 4.5;
const NON_TEXT = 3;
const MODES: readonly Mode[] = ['light', 'dark'];
const TONES = [
  'butter',
  'lav',
  'sky',
  'sage',
  'blush',
  'mint',
  'peach',
  'plum',
  'lime',
  'slate',
];

describe('clinozy-zinc-pastel — text contrast (WCAG 1.4.3)', () => {
  const pairs: ReadonlyArray<readonly [fg: string, bg: string]> = [
    ['primary-foreground', 'primary'],
    ['foreground', 'background'],
    ['foreground', 'canvas'],
    ['accent-foreground', 'accent'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'canvas'],
    // Text on `muted` is the strong step — the design's 4.40 pair is the reason.
    ['muted-foreground-strong', 'muted'],
    ['muted-foreground-strong', 'background'],
    ['foreground-soft', 'background'],
    ['primary', 'muted-strong'],
    ['destructive-foreground', 'destructive'],
    ['destructive', 'background'],
    ['destructive', 'destructive-tint'],
    ['success-foreground', 'success'],
    ['warning-foreground', 'warning'],
    ['info-foreground', 'info'],
    ['tone-sage-foreground', 'tone-sage-tint'],
    ['foreground', 'highlight'],
    ['assist', 'background'],
    ['success-strong', 'background'],
    ['background', 'channel-whatsapp'],
    ['background', 'channel-call'],
    ['background', 'channel-note'],
    ['background', 'channel-instagram'],
    ['channel-instagram-foreground', 'channel-instagram-tint'],
    ['channel-instagram-foreground', 'tone-blush'],
    ['channel-call-foreground', 'channel-call-tint'],
    ['border-strong', 'primary'],
    ['brand-foreground', 'brand'],
    ...TONES.flatMap(
      (tone) =>
        [
          [`tone-${tone}-foreground`, `tone-${tone}`],
          ['background', `tone-${tone}-foreground`],
        ] as const,
    ),
  ];

  for (const mode of MODES) {
    for (const [fg, bg] of pairs) {
      it(`${mode}: ${fg} on ${bg} ≥ ${TEXT}`, () => {
        expect(ratio(fg, bg, mode)).toBeGreaterThanOrEqual(TEXT);
      });
    }

    it(`${mode}: destructive-foreground on the /90 hover ≥ ${TEXT}`, () => {
      const hover = over(rgb('destructive', mode), 0.9, rgb('background', mode));
      expect(contrast(rgb('destructive-foreground', mode), hover)).toBeGreaterThanOrEqual(
        TEXT,
      );
    });

    it(`${mode}: the segmented hover and press keep foreground text readable`, () => {
      for (const alpha of [0.55, 0.85]) {
        const fill = over(rgb('background', mode), alpha, rgb('muted', mode));
        expect(contrast(rgb('foreground', mode), fill)).toBeGreaterThanOrEqual(TEXT);
      }
    });
  }

  it('dark: the light-pinned bulk bar keeps its light primary pair', () => {
    expect(
      contrast(rgb('primary-foreground', 'dark', true), rgb('primary', 'dark', true)),
    ).toBeGreaterThanOrEqual(TEXT);
  });

  it('the photo viewer meta stays readable on its /94 overlay, light-pinned in dark', () => {
    const lightOverlay = over(rgb('overlay', 'light'), 0.94, [255, 255, 255]);
    expect(contrast(rgb('disabled', 'light'), lightOverlay)).toBeGreaterThanOrEqual(TEXT);
    const darkOverlay = over(rgb('overlay', 'dark'), 0.94, rgb('background', 'dark'));
    expect(contrast(rgb('disabled', 'dark', true), darkOverlay)).toBeGreaterThanOrEqual(
      TEXT,
    );
  });
});

describe('clinozy-zinc-pastel — non-text contrast (WCAG 1.4.11)', () => {
  const pairs: ReadonlyArray<readonly [fg: string, bg: string]> = [
    ['ring', 'background'],
    ['ring', 'canvas'],
    ['ring', 'muted-strong'],
    ['chart-1', 'background'],
    ['now-indicator', 'background'],
    ['presence-online', 'background'],
  ];
  for (const mode of MODES) {
    for (const [fg, bg] of pairs) {
      it(`${mode}: ${fg} against ${bg} ≥ ${NON_TEXT}`, () => {
        expect(ratio(fg, bg, mode)).toBeGreaterThanOrEqual(NON_TEXT);
      });
    }
  }
});

describe('the guard fires on what the design shipped failing', () => {
  it('muted-foreground on muted is 4.40:1 in light — why text on muted uses the strong step', () => {
    expect(ratio('muted-foreground', 'muted', 'light')).toBeLessThan(TEXT);
    expect(ratio('muted-foreground', 'muted', 'light')).toBeCloseTo(4.4, 1);
  });

  it("the prototype's raw Instagram #DD2A7B fails under white text in both modes", () => {
    const raw = hexToRgb('#DD2A7B');
    expect(contrast([255, 255, 255], raw)).toBeLessThan(TEXT);
    expect(contrast(rgb('background', 'dark'), raw)).toBeLessThan(TEXT);
  });

  it('the keyboard focus fill alone is under 3:1 — why the ring is added', () => {
    expect(ratio('muted-strong', 'background', 'light')).toBeLessThan(NON_TEXT);
  });
});
