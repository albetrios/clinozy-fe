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
  /** The lead drawer (KICKOFF §6.3; `leads.md:124–136`, H:1752–1867). */
  drawer: {
    title: 'drawer.title',
    sub: 'drawer.sub',
    /** "Lead #<seq> · created <created> · click to copy". */
    idTooltip: 'drawer.idTooltip',
    idAria: 'drawer.idAria',
    idCopied: 'drawer.idCopied',
    retarget: 'drawer.retarget',
    close: 'drawer.close',
    panels: 'drawer.panels',
    details: 'drawer.details',
    chat: 'drawer.chat',
    /** "<n> new" — the Chat segment's count while Details shows. */
    chatCount: 'drawer.chatCount',
    resize: 'drawer.resize',
    resizeHint: 'drawer.resizeHint',
    cards: {
      details: 'drawer.cards.details',
      progress: 'drawer.cards.progress',
      info: 'drawer.cards.info',
    },
    source: 'drawer.source',
    interests: 'drawer.interests',
    addInterest: 'drawer.addInterest',
    people: 'drawer.people',
    peopleAria: 'drawer.peopleAria',
    addInvolved: 'drawer.addInvolved',
    claim: 'drawer.claim',
    release: 'drawer.release',
    releaseHint: 'drawer.releaseHint',
    progressAria: 'drawer.progressAria',
    steps: {
      done: 'drawer.steps.done',
      current: 'drawer.steps.current',
      next: 'drawer.steps.next',
    },
    stepTips: {
      done: 'drawer.stepTips.done',
      current: 'drawer.stepTips.current',
      next: 'drawer.stepTips.next',
    },
    closeAs: 'drawer.closeAs',
    info: {
      created: 'drawer.info.created',
      lastMessage: 'drawer.info.lastMessage',
      /** "<channel> · <at>". */
      lastMessageValue: 'drawer.info.lastMessageValue',
      none: 'drawer.info.none',
      patient: 'drawer.info.patient',
      linked: 'drawer.info.linked',
      notYet: 'drawer.info.notYet',
      convert: 'drawer.info.convert',
      openTasks: 'drawer.info.openTasks',
      retargetReason: 'drawer.info.retargetReason',
    },
    footer: {
      remove: 'drawer.footer.remove',
      discard: 'drawer.footer.discard',
      save: 'drawer.footer.save',
    },
    popover: {
      title: 'drawer.popover.title',
      search: 'drawer.popover.search',
      assignedTo: 'drawer.popover.assignedTo',
      assign: 'drawer.popover.assign',
      assigned: 'drawer.popover.assigned',
      currentlyAssigned: 'drawer.popover.currentlyAssigned',
      assignTo: 'drawer.popover.assignTo',
      onlyAssignee: 'drawer.popover.onlyAssignee',
      cantAssign: 'drawer.popover.cantAssign',
      involved: 'drawer.popover.involved',
      noMatch: 'drawer.popover.noMatch',
      note: 'drawer.popover.note',
      /** "<role> · <presence>". */
      roleLine: 'drawer.popover.roleLine',
    },
    presence: {
      online: 'drawer.presence.online',
      away: 'drawer.presence.away',
      busy: 'drawer.presence.busy',
      offline: 'drawer.presence.offline',
    },
    remove: {
      title: 'drawer.remove.title',
      effect: 'drawer.remove.effect',
      reasons: {
        duplicate: 'drawer.remove.reasons.duplicate',
        testEntry: 'drawer.remove.reasons.testEntry',
        spam: 'drawer.remove.reasons.spam',
        other: 'drawer.remove.reasons.other',
      },
      /** "Lead #<seq> removed · <reason>". */
      removed: 'drawer.remove.removed',
    },
    toasts: {
      /** "Claimed by <me> after <n> idle days · <owner> stays involved". Plural. */
      claimedAfter: 'drawer.toasts.claimedAfter',
      /** "<name> is open for anyone to claim". */
      releasedOpen: 'drawer.toasts.releasedOpen',
      addedInvolved: 'drawer.toasts.addedInvolved',
      removedInvolved: 'drawer.toasts.removedInvolved',
    },
  },
  /** New lead (KICKOFF §6.3; `leads.md:75–90, 138–150, 246–262`, H:1883–1961). */
  newLead: {
    title: 'newLead.title',
    sub: 'newLead.sub',
    contact: 'newLead.contact',
    search: 'newLead.search',
    searchAria: 'newLead.searchAria',
    quickStart: 'newLead.quickStart',
    presets: {
      walkIn: 'newLead.presets.walkIn',
      phoneCall: 'newLead.presets.phoneCall',
      instagramDm: 'newLead.presets.instagramDm',
    },
    presetHints: {
      walkIn: 'newLead.presetHints.walkIn',
      phoneCall: 'newLead.presetHints.phoneCall',
      instagramDm: 'newLead.presetHints.instagramDm',
    },
    hits: {
      /** "Patient <id> · last visit <date>". */
      patient: 'newLead.hits.patient',
      /** "Patient <id>" — before the first visit. */
      patientNew: 'newLead.hits.patientNew',
      /** "Lead <id> · <mobile>". */
      lead: 'newLead.hits.lead',
      /** "Contact · <mobile>" — a chat-only person. */
      contact: 'newLead.hits.contact',
      /** "Today" — a last visit today. */
      today: 'newLead.hits.today',
      recreate: 'newLead.hits.recreate',
      useContact: 'newLead.hits.useContact',
    },
    noMatch: 'newLead.noMatch',
    /** " · +<n> more". Plural. */
    more: 'newLead.more',
    change: 'newLead.change',
    changeTitle: 'newLead.changeTitle',
    afterContact: 'newLead.afterContact',
    detailsSummary: 'newLead.detailsSummary',
    footer: 'newLead.footer',
    create: 'newLead.create',
    /** "Linked to <name> · <kind> · channels and preferences reused". */
    linked: 'newLead.linked',
    toasts: {
      pickFirst: 'newLead.toasts.pickFirst',
      /** "<preset> preset applied". */
      presetApplied: 'newLead.toasts.presetApplied',
      /** "Existing patient <id> · new lead will be linked". */
      existingPatient: 'newLead.toasts.existingPatient',
      /** "Using existing contact <name>". */
      existingContact: 'newLead.toasts.existingContact',
      missing: 'newLead.toasts.missing',
      /** "This mobile is already on lead <id>" — a 409, with "Open". */
      duplicate: 'newLead.toasts.duplicate',
      open: 'newLead.toasts.open',
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
  drawer: 'lead-drawer',
  drawerChat: 'lead-drawer-chat',
  drawerSave: 'lead-drawer-save',
  drawerRemove: 'lead-drawer-remove',
  drawerPeople: 'lead-drawer-people',
  drawerResize: 'lead-drawer-resize',
  /** New lead — the drawer's own parts derive theirs from it (`new-lead-drawer-save` …). */
  newLead: 'new-lead-drawer',
  newLeadSearch: 'new-lead-search',
  newLeadPreset: 'new-lead-preset',
  newLeadHit: 'new-lead-hit',
  newLeadNoMatch: 'new-lead-no-match',
  newLeadNewContact: 'new-lead-new-contact',
  newLeadChange: 'new-lead-change',
} as const;
