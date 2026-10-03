import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import {
  formatClinicPhone,
  instagramHref,
  telHref,
  whatsAppHref,
} from '@/shared/clinic/clinic-phone.ts';
import { TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import {
  type ContactReach,
  ICON_ACTION,
} from '@/shared/components/PersonCard/ContactCard/contact-card.types.ts';
import {
  PERSON_CARD_KEYS,
  PERSON_CARD_NS,
} from '@/shared/components/PersonCard/person-card.constants.ts';
import { CardGroup, Hint } from '@/shared/components/PersonCard/person-card-parts.tsx';
import { Button } from '@/shared/components/ui/button.tsx';
import { Copy, InstagramMark, Phone, WhatsAppMark } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

/** WhatsApp mark on sage, `Phone` on sky, Instagram mark on blush (H:5692). */
const REACH_TILE: Readonly<
  Record<ContactReach['channel'], { tone: Tone; icon: ReactNode }>
> = {
  whatsapp: { tone: 'sage', icon: <WhatsAppMark /> },
  phone: { tone: 'sky', icon: <Phone /> },
  instagram: { tone: 'blush', icon: <InstagramMark /> },
};

interface ReachLink {
  href: string;
  label: string;
  icon: ReactNode;
  /** Opens in a new tab (WhatsApp, Instagram); a call does not. */
  external: boolean;
}

/** What one reach row shows: the value, its sub line and its channel links. */
function describeReach(
  reach: ContactReach,
  primary: boolean,
  t: TFunction,
): { value: string; sub: string; links: ReachLink[] } {
  const keys = PERSON_CARD_KEYS;
  if (reach.channel === 'instagram') {
    return {
      value: reach.handle,
      sub: t(keys.reachSub.instagram),
      links: [
        {
          href: instagramHref(reach.handle),
          label: t(keys.openInstagram),
          icon: <InstagramMark className="size-3.5" />,
          external: true,
        },
      ],
    };
  }
  const call: ReachLink = {
    href: telHref(reach.phone),
    label: t(keys.call),
    icon: <Phone className="size-3.5" />,
    external: false,
  };
  if (reach.channel === 'phone') {
    return {
      value: formatClinicPhone(reach.phone),
      sub: t(primary ? keys.reachSub.phonePrimary : keys.reachSub.phoneAlternate),
      links: [call],
    };
  }
  return {
    value: formatClinicPhone(reach.phone),
    sub: t(primary ? keys.reachSub.whatsappPrimary : keys.reachSub.whatsappAlternate),
    links: [
      {
        href: whatsAppHref(reach.phone),
        label: t(keys.whatsApp),
        icon: <WhatsAppMark className="size-3.5" />,
        external: true,
      },
      call,
    ],
  };
}

/** One 32px-tile row per number or handle, with its links and "Copy" (H:2736). */
function ReachRow({ reach, primary }: { reach: ContactReach; primary: boolean }) {
  const { t } = useTranslation(PERSON_CARD_NS);
  const tile = REACH_TILE[reach.channel];
  const { value, sub, links } = describeReach(reach, primary, t);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      notify.success(t(PERSON_CARD_KEYS.copied, { value }));
    } catch {
      notify.error(t(ERRORS_KEYS.frontend.account.copyFailed, { ns: ERRORS_NS }));
    }
  };

  return (
    <div
      data-slot="contact-reach"
      className="bg-card grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border p-1.5"
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-8 items-center justify-center rounded-lg [&_svg]:size-3.75',
          TONE_CLASSES[tile.tone].surface,
        )}
      >
        {tile.icon}
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="text-body truncate leading-[1.2] font-semibold tabular-nums">
          {value}
        </span>
        <span className="text-micro text-muted-foreground truncate leading-[1.2]">
          {sub}
        </span>
      </span>
      <span className="flex">
        {links.map((link) => (
          <Hint key={link.href} label={link.label}>
            <Button asChild variant="ghost" size="icon" className={ICON_ACTION}>
              <a
                href={link.href}
                aria-label={link.label}
                {...(link.external
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {link.icon}
              </a>
            </Button>
          </Hint>
        ))}
        <Hint label={t(PERSON_CARD_KEYS.copy)}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t(PERSON_CARD_KEYS.copy)}
            className={ICON_ACTION}
            onClick={() => void copy()}
          >
            <Copy className="size-3.5" />
          </Button>
        </Hint>
      </span>
    </div>
  );
}

/** The "Reach" section: a row per number or handle, else "No phone or handle saved yet". */
export function ContactReachGroup({ reach }: { reach: readonly ContactReach[] }) {
  const { t } = useTranslation(PERSON_CARD_NS);
  // The first phone is the primary one; the rest are alternates.
  const firstPhone = reach.findIndex((item) => item.channel !== 'instagram');
  return (
    <CardGroup label={t(PERSON_CARD_KEYS.reach)} className="gap-2 px-3.5 pt-3.5 pb-1.5">
      {reach.length ? (
        reach.map((item, index) => (
          <ReachRow
            key={`${item.channel}-${item.channel === 'instagram' ? item.handle : item.phone}`}
            reach={item}
            primary={index === firstPhone}
          />
        ))
      ) : (
        <span className="text-muted-foreground text-xs">
          {t(PERSON_CARD_KEYS.noReach)}
        </span>
      )}
    </CardGroup>
  );
}
