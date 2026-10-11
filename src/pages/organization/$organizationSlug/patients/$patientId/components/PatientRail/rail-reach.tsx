import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PatientFile } from '@/shared/api/app/patient-file-contracts.ts';
import { formatAppPhone } from '@/shared/app/app-phone.ts';
import {
  type ContactReach,
  reachLinks,
  ReachRow,
} from '@/shared/components/PersonCard/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';
import { Eye, EyeOff } from '@/shared/icons/index.ts';

import { PATIENT_RAIL_KEYS, PATIENT_RAIL_NS } from './patient-rail.constants.ts';
import { lastFourDigits } from './patient-rail.ts';

const K = PATIENT_RAIL_KEYS;

/** One number or handle of the rail, with the sub line that names it (H:4970). */
interface RailReach {
  reach: ContactReach;
  sub: string;
}

/**
 * The rows the rail lists (H:4967–4970): the primary mobile on WhatsApp, the person's other
 * numbers, then their Instagram handle. A lead and its patient share one person, so there is no
 * separate lead number any more.
 */
function useReachRows(file: PatientFile): RailReach[] {
  const { t } = useTranslation(PATIENT_RAIL_NS);
  const { patient } = file;
  return [
    {
      reach: { channel: 'whatsapp', phone: patient.phone },
      sub: t(K.reachSub.whatsappPrimary),
    },
    ...patient.phones
      .filter((entry) => entry.phone !== patient.phone)
      .map((entry) => ({
        reach: { channel: 'phone', phone: entry.phone } as const,
        sub: t(K.reachSub.mobile),
      })),
    ...(file.instagram
      ? [
          {
            reach: { channel: 'instagram', handle: file.instagram } as const,
            sub: t(K.reachSub.instagram),
          },
        ]
      : []),
  ];
}

/** The eye that reveals one number (H:719): "Show number" / "Hide number". */
function NumberEye({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { t } = useTranslation(PATIENT_RAIL_NS);
  const label = t(shown ? K.hideNumber : K.showNumber);
  const Icon = shown ? EyeOff : Eye;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onToggle}
          aria-label={label}
          aria-pressed={shown}
          className="text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon aria-hidden="true" className="size-3.25" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Reach (H:719): one row per number or handle — the shared reach row with the
 * rail's labels; a number stays "•••• 3212" until its own eye is pressed
 * (Q-F4: numbers reveal one at a time), and "Copy" copies it either way.
 */
export function RailReach({ file }: { file: PatientFile }) {
  const { t } = useTranslation(PATIENT_RAIL_NS);
  const rows = useReachRows(file);
  const [shown, setShown] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) =>
    setShown((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const links = {
    whatsApp: t(K.openWhatsApp),
    call: t(K.call),
    instagram: t(K.openInstagram),
  };

  return (
    <section
      aria-label={t(K.reach)}
      className="flex flex-col gap-2.5 px-(--table-pad-x) pt-4 pb-2"
    >
      <span className="text-micro text-muted-foreground font-semibold tracking-wider uppercase">
        {t(K.reach)}
      </span>
      <div className="flex flex-col gap-1.5">
        {rows.map(({ reach, sub }) => {
          if (reach.channel === 'instagram') {
            return (
              <ReachRow
                key={`instagram-${reach.handle}`}
                channel="instagram"
                value={reach.handle}
                sub={sub}
                links={reachLinks(reach, links)}
                copy={{ text: reach.handle, message: t(K.handleCopied) }}
                valueClassName="text-field tracking-[0.01em]"
              />
            );
          }
          const key = `${reach.channel}-${reach.phone}`;
          const visible = shown.has(key);
          const full = formatAppPhone(reach.phone);
          return (
            <ReachRow
              key={key}
              channel={reach.channel}
              value={
                visible ? full : t(K.maskedNumber, { last4: lastFourDigits(reach.phone) })
              }
              sub={sub}
              links={reachLinks(reach, links)}
              copy={{ text: full, message: t(K.numberCopied) }}
              extra={<NumberEye shown={visible} onToggle={() => toggle(key)} />}
              valueClassName="text-field tracking-[0.01em]"
            />
          );
        })}
      </div>
    </section>
  );
}
