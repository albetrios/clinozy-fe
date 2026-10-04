import { useTranslation } from 'react-i18next';

import type {
  LeadRecord,
  LeadRecordSource,
} from '@/shared/api/clinic/leads-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { clinicLeadStatusKey } from '@/shared/clinic/clinic-lead-status.ts';
import { LEAD_SOURCE_TONES, LEAD_STATUS_TONES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip.tsx';

import { LEADS_KEYS, LEADS_NS } from '../../leads.constants.ts';
import { LEAD_SOURCE_ICONS, leadInterestViews } from './lead-display.ts';

/**
 * A lead's status as a 24px pill in its tone (H:3346) — "Re-targeted" for a
 * re-target lead still New (D22). Nothing for a lead without one.
 */
export function LeadStatusPill({ lead }: { lead: Pick<LeadRecord, 'status' | 'kind'> }) {
  const { t } = useTranslation(CLINIC_NS);
  const key = clinicLeadStatusKey(lead);
  if (!(key && lead.status)) return null;
  return <TonePill tone={LEAD_STATUS_TONES[lead.status]}>{t(key)}</TonePill>;
}

/** A lead's source as a 24px pill: its 13px icon and name, in its tone (H:3348). */
export function LeadSourcePill({ source }: { source: LeadRecordSource | null }) {
  const { t } = useTranslation(CLINIC_NS);
  if (!source) return null;
  const Icon = LEAD_SOURCE_ICONS[source];
  return (
    <TonePill tone={LEAD_SOURCE_TONES[source]} icon={<Icon className="size-3.25" />}>
      {t(CLINIC_KEYS.leads.sources[source])}
    </TonePill>
  );
}

/**
 * "Interested in" in a cell (`leads.md:32`): the first interest as a 24px pill
 * and a neutral "+N" pill whose tooltip lists them all.
 */
export function LeadInterestPills({
  lead,
}: {
  lead: Pick<LeadRecord, 'interests' | 'customInterests'>;
}) {
  const { t } = useTranslation(CLINIC_NS);
  const { t: tLeads } = useTranslation(LEADS_NS);
  const views = leadInterestViews(lead, (interest) =>
    t(CLINIC_KEYS.leads.interests[interest]),
  );
  const [first] = views;
  if (!first) return null;
  const more = views.length - 1;
  const all = views.map((view) => view.label).join(', ');
  return (
    <span className="flex min-w-0 gap-1 overflow-hidden">
      <TonePill tone={first.tone}>{first.label}</TonePill>
      {more > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              data-slot="pill"
              tabIndex={-1}
              className="bg-muted text-muted-foreground-strong inline-flex h-6 flex-none items-center rounded-full px-2.5 text-xs leading-none font-medium tabular-nums"
            >
              <span aria-hidden="true">+{more}</span>
              <span className="sr-only">
                {tLeads(LEADS_KEYS.list.moreInterests, { count: more, list: all })}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{all}</TooltipContent>
        </Tooltip>
      ) : null}
    </span>
  );
}
