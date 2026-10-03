import type { Role, Section, Tone } from '@/shared/api/clinic/clinic-schema.ts';

/** Each clinic section's tone — one per section, never shared (`shell.md:42`). */
export const SECTION_TONES: Readonly<Record<Section, Tone>> = {
  today: 'butter',
  leads: 'lav',
  appointments: 'sky',
  patients: 'sage',
  medical: 'blush',
  stock: 'mint',
  payments: 'peach',
  tasks: 'plum',
  offerings: 'lime',
  users: 'slate',
};

/**
 * Each clinic role's tone — the prototype's seven (H:3565) plus the two the
 * plan adds: Owner slate and Marketing plum (no tone in the design; AMBER).
 */
export const ROLE_TONES: Readonly<Record<Role, Tone>> = {
  admin: 'lav',
  doctor: 'sky',
  therapist: 'butter',
  front_desk: 'mint',
  counsellor: 'sage',
  pharmacist: 'blush',
  accountant: 'peach',
  owner: 'slate',
  marketing: 'plum',
};

/** The utility classes one tone paints with. */
export interface ToneClasses {
  /** The tone background. */
  bg: string;
  /** Text in the tone's ink. */
  ink: string;
  /** Background and ink together — a tinted surface. */
  surface: string;
  /** Selected: an ink fill with `background` text. */
  fill: string;
  /** The tone's line colour. */
  border: string;
  /** The dot colour (the same in both modes). */
  dot: string;
  /** A status dot's 3px halo. */
  halo: string;
  /** A selected chip's 1px ring in ink. */
  ring: string;
  /** The tab-tint hover: the tone at 45% and an inset 1px ink ring at 16%. */
  hover: string;
}

/**
 * Tone → classes, as full literals so Tailwind can see every one (a class built
 * as `bg-tone-${tone}` is never generated). Tone rules: KICKOFF §3.1.
 */
