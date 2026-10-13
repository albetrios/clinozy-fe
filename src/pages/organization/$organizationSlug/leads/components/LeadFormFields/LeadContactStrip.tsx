import type { ReactNode } from 'react';

import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { PersonAvatar, personInitials } from '@/shared/components/Cells/index.ts';
import {
  ContactCard,
  type ContactCardActions,
  type ContactCardData,
} from '@/shared/components/PersonCard/index.ts';

/** Props of {@link LeadContactStrip}. */
export interface LeadContactStripProps extends ContactCardActions {
  /** The contact card the person's identity opens on hover. */
  card: ContactCardData;
  name: string;
  /** E.164, or the digits typed so far. */
  phone: string | null;
  /** " · +2 more" — the numbers and handles beyond the primary. */
  more?: string;
  /** What sits at the strip's end — New lead's "Change". */
  aside?: ReactNode;
}

/**
 * The person's strip (H:1758–1767, H:1888): 38px avatar — sage with "P" for a
 * patient, else lav — the name 16/600 and the mobile; the contact card on
 * hover with the actions the caller offers (Edit / Change contact, "+ Lead" …).
 * The lead drawer shows it over the cards, New lead in place of the Contact step.
 * The name reads in its own direction and the mobile left to right, so both
 * stay whole on a right-to-left page; " · +2 more" keeps the page's.
 */
export function LeadContactStrip({
  card,
  name,
  phone,
  more,
  aside,
  ...actions
}: LeadContactStripProps) {
  const isPatient = card.kind === 'patient';
  return (
    <div className="bg-canvas flex flex-none items-center gap-2 rounded-xl border p-2">
      <ContactCard
        data={card}
        triggerClassName="max-w-85 -m-1 rounded-lg p-1 pe-3"
        {...actions}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <PersonAvatar
            initials={personInitials(name)}
            tone={isPatient ? 'sage' : 'lav'}
            size="strip"
            patient={isPatient}
          />
          <span className="flex min-w-0 flex-col leading-[1.3]">
            <span
              dir="auto"
              className="truncate [text-align:match-parent] text-base font-semibold tracking-[-0.01em]"
            >
              {name}
            </span>
            <span className="text-foreground-soft text-caption tabular-nums">
              {phone ? <span dir="ltr">{formatAppPhone(phone)}</span> : null}
              {more}
            </span>
          </span>
        </span>
      </ContactCard>
      {aside ? <span className="ms-auto flex-none">{aside}</span> : null}
    </div>
  );
}
