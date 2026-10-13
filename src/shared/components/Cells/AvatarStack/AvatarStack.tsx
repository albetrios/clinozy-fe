import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { CELLS_KEYS, CELLS_NS } from '@/shared/components/Cells/cells.constants.ts';
import {
  PersonAvatar,
  personInitials,
  type PersonPresence,
  shortPersonName,
} from '@/shared/components/Cells/PersonAvatar/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

/** One member of an avatar stack. */
export interface AvatarStackPerson {
  /** Stable key (the user or record id). */
  id: string;
  name: string;
  /** Defaults to the name's initials. */
  initials?: string;
  tone: Tone;
  /** The 7px presence dot on the avatar (the Leads owner chip, H:1739). */
  presence?: PersonPresence;
}

/** Props for {@link AvatarStack}: the people, how many show before "+N", and the first one's name. */
export interface AvatarStackProps extends Omit<ComponentProps<'span'>, 'children'> {
  people: readonly AvatarStackPerson[];
  /** How many avatars show before the "+N" pill (the design shows three). */
  max?: number;
  /**
   * Shows the first person's short name in their pill ("Riya S.", "Dr.
   * Drashti") — the tables' people cells (H:3747) and the Leads owner chip;
   * the Leads involved people are avatars only (H:1741).
   */
  nameFirst?: boolean;
  /**
   * Wraps each person's pill — the hover or tap trigger of their team card
   * (the Leads Team column, H:1739–1741).
   */
  wrapPerson?: (person: AvatarStackPerson, pill: ReactNode) => ReactNode;
}

/**
 * The 28px bordered pill each avatar and the "+N" count sit in (H:1741); the
 * `rounded-full` stays beside each `data-slot="pill"` so the Sharp shape and
 * the theme-axis gate both see it.
 */
const SLOT_PILL =
  'border-border bg-card inline-flex h-7 min-w-7 shrink-0 items-center justify-center border';

/**
 * The people cell: up to `max` 22px avatars, each in a 28px bordered pill —
 * the first with its short name when `nameFirst` — then a "+N" pill for the
 * rest (KICKOFF §3.5 Cells; H:1741, H:3747). Full names are spoken, and shown
 * on hover.
 */
export function AvatarStack({
  people,
  max = 3,
  nameFirst = false,
  wrapPerson,
  className,
  ...props
}: AvatarStackProps) {
  const { t } = useTranslation(CELLS_NS);
  const { formatNumber } = useLocaleFormat();
  const shown = people.slice(0, Math.max(0, max));
  const rest = people.length - shown.length;
  return (
    <span
      data-slot="avatar-stack"
      className={cn('inline-flex min-w-0 items-center gap-1', className)}
      {...props}
    >
      {shown.map((person, index) => {
        const named = nameFirst && index === 0;
        const pill = (
          <span
            key={person.id}
            data-slot="pill"
            title={wrapPerson ? undefined : person.name}
            className={cn(
              SLOT_PILL,
              'rounded-full',
              named ? 'max-w-full min-w-0 gap-1.5 ps-0.75 pe-2.5' : 'px-0.5',
            )}
          >
            <PersonAvatar
              size="chip"
              initials={person.initials ?? personInitials(person.name)}
              tone={person.tone}
              presence={person.presence}
            />
            {named ? (
              <span
                aria-hidden="true"
                // "Riya S." keeps its full stop at its end on a right-to-left page.
                dir="auto"
                className="text-detail min-w-0 truncate font-medium"
              >
                {shortPersonName(person.name)}
              </span>
            ) : null}
            <span className="sr-only">{person.name}</span>
          </span>
        );
        if (!wrapPerson) return pill;
        return (
          <span key={person.id} className="flex max-w-full min-w-0">
            {wrapPerson(person, pill)}
          </span>
        );
      })}
      {rest > 0 ? (
        <span
          data-slot="pill"
          data-testid="avatar-stack-more"
          className={cn(
            SLOT_PILL,
            'text-muted-foreground-strong text-micro rounded-full px-2 font-semibold tabular-nums',
          )}
        >
          <span aria-hidden="true">+{formatNumber(rest)}</span>
          <span className="sr-only">{t(CELLS_KEYS.moreCount, { count: rest })}</span>
        </span>
      ) : null}
    </span>
  );
}