export const TONE_CLASSES: Readonly<Record<Tone, ToneClasses>> = {
  butter: {
    bg: 'bg-tone-butter',
    ink: 'text-tone-butter-foreground',
    surface: 'bg-tone-butter text-tone-butter-foreground',
    fill: 'bg-tone-butter-foreground text-background',
    border: 'border-tone-butter-border',
    dot: 'bg-tone-butter-dot',
    halo: 'ring-3 ring-tone-butter-dot/18',
    ring: 'ring-1 ring-tone-butter-foreground',
    hover:
      'hover:bg-tone-butter/45 hover:inset-ring hover:inset-ring-tone-butter-foreground/16',
  },
  lav: {
    bg: 'bg-tone-lav',
    ink: 'text-tone-lav-foreground',
    surface: 'bg-tone-lav text-tone-lav-foreground',
    fill: 'bg-tone-lav-foreground text-background',
    border: 'border-tone-lav-border',
    dot: 'bg-tone-lav-dot',
    halo: 'ring-3 ring-tone-lav-dot/18',
    ring: 'ring-1 ring-tone-lav-foreground',
    hover:
      'hover:bg-tone-lav/45 hover:inset-ring hover:inset-ring-tone-lav-foreground/16',
  },
  sky: {
    bg: 'bg-tone-sky',
    ink: 'text-tone-sky-foreground',
    surface: 'bg-tone-sky text-tone-sky-foreground',
    fill: 'bg-tone-sky-foreground text-background',
    border: 'border-tone-sky-border',
    dot: 'bg-tone-sky-dot',
    halo: 'ring-3 ring-tone-sky-dot/18',
    ring: 'ring-1 ring-tone-sky-foreground',
    hover:
      'hover:bg-tone-sky/45 hover:inset-ring hover:inset-ring-tone-sky-foreground/16',
  },
  sage: {
    bg: 'bg-tone-sage',
    ink: 'text-tone-sage-foreground',
    surface: 'bg-tone-sage text-tone-sage-foreground',
    fill: 'bg-tone-sage-foreground text-background',
    border: 'border-tone-sage-border',
    dot: 'bg-tone-sage-dot',
    halo: 'ring-3 ring-tone-sage-dot/18',
    ring: 'ring-1 ring-tone-sage-foreground',
    hover:
      'hover:bg-tone-sage/45 hover:inset-ring hover:inset-ring-tone-sage-foreground/16',
  },
  blush: {
    bg: 'bg-tone-blush',
    ink: 'text-tone-blush-foreground',
    surface: 'bg-tone-blush text-tone-blush-foreground',
    fill: 'bg-tone-blush-foreground text-background',
    border: 'border-tone-blush-border',
    dot: 'bg-tone-blush-dot',
    halo: 'ring-3 ring-tone-blush-dot/18',
    ring: 'ring-1 ring-tone-blush-foreground',
    hover:
      'hover:bg-tone-blush/45 hover:inset-ring hover:inset-ring-tone-blush-foreground/16',
  },
  mint: {
    bg: 'bg-tone-mint',
    ink: 'text-tone-mint-foreground',
    surface: 'bg-tone-mint text-tone-mint-foreground',
    fill: 'bg-tone-mint-foreground text-background',
    border: 'border-tone-mint-border',
    dot: 'bg-tone-mint-dot',
    halo: 'ring-3 ring-tone-mint-dot/18',
    ring: 'ring-1 ring-tone-mint-foreground',
    hover:
      'hover:bg-tone-mint/45 hover:inset-ring hover:inset-ring-tone-mint-foreground/16',
  },
  peach: {
    bg: 'bg-tone-peach',
    ink: 'text-tone-peach-foreground',
    surface: 'bg-tone-peach text-tone-peach-foreground',
    fill: 'bg-tone-peach-foreground text-background',
    border: 'border-tone-peach-border',
    dot: 'bg-tone-peach-dot',
    halo: 'ring-3 ring-tone-peach-dot/18',
    ring: 'ring-1 ring-tone-peach-foreground',
    hover:
      'hover:bg-tone-peach/45 hover:inset-ring hover:inset-ring-tone-peach-foreground/16',
  },
  plum: {
    bg: 'bg-tone-plum',
    ink: 'text-tone-plum-foreground',
    surface: 'bg-tone-plum text-tone-plum-foreground',
    fill: 'bg-tone-plum-foreground text-background',
    border: 'border-tone-plum-border',
    dot: 'bg-tone-plum-dot',
    halo: 'ring-3 ring-tone-plum-dot/18',
    ring: 'ring-1 ring-tone-plum-foreground',
    hover:
      'hover:bg-tone-plum/45 hover:inset-ring hover:inset-ring-tone-plum-foreground/16',
  },
  lime: {
    bg: 'bg-tone-lime',
    ink: 'text-tone-lime-foreground',
    surface: 'bg-tone-lime text-tone-lime-foreground',
    fill: 'bg-tone-lime-foreground text-background',
    border: 'border-tone-lime-border',
    dot: 'bg-tone-lime-dot',
    halo: 'ring-3 ring-tone-lime-dot/18',
    ring: 'ring-1 ring-tone-lime-foreground',
    hover:
      'hover:bg-tone-lime/45 hover:inset-ring hover:inset-ring-tone-lime-foreground/16',
  },
  slate: {
    bg: 'bg-tone-slate',
    ink: 'text-tone-slate-foreground',
    surface: 'bg-tone-slate text-tone-slate-foreground',
    fill: 'bg-tone-slate-foreground text-background',
    border: 'border-tone-slate-border',
    dot: 'bg-tone-slate-dot',
    halo: 'ring-3 ring-tone-slate-dot/18',
    ring: 'ring-1 ring-tone-slate-foreground',
    hover:
      'hover:bg-tone-slate/45 hover:inset-ring hover:inset-ring-tone-slate-foreground/16',
  },
  stone: {
    bg: 'bg-tone-stone',
    ink: 'text-tone-stone-foreground',
    surface: 'bg-tone-stone text-tone-stone-foreground',
    fill: 'bg-tone-stone-foreground text-background',
    border: 'border-tone-stone-border',
    dot: 'bg-tone-stone-dot',
    halo: 'ring-3 ring-tone-stone-dot/18',
    ring: 'ring-1 ring-tone-stone-foreground',
    hover:
      'hover:bg-tone-stone/45 hover:inset-ring hover:inset-ring-tone-stone-foreground/16',
  },
};
