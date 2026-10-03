import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';

/** The utilities one tone paints a picker with — full literals, so Tailwind sees them. */
export interface PickerToneClasses {
  /** Dot fill (rows, trigger dots, group squares). */
  dot: string;
  /** The dot's 3px halo colour (pair with `ring-3`). */
  halo: string;
  /** Tone background with ink text (pills, icon tiles, avatars). */
  soft: string;
  /**
   * Ink text: the single-select check, and — with `bg-current border-current`
   * — the ink-filled box of a checked multi-select checkbox.
   */
  ink: string;
  /** Active row: the tone at 55% over the panel. */
  active: string;
  /** Picked row: the tone at 70% over the panel. */
  picked: string;
}

/** Literal class map for the launch tones (`tone-<name>`, `-foreground`, `-dot`). */
export const PICKER_TONE_CLASSES: Record<Tone, PickerToneClasses> = {
  butter: {
    dot: 'bg-tone-butter-dot',
    halo: 'ring-tone-butter-dot/18',
    soft: 'bg-tone-butter text-tone-butter-foreground',
    ink: 'text-tone-butter-foreground',
    active: 'data-[selected=true]:bg-tone-butter/55',
    picked: 'bg-tone-butter/70',
  },
  lav: {
    dot: 'bg-tone-lav-dot',
    halo: 'ring-tone-lav-dot/18',
    soft: 'bg-tone-lav text-tone-lav-foreground',
    ink: 'text-tone-lav-foreground',
    active: 'data-[selected=true]:bg-tone-lav/55',
    picked: 'bg-tone-lav/70',
  },
  sky: {
    dot: 'bg-tone-sky-dot',
    halo: 'ring-tone-sky-dot/18',
    soft: 'bg-tone-sky text-tone-sky-foreground',
    ink: 'text-tone-sky-foreground',
    active: 'data-[selected=true]:bg-tone-sky/55',
    picked: 'bg-tone-sky/70',
  },
  sage: {
    dot: 'bg-tone-sage-dot',
    halo: 'ring-tone-sage-dot/18',
    soft: 'bg-tone-sage text-tone-sage-foreground',
    ink: 'text-tone-sage-foreground',
    active: 'data-[selected=true]:bg-tone-sage/55',
    picked: 'bg-tone-sage/70',
  },
  blush: {
    dot: 'bg-tone-blush-dot',
    halo: 'ring-tone-blush-dot/18',
    soft: 'bg-tone-blush text-tone-blush-foreground',
    ink: 'text-tone-blush-foreground',
    active: 'data-[selected=true]:bg-tone-blush/55',
    picked: 'bg-tone-blush/70',
  },
  mint: {
    dot: 'bg-tone-mint-dot',
    halo: 'ring-tone-mint-dot/18',
    soft: 'bg-tone-mint text-tone-mint-foreground',
    ink: 'text-tone-mint-foreground',
    active: 'data-[selected=true]:bg-tone-mint/55',
    picked: 'bg-tone-mint/70',
  },
  peach: {
    dot: 'bg-tone-peach-dot',
    halo: 'ring-tone-peach-dot/18',
    soft: 'bg-tone-peach text-tone-peach-foreground',
    ink: 'text-tone-peach-foreground',
    active: 'data-[selected=true]:bg-tone-peach/55',
    picked: 'bg-tone-peach/70',
  },
  plum: {
    dot: 'bg-tone-plum-dot',
    halo: 'ring-tone-plum-dot/18',
    soft: 'bg-tone-plum text-tone-plum-foreground',
    ink: 'text-tone-plum-foreground',
    active: 'data-[selected=true]:bg-tone-plum/55',
    picked: 'bg-tone-plum/70',
  },
  lime: {
    dot: 'bg-tone-lime-dot',
    halo: 'ring-tone-lime-dot/18',
    soft: 'bg-tone-lime text-tone-lime-foreground',
    ink: 'text-tone-lime-foreground',
    active: 'data-[selected=true]:bg-tone-lime/55',
    picked: 'bg-tone-lime/70',
  },
  slate: {
    dot: 'bg-tone-slate-dot',
    halo: 'ring-tone-slate-dot/18',
    soft: 'bg-tone-slate text-tone-slate-foreground',
    ink: 'text-tone-slate-foreground',
    active: 'data-[selected=true]:bg-tone-slate/55',
    picked: 'bg-tone-slate/70',
  },
  stone: {
    dot: 'bg-tone-stone-dot',
    halo: 'ring-tone-stone-dot/18',
    soft: 'bg-tone-stone text-tone-stone-foreground',
    ink: 'text-tone-stone-foreground',
    active: 'data-[selected=true]:bg-tone-stone/55',
    picked: 'bg-tone-stone/70',
  },
};

/** The six tones an untoned label hashes onto, in the design's order (H:3875). */
const HASHED_TONES: readonly Tone[] = ['sky', 'sage', 'lav', 'butter', 'blush', 'mint'];

/**
 * The tone of a label without one of its own: the design's string hash
 * (`x * 31 + code`, unsigned 32-bit) of the trimmed, lower-cased label, onto
 * sky · sage · lav · butter · blush · mint (H:3875). Stable, so an option keeps
 * its colour everywhere it appears.
 */
export function toneForLabel(label: string): Tone {
  let hash = 0;
  for (const char of label.trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return HASHED_TONES[hash % HASHED_TONES.length] ?? 'stone';
}
