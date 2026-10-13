import { useTranslation } from 'react-i18next';

import { LEAD_STATUS_VALUES } from '@/shared/api/app/app-schema.ts';
import type { DirectoryMember } from '@/shared/api/app/directory-api.ts';
import type { LeadView } from '@/shared/api/app/leads-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { LEAD_SOURCE_TONES, LEAD_STATUS_TONES } from '@/shared/app/app-tones.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import {
  type RoomFilterCopy,
  RoomToolbar,
  RoomViewTabs,
} from '@/shared/components/RoomToolbar/index.ts';

import { LEADS_KEYS, LEADS_NS, LEADS_TABLE_ID } from '../../leads.constants.ts';
import { LEAD_SOURCE_ICONS, LEAD_SOURCE_ORDER } from '../LeadFields/index.ts';
import type { LeadsTableInstance } from '../LeadsTable/index.ts';
import { LEADS_FILTER_FIELDS } from './leads-filter-fields.ts';

/** The views in order (`leads.md:42`). */
const VIEWS = ['mine', 'unreplied', 'all'] as const satisfies readonly LeadView[];

/** The view tabs' labels. */
const VIEW_KEYS = {
  mine: LEADS_KEYS.list.views.mine,
  unreplied: LEADS_KEYS.list.views.unreplied,
  all: LEADS_KEYS.list.views.all,
} as const satisfies Record<LeadView, string>;

/** Props for {@link LeadsToolbar}. */
export interface LeadsToolbarProps {
  view: LeadView;
  onViewChange: (view: LeadView) => void;
  /** The Unreplied tab's count chip (hidden at 0). */
  unreplied: number;
  /** The team the Team filter lists. */
  members: readonly DirectoryMember[];
  /** The table the Columns chooser drives. */
  table: LeadsTableInstance;
  /** "New lead" shows only with Create on Leads (`leads.md:7`). */
  canCreate: boolean;
  onNewLead: () => void;
}

/** The Filters' copy: the statuses, sources and hold chips in their tones; the team. */
function useFilterCopy(
  members: readonly DirectoryMember[],
): Record<string, RoomFilterCopy> {
  const { t } = useTranslation(LEADS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const keys = LEADS_KEYS.filters;
  return {
    status: {
      label: t(keys.status),
      options: Object.fromEntries(
        LEAD_STATUS_VALUES.map((status) => [
          status,
          {
            label: tApp(APP_KEYS.leads.statuses[status]),
            tone: LEAD_STATUS_TONES[status],
          },
        ]),
      ),
    },
    source: {
      label: t(keys.source),
      clearLabel: t(keys.clear),
      options: Object.fromEntries(
        LEAD_SOURCE_ORDER.map((source) => [
          source,
          {
            label: tApp(APP_KEYS.leads.sources[source]),
            tone: LEAD_SOURCE_TONES[source],
            icon: LEAD_SOURCE_ICONS[source],
          },
        ]),
      ),
    },
    hold: {
      label: t(keys.hold.label),
      anyLabel: t(keys.hold.any),
      // `holdChips` (H:5621): Open to claim butter, Releasing today blush, Held sage.
      options: {
        open: { label: t(keys.hold.open), tone: 'butter' },
        soon: { label: t(keys.hold.soon), tone: 'blush' },
        held: { label: t(keys.hold.held), tone: 'sage' },
      },
    },
    member: {
      label: t(keys.team.label),
      clearLabel: t(keys.clear),
      options: {},
      people: {
        members: members.map((member) => ({
          id: member.id,
          name: member.name,
          initials: member.initials,
          tone: member.tone,
          role: '',
        })),
        anyone: t(keys.team.anyone),
        count: (count) => t(keys.team.count, { count }),
        search: t(keys.team.search),
        noMatch: t(keys.team.noMatch),
      },
    },
  };
}

/**
 * The Leads toolbar (KICKOFF §6.3 Toolbar; `leads.md:17`): "Leads" with its
 * hairline · the views Mine · Unreplied (a count chip) · All · search · Filters
 * · Columns · "New lead". On a phone the search has row 1 to itself and row 2
 * holds the views with Filters at its end; "New lead" floats (H:83–88).
 */
export function LeadsToolbar({
  view,
  onViewChange,
  unreplied,
  members,
  table,
  canCreate,
  onNewLead,
}: LeadsToolbarProps) {
  const { t } = useTranslation(LEADS_NS);
  const copy = useFilterCopy(members);
  return (
    <RoomToolbar
      title={t(LEADS_KEYS.manifest.title)}
      tableId={LEADS_TABLE_ID}
      layout="leads"
      tabs={
        <RoomViewTabs
          label={t(LEADS_KEYS.list.views.label)}
          value={view}
          onValueChange={(next) => {
            const picked = VIEWS.find((entry) => entry === next);
            if (picked) onViewChange(picked);
          }}
          testIdPrefix={LEADS_TABLE_ID}
          tabs={VIEWS.map((entry) => ({
            id: entry,
            label: t(VIEW_KEYS[entry]),
            badge:
              entry === 'unreplied' && unreplied > 0 ? (
                <>
                  <span
                    aria-hidden="true"
                    className="bg-tone-lav-border text-foreground text-tiny min-w-4 rounded-md px-1.25 text-center leading-[1.45] tabular-nums"
                  >
                    {unreplied}
                  </span>
                  <span className="sr-only">
                    {t(LEADS_KEYS.list.views.unrepliedCount, { count: unreplied })}
                  </span>
                </>
              ) : undefined,
          }))}
        />
      }
      search={{
        placeholder: t(LEADS_KEYS.list.search.placeholder),
        label: t(LEADS_KEYS.list.search.label),
      }}
      filters={{ fields: LEADS_FILTER_FIELDS, copy, savedViews: false }}
      columns={<DataTableColumnChooser table={table} tableId={LEADS_TABLE_ID} />}
      primary={
        canCreate
          ? {
              action: {
                id: 'new-lead',
                label: t(LEADS_KEYS.list.newLead),
                onSelect: onNewLead,
              },
            }
          : undefined
      }
    />
  );
}
