import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { CELLS_KEYS, CELLS_NS } from '@/shared/components/Cells/cells.constants.ts';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar.tsx';

/** The "P" badge's 8px glyph — 2/3 of `--text-xs`, so the Type scale axis moves it. */
const BADGE_TEXT = 'text-[length:calc(var(--text-xs)*2/3)]';

/**
 * The avatar sizes the design draws, named for where they sit, with their
 * initials and badge geometry: `chip` 22px in team chips, stacks and picker
 * trigger chips (9px initials, H:1741); `option` 26px in picker rows (9.5px,
 * 12px badge, H:2891); `cell` 32px in table person cells (11px, 14px "P"
 * badge, H:683); `header` 34px in the chat column's contact header (11.5px,
 * 14px badge, H:1830); `field` 36px in form pickers (12px, H:2756); `card` 48px in
 * person cards (15px, 16px badge, 12px presence dot; H:2731, H:2872). The
 * sub-scale sizes derive from `--text-xs` so the Type scale axis moves them.
 */
const AVATAR_SIZES = {
  chip: {
    root: 'size-5.5',
    initials: 'text-[length:calc(var(--text-xs)*0.75)]',
    badge: cn('size-3.5 -end-0.75 -bottom-0.75', BADGE_TEXT),
    presence: 'size-2.5 -end-0.5 -bottom-0.5',
  },
  option: {
    root: 'size-6.5',
    initials: 'text-[length:calc(var(--text-xs)*19/24)]',
    badge: 'size-3 -end-0.5 -bottom-0.5 text-[length:calc(var(--text-xs)*7/12)]',
    presence: 'size-2.5 -end-0.5 -bottom-0.5',
  },
  cell: {
    root: 'size-8',
    initials: 'text-micro',
    badge: cn('size-3.5 -end-0.75 -bottom-0.75', BADGE_TEXT),
    presence: 'size-2.5 end-0 bottom-0',
  },
  header: {
    root: 'size-8.5',
    initials: 'text-caption',
    badge: cn('size-3.5 -end-0.75 -bottom-0.75', BADGE_TEXT),
    presence: 'size-2.5 end-0 bottom-0',
  },
  field: {
    root: 'size-9',
    initials: 'text-xs',
    badge: cn('size-3.5 -end-0.5 -bottom-0.5', BADGE_TEXT),
    presence: 'size-2.5 end-0 bottom-0',
  },
  card: {
    root: 'size-12',
    initials: 'text-title',
    badge: cn('size-4 -end-0.75 -bottom-0.75', BADGE_TEXT),
    presence: 'size-3 end-px bottom-px',
  },
} as const;

/** One of the design's avatar sizes: 22, 26, 32, 34, 36 or 48px. */
export type PersonAvatarSize = keyof typeof AVATAR_SIZES;

/** Presence as a person card shows it (`presence-online`, else `border-strong`). */
export type PersonPresence = 'online' | 'offline';

/** Props for {@link PersonAvatar}: initials, tone, size and the badge or dot. */
export interface PersonAvatarProps {
  /** Shown in the disc; derive with `personInitials` when the record has none. */
  initials: string;
  /** Patients sage, leads lav, staff their own tone (`ROLE_TONES` / `User.tone`). */
  tone: Tone;
  size?: PersonAvatarSize;
  /** Adds the success-green "P" badge at the bottom inline-end corner. */
  patient?: boolean;
  /** Adds the presence dot (person cards). */
  presence?: PersonPresence;
  className?: string;
}

/**
 * A person's initials in their tone, optionally with the "P" patient badge or a
 * presence dot. Decorative: the name always sits beside it or in screen-reader
 * text, so the disc itself is hidden from assistive technology.
 */
export function PersonAvatar({
  initials,
  tone,
  size = 'cell',
  patient = false,
  presence,
  className,
}: PersonAvatarProps) {
  const { t } = useTranslation(CELLS_NS);
  const sizing = AVATAR_SIZES[size];
  return (
    <span
      aria-hidden="true"
      data-slot="person-avatar"
      className={cn('relative inline-flex shrink-0', className)}
    >
      <Avatar className={sizing.root}>
        <AvatarFallback
          className={cn(TONE_CLASSES[tone].surface, sizing.initials, 'font-semibold')}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      {patient ? (
        <span
          data-slot="pill"
          data-testid="patient-badge"
          className={cn(
            'bg-success text-success-foreground border-card absolute flex items-center justify-center rounded-full border-2 leading-none font-bold',
            sizing.badge,
          )}
        >
          {t(CELLS_KEYS.patientMark)}
        </span>
      ) : null}
      {presence ? (
        <span
          data-slot="pill"
          data-presence={presence}
          className={cn(
            'border-card absolute rounded-full border-2',
            presence === 'online' ? 'bg-presence-online' : 'bg-border-strong',
            sizing.presence,
          )}
        />
      ) : null}
    </span>
  );
}
