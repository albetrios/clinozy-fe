import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { CELLS_KEYS, CELLS_NS } from '@/shared/components/Cells/cells.constants.ts';
import {
  PersonAvatar,
  personInitials,
} from '@/shared/components/Cells/PersonAvatar/index.ts';

/** Props for {@link PersonChip}: the person, their tone and the sub line. */
export interface PersonChipProps extends Omit<ComponentProps<'span'>, 'children'> {
  name: string;
  /** The line under the name: a phone, an id, a role. */
  sub?: ReactNode;
  /** Defaults to the name's initials. */
  initials?: string;
  /** Patients sage, leads lav, suppliers sky… — the room decides. */
  tone: Tone;
  /** Adds the 14px "P" badge (and says "Patient" to a screen reader). */
  patient?: boolean;
  /** An unread record: the name at 600 (the Leads list, `leads.md:32`). */
  emphasis?: boolean;
  /** The sub line's size: 12px (default) or 11.5px (`caption`, the Leads mobile, H:1734). */
  subSize?: 'xs' | 'caption';
}

/**
 * The person cell: 32px avatar, name 13px/500 over a 12px muted sub, both
 * truncating (KICKOFF §3.5 Cells; H:683). Wrap it in a `ContactCard` to make it
 * the hover / tap trigger for the person's card.
 */
export function PersonChip({
  name,
  sub,
  initials,
  tone,
  patient = false,
  emphasis = false,
  subSize = 'xs',
  className,
  ...props
}: PersonChipProps) {
  const { t } = useTranslation(CELLS_NS);
  return (
    <span
      data-slot="person-chip"
      className={cn('flex max-w-full min-w-0 items-center gap-2.5', className)}
      {...props}
    >
      <PersonAvatar
        initials={initials ?? personInitials(name)}
        tone={tone}
        patient={patient}
      />
      <span className="flex min-w-0 flex-col text-start">
        <span
          className={cn(
            'text-body truncate leading-[1.3]',
            emphasis ? 'font-semibold' : 'font-medium',
          )}
        >
          {name}
          {patient ? <span className="sr-only">, {t(CELLS_KEYS.patient)}</span> : null}
        </span>
        {sub ? (
          <span
            className={cn(
              'text-muted-foreground truncate leading-[1.3] tabular-nums',
              subSize === 'caption' ? 'text-caption' : 'text-xs',
            )}
          >
            {sub}
          </span>
        ) : null}
      </span>
    </span>
  );
}
