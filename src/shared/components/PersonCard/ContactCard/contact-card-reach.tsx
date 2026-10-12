import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { copyText } from '@/lib/sensitive-clipboard.ts';
import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import { TONE_CLASSES } from '@/shared/app/app-tones.ts';
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

import { type ReachLink, reachLinks } from './contact-card-reach-links.tsx';

/** WhatsApp mark on sage, `Phone` on sky, Instagram mark on blush (H:5692). */
const REACH_TILE: Readonly<
  Record<ContactReach['channel'], { tone: Tone; icon: ReactNode }>
> = {
  whatsapp: { tone: 'sage', icon: <WhatsAppMark /> },
  phone: { tone: 'sky', icon: <Phone /> },
  instagram: { tone: 'blush', icon: <InstagramMark /> },
};

/** What one contact-card reach row shows: the value, its sub line and its channel links. */
function describeReach(
  reach: ContactReach,
  primary: boolean,
  t: TFunction,
): { value: string; sub: string; links: ReachLink[] } {
  const keys = PERSON_CARD_KEYS;
  const links = reachLinks(reach, {
    whatsApp: t(keys.whatsApp),
    call: t(keys.call),
    instagram: t(keys.openInstagram),
  });
  if (reach.channel === 'instagram') {
    return { value: reach.handle, sub: t(keys.reachSub.instagram), links };
  }
  if (reach.channel === 'phone') {
    return {
      value: formatAppPhone(reach.phone),
      sub: t(primary ? keys.reachSub.phonePrimary : keys.reachSub.phoneAlternate),
      links,
    };
  }
  return {
    value: formatAppPhone(reach.phone),
    sub: t(primary ? keys.reachSub.whatsappPrimary : keys.reachSub.whatsappAlternate),
    links,
  };
}

/** Props of {@link ReachRow}. */
export interface ReachRowProps {
  channel: ContactReach['channel'];
  /** The value as shown — a number, a masked number, a handle. */
  value: string;
  sub: string;
  links: readonly ReachLink[];
  /**
   * What "Copy" puts on the clipboard, and the toast that says so; `label`
   * names the button when it copies something other than the value (a
   * payment reminder's message) — "Copy" by default.
   */
  copy: { text: string; message: string; label?: string };
  /** Before the links — the patient rail's eye. */
  extra?: ReactNode;
  /** In place of the channel tile — a payment reminder's person (32px). */
  leading?: ReactNode;
  /** The value's type size (13px by default). */
  valueClassName?: string;
}

/**
 * One 32px-tile row per number or handle, with its links and "Copy" (H:2736;
 * the patient rail's Reach, H:719): the contact card's and the rail's, which
 * also masks the number behind an eye, and Medical's payment reminders, which
 * lead with the person and copy the message. The value — a number, "•••• 3212",
 * a handle or the reminder's person — reads in its own direction (`dir="auto"`:
 * a number has no letters, so it reads left to right), aligned as the row is.
 */
export function ReachRow({
  channel,
  value,
  sub,
  links,
  copy,
  extra,
  leading,
  valueClassName = 'text-body',
}: ReachRowProps) {
  const { t } = useTranslation(PERSON_CARD_NS);
  const tile = REACH_TILE[channel];
  const copyLabel = copy.label ?? t(PERSON_CARD_KEYS.copy);

  const copyValue = async () => {
    if (await copyText(copy.text)) notify.success(copy.message);
    else notify.error(t(ERRORS_KEYS.frontend.account.copyFailed, { ns: ERRORS_NS }));
  };

  return (
    <div
      data-slot="contact-reach"
      className="bg-card grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border p-1.5"
    >
      {leading ?? (
        <span
          aria-hidden="true"
          className={cn(
            'flex size-8 items-center justify-center rounded-lg [&_svg]:size-3.75',
            TONE_CLASSES[tile.tone].surface,
          )}
        >
          {tile.icon}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-px">
        <span
          dir="auto"
          className={cn(
            'truncate [text-align:match-parent] font-semibold tabular-nums',
            valueClassName,
            // After the size: a type-size class would drop an earlier leading (cn).
            'leading-[1.2]',
          )}
        >
          {value}
        </span>
        <span className="text-micro text-muted-foreground truncate leading-[1.2]">
          {sub}
        </span>
      </span>
      <span className="flex">
        {extra}
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
        <Hint label={copyLabel}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={copyLabel}
            className={ICON_ACTION}
            onClick={() => void copyValue()}
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
        reach.map((item, index) => {
          const { value, sub, links } = describeReach(item, index === firstPhone, t);
          return (
            <ReachRow
              key={`${item.channel}-${item.channel === 'instagram' ? item.handle : item.phone}`}
              channel={item.channel}
              value={value}
              sub={sub}
              links={links}
              copy={{
                text: value,
                message: t(PERSON_CARD_KEYS.copied, { value: isolateText(value, 'ltr') }),
              }}
            />
          );
        })
      ) : (
        <span className="text-muted-foreground text-xs">
          {t(PERSON_CARD_KEYS.noReach)}
        </span>
      )}
    </CardGroup>
  );
}
