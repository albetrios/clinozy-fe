import { useNavigate, useParams, useRouter } from '@tanstack/react-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import type { AppAction } from '@/shared/api/app/access-contracts.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { Section } from '@/shared/api/app/app-schema.ts';
import { isCommandSearchQuery } from '@/shared/api/app/command-search-api.ts';
import type { CommandSearchPerson } from '@/shared/api/app/command-search-contracts.ts';
import { setupProgress } from '@/shared/api/app/onboarding-setup-contracts.ts';
import { patientName } from '@/shared/api/app/patients-contracts.ts';
import { APP_KEYS } from '@/shared/app/app.constants.ts';
import {
  type AppCommandNavigation,
  appCommandNavigation,
} from '@/shared/app/app-command-targets.ts';
import { referrerFromPath } from '@/shared/app/app-referrer.ts';
import { APP_SECTION_ICONS } from '@/shared/app/app-section-icons.ts';
import { passesPatientFileGate } from '@/shared/app/patient-file-sections.ts';
import { setupHash } from '@/shared/components/SetupDrawer/setup-hash-grammar.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import type { AppNavEntry } from '@/shared/hooks/useAppNav/index.ts';
import { useCommandSearch } from '@/shared/hooks/useCommandSearch/index.ts';
import {
  useOnboardingSetup,
  useSetupUnfinished,
} from '@/shared/hooks/useOnboardingSetup/index.ts';
import { usePatientFile } from '@/shared/hooks/usePatientFile/index.ts';
import { useRequireOpenBranch } from '@/shared/hooks/useRequireOpenBranch/index.ts';
import { readViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { ClipboardList, Pill, UserPlus, Users } from '@/shared/icons/index.ts';

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

/**
 * The room actions — "Finish setup" is the clinic setup's own row, not a room's, and "Write
 * prescription" opens the menu's patient finder rather than a route.
 */
type ActionKey = Exclude<
  keyof typeof COMMAND_MENU_KEYS.actions,
  'finishSetup' | 'writePrescription'
>;

/** The actions "Write prescription" comes before: it follows New lead, appointment and patient. */
const AFTER_PRESCRIBE: ReadonlySet<string> = new Set([
  'action:newReceipt',
  'action:openTasks',
]);

/** Words that find "Write prescription" in any language. */
const PRESCRIBE_KEYWORDS: readonly string[] = ['rx', 'prescription', 'medicine'];

/**
 * The Actions group (H:4600), in the design's order: each is shown when the
 * role may create in its room — Open tasks when it may view Tasks — and opens
 * its form route, not just the room (D24, Q-A15; §7.3).
 */
const APP_ACTIONS: readonly {
  key: ActionKey;
  section: Section;
  grant: AppAction;
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

/** The actions that need an open branch — a manager lands on setup's step 2 without one (§6.3). */
const NEEDS_BRANCH: ReadonlySet<ActionKey> = new Set([
  'newAppointment',
  'newPatient',
  'newReceipt',
]);

/** The design's "Go to" lists every room but Today (H:4602). */
const NOT_A_GO_TO: Section = 'today';

/** The patient finder's words, while "Write prescription" holds the menu. */
export interface PrescribeMode {
  chip: string;
  /** The chip's ×. */
  leave: string;
  placeholder: string;
  hint: string;
  empty: string;
}

/** The clinic half of the command menu. */
export interface AppCommandGroups {
  /** Actions, Go to, People — the non-empty ones, in that order. */
  groups: CommandRowGroup[];
  /** The member may search people — they can open a patient file or a lead; the footer hint says how. */
  searchable: boolean;
  /** The search is waiting out its debounce or in flight. */
  isSearching: boolean;
  /** The patient finder's words while it holds the menu (feat-prescription-composer §6.1). */
  prescribe?: PrescribeMode;
}

/** What a personal workspace offers: no clinic at all. */
export const NO_APP_COMMANDS: AppCommandGroups = {
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
 * to" once typing, "People" once the contacts search takes the query (3+
 * letters, 4+ digits or a contact number; D158) — each person opening their
 * patient file, else their open lead, whichever the access in force may view.
 * Only an organization's menu calls it — a personal workspace has no clinic.
 *
 * @param navEntries The primary nav (`useAppNav`) — the rooms the access in force can reach.
 * @param go Closes the menu and navigates.
 * @param run Closes the menu and runs a command (the clinic setup's rows); runs it at once when absent.
 */
export function useAppCommandGroups({
  query,
  organizationSlug,
  navEntries,
  go,
  run = (command) => command(),
  prescribing = false,
  onPrescribe,
}: {
  query: string;
  organizationSlug: string;
  navEntries: readonly AppNavEntry[];
  go: (navigation: AppCommandNavigation) => void;
  run?: (command: () => void) => void;
  /** "Write prescription" holds the menu: patients only, each opening a new prescription. */
  prescribing?: boolean;
  /** "Write prescription": turn the menu into the patient finder (the menu stays open). */
  onPrescribe?: () => void;
}): AppCommandGroups {
  const { t } = useTranslation(COMMAND_MENU_NS);
  const navigate = useNavigate();
  const requireOpenBranch = useRequireOpenBranch();
  const { data: setup } = useOnboardingSetup();
  const setupUnfinished = useSetupUnfinished();
  // Read at the pick, not subscribed: only the page the menu opened over
  // matters, and only to the drawers that keep it behind them (`from`).
  const router = useRouter({ warn: false });
  const access = useAppAccess();
  const rooms = new Set(navEntries.map((entry) => entry.section));
  const allowed = (section: Section, grant: AppAction) =>
    access.isResolved && rooms.has(section) && access.can(section, grant);
  const opens = {
    patients: allowed('patients', 'view'),
    leads: allowed('leads', 'view'),
  };
  const searchable = opens.patients || opens.leads;
  const search = useCommandSearch(query, { enabled: searchable });
  const prescribe = usePrescribeCommands({
    // Writing a prescription: Patients in view and the file's create gate (View-as aware).
    prescribes: opens.patients && passesPatientFileGate(access, 'prescriptions'),
    prescribing,
    onPrescribe,
    query,
    organizationSlug,
    search,
    go,
  });
  if (prescribe.finder) return prescribe.finder;

  const typed = query.trim();
  const fromHere = () => referrerFromPath(router.state.location.pathname);

  const actionRows: CommandRow[] = APP_ACTIONS.filter(({ section, grant }) =>
    allowed(section, grant),
  ).map(({ key, section, testId }) => ({
    value: `action:${key}`,
    label: t(COMMAND_MENU_KEYS.actions[key]),
    sub: t(APP_KEYS.sections[section].label),
    icon: APP_SECTION_ICONS[section],
    testId,
    onSelect: () => {
      const open = () =>
        go(appCommandNavigation(key, { organizationSlug, referrer: fromHere() }));
      if (NEEDS_BRANCH.has(key)) run(() => requireOpenBranch(open));
      else open();
    },
  }));
  if (prescribe.row) withPrescribeRow(actionRows, prescribe.row);
  const shownActions = actionRows
    .filter((row) => matchesCommandQuery(row.label, row.keywords, typed))
    .slice(0, COMMAND_MENU_LIMITS.actions);
  // "Finish setup" while the clinic setup is unfinished (feat-clinic-setup KICKOFF §3), first.
  if (setup && setupUnfinished) {
    const setupRow: CommandRow = {
      value: 'action:finishSetup',
      label: t(COMMAND_MENU_KEYS.actions.finishSetup),
      sub: t(COMMAND_MENU_KEYS.setupSub, setupProgress(setup)),
      icon: ClipboardList,
      testId: 'command-palette-action-finish-setup',
      onSelect: () =>
        run(
          () =>
            void navigate({ to: '.', hash: setupHash(), search: (previous) => previous }),
        ),
    };
    if (matchesCommandQuery(setupRow.label, undefined, typed))
      shownActions.unshift(setupRow);
  }

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

  /**
   * A person: their patient file when they have one and the member views Patients — the activity
   * open on tablet and desktop, closed on a phone (H:4605, §6.6) — else their open lead when the
   * member views Leads; null when neither opens for this member.
   */
  const personRow = (hit: CommandSearchPerson): CommandRow | null => {
    const sub = (id: string) =>
      t(
        COMMAND_MENU_KEYS.personSub,
        isolateValues({ id, lastDigits: lastDigits(hit.phone) }),
      );
    if (hit.patientId && opens.patients) {
      const patientId = hit.patientId;
      return {
        value: `person:${hit.id}`,
        label: hit.name,
        sub: sub(displayId.patient(hit.patientNumber ?? 0)),
        icon: Users,
        testId: `command-palette-person-${hit.id}`,
        onSelect: () =>
          go(
            appCommandNavigation('patient', {
              organizationSlug,
              recordId: patientId,
              search: { activity: readViewportTier() === 'phone' ? 'closed' : 'open' },
            }),
          ),
      };
    }
    if (hit.openLeadId && opens.leads) {
      const leadId = hit.openLeadId;
      return {
        value: `person:${hit.id}`,
        label: hit.name,
        sub: sub(displayId.contact(hit.contactNumber)),
        icon: UserPlus,
        testId: `command-palette-person-${hit.id}`,
        onSelect: () =>
          go(appCommandNavigation('lead', { organizationSlug, recordId: leadId })),
      };
    }
    return null;
  };

  const hits = isCommandSearchQuery(typed) ? search.data : undefined;
  const groups: CommandRowGroup[] = [
    { id: 'actions', heading: t(COMMAND_MENU_KEYS.groups.actions), rows: shownActions },
    { id: 'go-to', heading: t(COMMAND_MENU_KEYS.groups.goTo), rows: goToRows },
    {
      id: 'people',
      heading: t(COMMAND_MENU_KEYS.groups.people),
      rows: (hits?.people ?? [])
        .map(personRow)
        .filter((row): row is CommandRow => row !== null),
    },
  ];

  return {
    groups: groups.filter((group) => group.rows.length > 0),
    searchable,
    isSearching: search.isSearching,
  };
}

/** The Actions row "Write prescription" — it opens the patient finder, not a route. */
function prescribeRow(t: TFunction, onPrescribe: () => void): CommandRow {
  return {
    value: 'action:writePrescription',
    label: t(COMMAND_MENU_KEYS.actions.writePrescription),
    sub: t(APP_KEYS.sections.patients.label),
    icon: Pill,
    keywords: PRESCRIBE_KEYWORDS,
    testId: 'command-palette-action-write-prescription',
    onSelect: onPrescribe,
  };
}

/** Put "Write prescription" after New lead, appointment and patient — before New receipt and Open tasks. */
function withPrescribeRow(rows: CommandRow[], row: CommandRow): void {
  const before = rows.findIndex((candidate) => AFTER_PRESCRIBE.has(candidate.value));
  rows.splice(before === -1 ? rows.length : before, 0, row);
}

/**
 * "Write prescription" in the menu (feat-prescription-composer §6.1; `BRIEF.md:6–12`): its
 * Actions row for a member who may write one, and — while it holds the menu — the patient
 * finder in place of every group: the patient file the menu opened over first ("This
 * patient" — the file's own read, already warm), then the people search's patients (a lead
 * without a file is not offered), each opening their New prescription drawer.
 */
function usePrescribeCommands({
  prescribes,
  prescribing,
  onPrescribe,
  query,
  organizationSlug,
  search,
  go,
}: {
  /** The member may write a prescription. */
  prescribes: boolean;
  prescribing: boolean;
  onPrescribe: (() => void) | undefined;
  query: string;
  organizationSlug: string;
  search: ReturnType<typeof useCommandSearch>;
  go: (navigation: AppCommandNavigation) => void;
}): { row: CommandRow | null; finder: AppCommandGroups | null } {
  const { t } = useTranslation(COMMAND_MENU_NS);
  const enabled = prescribes && prescribing;
  const { patientId: herePatientId } = useParams({ strict: false });
  const here = usePatientFile(enabled ? herePatientId : undefined).data?.patient;
  const typed = query.trim();
  if (!enabled) {
    return {
      row: prescribes && onPrescribe ? prescribeRow(t, onPrescribe) : null,
      finder: null,
    };
  }
  const people = isCommandSearchQuery(typed) ? search.data?.people : undefined;
  const row = (
    key: string,
    patient: { id: string; name: string; number: number; phone: string },
  ): CommandRow => ({
    value: `prescribe:${key}`,
    label: patient.name,
    sub: t(
      COMMAND_MENU_KEYS.personSub,
      isolateValues({
        id: displayId.patient(patient.number),
        lastDigits: lastDigits(patient.phone),
      }),
    ),
    icon: Pill,
    testId: `command-palette-prescribe-${key}`,
    onSelect: () =>
      go(
        appCommandNavigation('newPrescription', {
          organizationSlug,
          recordId: patient.id,
        }),
      ),
  });
  const herePatient = here
    ? row('this-patient', {
        id: here.id,
        name: patientName(here),
        number: here.seq,
        phone: here.phone,
      })
    : null;
  const thisPatient =
    herePatient && matchesCommandQuery(herePatient.label, undefined, typed)
      ? [herePatient]
      : [];
  const found = (people ?? []).flatMap((hit) =>
    hit.patientId && hit.patientId !== here?.id
      ? [
          row(hit.id, {
            id: hit.patientId,
            name: hit.name,
            number: hit.patientNumber ?? 0,
            phone: hit.phone,
          }),
        ]
      : [],
  );
  const groups: CommandRowGroup[] = [
    {
      id: 'this-patient',
      heading: t(COMMAND_MENU_KEYS.prescribe.thisPatient),
      rows: thisPatient,
    },
    { id: 'patients', heading: t(COMMAND_MENU_KEYS.prescribe.patients), rows: found },
  ];
  const keys = COMMAND_MENU_KEYS.prescribe;
  return {
    row: null,
    finder: {
      groups: groups.filter((group) => group.rows.length > 0),
      searchable: true,
      isSearching: search.isSearching,
      prescribe: {
        chip: t(keys.chip),
        leave: t(keys.leave),
        placeholder: t(keys.placeholder),
        hint: t(keys.hint),
        empty: t(keys.empty),
      },
    },
  };
}
