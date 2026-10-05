import { useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import type { ClinicAction } from '@/shared/api/clinic/access-contracts.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Section } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { isCommandSearchQuery } from '@/shared/api/clinic/command-search-api.ts';
import type {
  CommandSearchInvoice,
  CommandSearchLead,
  CommandSearchPatient,
} from '@/shared/api/clinic/command-search-contracts.ts';
import { CLINIC_KEYS } from '@/shared/clinic/clinic.constants.ts';
import {
  type ClinicCommandNavigation,
  clinicCommandNavigation,
} from '@/shared/clinic/clinic-command-targets.ts';
import { clinicLeadStatusKey } from '@/shared/clinic/clinic-lead-status.ts';
import { referrerFromPath } from '@/shared/clinic/clinic-referrer.ts';
import { CLINIC_SECTION_ICONS } from '@/shared/clinic/clinic-section-icons.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/picker.constants.ts';
import type { AppNavEntry } from '@/shared/hooks/useAppNav/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useCommandSearch } from '@/shared/hooks/useCommandSearch/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { readViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { Receipt, UserPlus, Users } from '@/shared/icons/index.ts';

import {
  COMMAND_MENU_KEYS,
  COMMAND_MENU_LIMITS,
  COMMAND_MENU_NS,
} from './command-palette.constants.ts';
import {
  type CommandRow,
  type CommandRowGroup,
  matchesCommandQuery,
} from './command-palette-model.ts';

type ActionKey = keyof typeof COMMAND_MENU_KEYS.actions;

/**
 * The Actions group (H:4600), in the design's order: each is shown when the
 * role may create in its room — Open tasks when it may view Tasks — and opens
 * its form route, not just the room (D24, Q-A15; §7.3).
 */
const CLINIC_ACTIONS: readonly {
  key: ActionKey;
  section: Section;
  grant: ClinicAction;
  testId: string;
}[] = [
  {
    key: 'newLead',
    section: 'leads',
    grant: 'create',
    testId: 'command-palette-action-new-lead',
  },
  {
    key: 'newAppointment',
    section: 'appointments',
    grant: 'create',
    testId: 'command-palette-action-new-appointment',
  },
  {
    key: 'newPatient',
    section: 'patients',
    grant: 'create',
    testId: 'command-palette-action-new-patient',
  },
  {
    key: 'newReceipt',
    section: 'payments',
    grant: 'create',
    testId: 'command-palette-action-new-receipt',
  },
  {
    key: 'openTasks',
    section: 'tasks',
    grant: 'view',
    testId: 'command-palette-action-open-tasks',
  },
];

/** The design's "Go to" lists every room but Today (H:4602). */
const NOT_A_GO_TO: Section = 'today';

/** The clinic half of the command menu. */
export interface ClinicCommandGroups {
  /** Actions, Go to, Patients, Leads, Invoices — the non-empty ones, in that order. */
  groups: CommandRowGroup[];
  /** The member may search Patients, Leads or Invoices — the footer hint and the empty line name them. */
  searchable: boolean;
  /** The search is waiting out its debounce or in flight. */
  isSearching: boolean;
}

/** What a personal workspace offers: no clinic at all. */
export const NO_CLINIC_COMMANDS: ClinicCommandGroups = {
  groups: [],
  searchable: false,
  isSearching: false,
};

/** A stored phone's last four digits — all the search rows show of it ("•••• 3212"). */
const lastDigits = (phone: string) => phone.replace(/\D/g, '').slice(-4);

/**
 * The command menu's clinic groups (KICKOFF §6.0; `_patterns.md:195–207`;
 * H:4598–4611), access- and View-as-aware (§3.7): a group shows only what the
 * access in force may see — the nav's rooms (module, route permission and
 * clinic View) and, for an action, Create in its room. "Actions" always, "Go
 * to" once typing, "Patients" / "Leads" / "Invoices" from two characters on
 * the schema's `commandSearch`; each capped per the design. Only an
 * organization's menu calls it — a personal workspace has no clinic.
 *
 * @param navEntries The primary nav (`useAppNav`) — the rooms the access in force can reach.
 * @param go Closes the menu and navigates.
 */
export function useClinicCommandGroups({
  query,
  organizationSlug,
  navEntries,
  go,
}: {
  query: string;
  organizationSlug: string;
  navEntries: readonly AppNavEntry[];
  go: (navigation: ClinicCommandNavigation) => void;
}): ClinicCommandGroups {
  const { t } = useTranslation(COMMAND_MENU_NS);
  // Read at the pick, not subscribed: only the page the menu opened over
  // matters, and only to the drawers that keep it behind them (`from`).
  const router = useRouter({ warn: false });
  const { formatDate } = useLocaleFormat();
  const access = useClinicAccess();
  const rooms = new Set(navEntries.map((entry) => entry.section));
  const allowed = (section: Section, grant: ClinicAction) =>
    access.isResolved && rooms.has(section) && access.can(section, grant);
  const searchFor = {
    patients: allowed('patients', 'view'),
    leads: allowed('leads', 'view'),
    invoices: allowed('payments', 'view'),
  };
  const searchable = searchFor.patients || searchFor.leads || searchFor.invoices;
  const search = useCommandSearch(query, { enabled: searchable });

  const typed = query.trim();
  const fromHere = () => referrerFromPath(router.state.location.pathname);
  const today = clinicToday();

  const actionRows: CommandRow[] = CLINIC_ACTIONS.filter(({ section, grant }) =>
    allowed(section, grant),
  )
    .map(({ key, section, testId }) => ({
      value: `action:${key}`,
      label: t(COMMAND_MENU_KEYS.actions[key]),
      sub: t(CLINIC_KEYS.sections[section].label),
      icon: CLINIC_SECTION_ICONS[section],
      testId,
      onSelect: () =>
        go(clinicCommandNavigation(key, { organizationSlug, referrer: fromHere() })),
    }))
    .filter((row) => matchesCommandQuery(row.label, undefined, typed))
    .slice(0, COMMAND_MENU_LIMITS.actions);

  const goToRows: CommandRow[] = typed
    ? navEntries
        .filter((entry) => entry.section !== NOT_A_GO_TO)
        .map((entry) => ({
          value: `go-to:${entry.id}`,
          label: t(entry.labelKey, { ns: entry.labelNs }),
          sub: t(COMMAND_MENU_KEYS.screen),
          icon: entry.icon,
          testId: `command-palette-go-to-${entry.id}`,
          onSelect: () => go({ to: entry.to, params: { organizationSlug } }),
        }))
        .filter((row) => matchesCommandQuery(row.label, undefined, typed))
        .slice(0, COMMAND_MENU_LIMITS.goTo)
    : [];

  const patientRow = (hit: CommandSearchPatient): CommandRow => ({
    value: `patient:${hit.id}`,
    label: hit.name,
    sub: t(COMMAND_MENU_KEYS.patientSub, {
      id: displayId.patient(hit.seq),
      lastDigits: lastDigits(hit.phone),
    }),
    icon: Users,
    testId: `command-palette-patient-${hit.id}`,
    // Activity open on tablet and desktop, closed on a phone (H:4605, §6.6).
    onSelect: () =>
      go(
        clinicCommandNavigation('patient', {
          organizationSlug,
          recordId: hit.id,
          search: { activity: readViewportTier() === 'phone' ? 'closed' : 'open' },
        }),
      ),
  });

  const leadRow = (hit: CommandSearchLead): CommandRow => {
    const id = displayId.lead(hit.seq);
    const statusKey = clinicLeadStatusKey(hit);
    return {
      value: `lead:${hit.id}`,
      label: hit.name,
      sub: statusKey ? t(COMMAND_MENU_KEYS.leadSub, { id, status: t(statusKey) }) : id,
      icon: UserPlus,
      testId: `command-palette-lead-${hit.id}`,
      onSelect: () =>
        go(clinicCommandNavigation('lead', { organizationSlug, recordId: hit.id })),
    };
  };

  // "Today" or "24 Sep" (the year once it is not this one) — the clinic's calendar day.
  const invoiceDay = (date: string) =>
    date === today
      ? t(PICKER_KEYS.date.today, { ns: PICKER_NS })
      : formatDate(
          localDateOf(date),
          {
            day: 'numeric',
            month: 'short',
            ...(date.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
          },
          { civilDay: true },
        );

  const invoiceRow = (hit: CommandSearchInvoice): CommandRow => {
    const day = invoiceDay(hit.date);
    return {
      value: `invoice:${hit.id}`,
      label: t(COMMAND_MENU_KEYS.invoiceTitle[hit.type], {
        id: displayId.invoiceNumber(hit.seq),
      }),
      sub: hit.personName
        ? t(COMMAND_MENU_KEYS.invoiceSub, { person: hit.personName, date: day })
        : day,
      icon: Receipt,
      testId: `command-palette-invoice-${hit.id}`,
      onSelect: () =>
        go(
          clinicCommandNavigation('invoice', {
            organizationSlug,
            recordId: hit.id,
            referrer: fromHere(),
          }),
        ),
    };
  };

  const hits = isCommandSearchQuery(typed) ? search.data : undefined;
  const groups: CommandRowGroup[] = [
    { id: 'actions', heading: t(COMMAND_MENU_KEYS.groups.actions), rows: actionRows },
    { id: 'go-to', heading: t(COMMAND_MENU_KEYS.groups.goTo), rows: goToRows },
    {
      id: 'patients',
      heading: t(COMMAND_MENU_KEYS.groups.patients),
      rows:
        searchFor.patients && hits
          ? hits.patients.slice(0, COMMAND_MENU_LIMITS.patients).map(patientRow)
          : [],
    },
    {
      id: 'leads',
      heading: t(COMMAND_MENU_KEYS.groups.leads),
      rows:
        searchFor.leads && hits
          ? hits.leads.slice(0, COMMAND_MENU_LIMITS.leads).map(leadRow)
          : [],
    },
    {
      id: 'invoices',
      heading: t(COMMAND_MENU_KEYS.groups.invoices),
      rows:
        searchFor.invoices && hits
          ? hits.invoices.slice(0, COMMAND_MENU_LIMITS.invoices).map(invoiceRow)
          : [],
    },
  ];

  return {
    groups: groups.filter((group) => group.rows.length > 0),
    searchable,
    isSearching: search.isSearching,
  };
}
