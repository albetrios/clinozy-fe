import type { ReactNode } from 'react';

import { instagramHref, telHref, whatsAppHref } from '@/shared/clinic/clinic-phone.ts';
import type { ContactReach } from '@/shared/components/PersonCard/ContactCard/contact-card.types.ts';
import { InstagramMark, Phone, WhatsAppMark } from '@/shared/icons/index.ts';

/** One of a reach row's 28px links: WhatsApp, Call, Instagram. */
export interface ReachLink {
  href: string;
  label: string;
  icon: ReactNode;
  /** Opens in a new tab (WhatsApp, Instagram); a call does not. */
  external: boolean;
}

/** The links a channel offers, labelled by the host (WhatsApp then Call; Call; Instagram). */
export function reachLinks(
  reach: ContactReach,
  labels: { whatsApp: string; call: string; instagram: string },
): ReachLink[] {
  if (reach.channel === 'instagram') {
    return [
      {
        href: instagramHref(reach.handle),
        label: labels.instagram,
        icon: <InstagramMark className="size-3.5" />,
        external: true,
      },
    ];
  }
  const call: ReachLink = {
    href: telHref(reach.phone),
    label: labels.call,
    icon: <Phone className="size-3.5" />,
    external: false,
  };
  if (reach.channel === 'phone') return [call];
  return [
    {
      href: whatsAppHref(reach.phone),
      label: labels.whatsApp,
      icon: <WhatsAppMark className="size-3.5" />,
      external: true,
    },
    call,
  ];
}
