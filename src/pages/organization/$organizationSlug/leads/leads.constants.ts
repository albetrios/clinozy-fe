import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Leads room's i18n namespace. */
export const LEADS_NS = I18N_NAMESPACES.leads;

/**
 * The Leads room's keys, verbatim from `leads.md` › Copy and KICKOFF §6.3. The
 * toasts the shared leads hooks raise sit in the same namespace, declared
 * beside them (`useLeads/leads-toasts.constants.ts`); the statuses, sources and
 * interests are the shared `clinic` vocabulary (`CLINIC_KEYS.leads`).
 */
export const LEADS_KEYS = {
  manifest: { title: 'manifest.title' },
  /** The record's name in "Lead not found · it may have been deleted" (`S:115`). */
  record: 'record',
  list: {
    /** The plural noun of "Loading more leads" / "All leads loaded". */
    records: 'list.records',
    views: {
      label: 'list.views.label',
      mine: 'list.views.mine',
      unread: 'list.views.unread',
      all: 'list.views.all',
      /** The Unreplied chip, read out ("2 unreplied"). Plural. */
      unreadCount: 'list.views.unreadCount',
    },
    search: {
      placeholder: 'list.search.placeholder',
      label: 'list.search.label',
    },
    newLead: 'list.newLead',
    columns: {
      lead: 'list.columns.lead',
      status: 'list.columns.status',
      source: 'list.columns.source',
      interests: 'list.columns.interests',
      team: 'list.columns.team',
      updated: 'list.columns.updated',
    },
    empty: 'list.empty',
    clearFilters: 'list.clearFilters',
    /** The "+N" interests pill, read out with every interest. Plural. */
    moreInterests: 'list.moreInterests',
    /** "Updated" as the prototype words it (H:6149). Plurals but `justNow`, `yesterday`. */
    updated: {
      justNow: 'list.updated.justNow',
      minutes: 'list.updated.minutes',
      hours: 'list.updated.hours',
      yesterday: 'list.updated.yesterday',
      days: 'list.updated.days',
      weeks: 'list.updated.weeks',
    },
  },
  /** The Team column's hold pills and the team card's take-over button (H:6151–6153). */
  team: {
    claim: 'team.claim',
    join: 'team.join',
    openMine: 'team.openMine',
    /** "No activity for <n> days · anyone can claim it". Plural. */
    claimHint: 'team.claimHint',
    joinHint: 'team.joinHint',
    releasesToday: 'team.releasesToday',
    releasesTomorrow: 'team.releasesTomorrow',
    claimFirst: 'team.claimFirst',
    joinTake: 'team.joinTake',
    takeOver: 'team.takeOver',
  },
  filters: {
    status: 'filters.status',
    source: 'filters.source',
    clear: 'filters.clear',
    hold: {
      label: 'filters.hold.label',
      any: 'filters.hold.any',
      open: 'filters.hold.open',
      soon: 'filters.hold.soon',
      held: 'filters.hold.held',
    },
    team: {
      label: 'filters.team.label',
      anyone: 'filters.team.anyone',
      /** "<n> people". Plural. */
      count: 'filters.team.count',
      search: 'filters.team.search',
      noMatch: 'filters.team.noMatch',
    },
  },
} as const;

/** The Leads room's table id — prefixes its list's and toolbar's test ids, and keys its Columns choice. */
export const LEADS_TABLE_ID = 'leads';

/** `data-testid`s the Leads room adds beyond the shared table's and toolbar's. */
export const LEADS_TEST_IDS = {
  empty: 'leads-empty',
  claim: 'leads-claim',
  holdDot: 'leads-hold-dot',
} as const;
