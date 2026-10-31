import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Leads room's i18n namespace. */
export const LEADS_NS = I18N_NAMESPACES.leads;

/**
 * The Leads room's keys, verbatim from `leads.md` › Copy and KICKOFF §6.3. The
 * toasts the shared leads hooks raise sit in the same namespace, declared
 * beside them (`useLeads/leads-toasts.constants.ts`); the statuses, sources and
 * interests are the shared `app` vocabulary (`APP_KEYS.leads`).
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
      unreplied: 'list.views.unreplied',
      all: 'list.views.all',
      /** The Unreplied chip, read out ("2 unreplied"). Plural. */
      unrepliedCount: 'list.views.unrepliedCount',
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
    emptyTitle: 'list.emptyTitle',
    emptyHint: 'list.emptyHint',
    clearFilters: 'list.clearFilters',
    /** The "+N" interests pill, read out with every interest. Plural. */
    moreInterests: 'list.moreInterests',
  },
  /** The Team column's hold pills and the team card's claim button (H:6151–6153). */
  team: {
    claim: 'team.claim',
    /** "Nobody holds it · anyone can claim it". */
    openHint: 'team.openHint',
    openMine: 'team.openMine',
    /** "Your hold has ended · anyone can claim it". */
    openMineHint: 'team.openMineHint',
    /** "Back to the team today at <time>". */
    releasesToday: 'team.releasesToday',
    /** "Back to the team tomorrow at <time>". */
    releasesTomorrow: 'team.releasesTomorrow',
    claimFirst: 'team.claimFirst',
    /** "Take over from <first>" — the viewer becomes the owner of a lead someone holds. */
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
    panels: 'drawer.panels',
    details: 'drawer.details',
    chat: 'drawer.chat',
    resize: 'drawer.resize',
    resizeHint: 'drawer.resizeHint',
    cards: {
      details: 'drawer.cards.details',
      progress: 'drawer.cards.progress',
      info: 'drawer.cards.info',
    },
    source: 'drawer.source',
    interests: 'drawer.interests',
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
      /** Over Booked for a member who books: the step opens the booking. */
      book: 'drawer.steps.book',
    },
    stepTips: {
      done: 'drawer.stepTips.done',
      current: 'drawer.stepTips.current',
      next: 'drawer.stepTips.next',
      /** "Clinic visited · set when they check in" — the step a member never picks (L8). */
      byCheckIn: 'drawer.stepTips.byCheckIn',
      /** "Book an appointment · moves the lead to <status>" — the step books (clinozy-be L11). */
      book: 'drawer.stepTips.book',
      /** "<status> · set when an appointment is booked" — for a member who does not book. */
      byBooking: 'drawer.stepTips.byBooking',
      /** "<status> · cancel the appointment to move back" — a booked lead's earlier steps. */
      locked: 'drawer.stepTips.locked',
    },
    /** The person's booking still to happen — its actions on the Next step card (clinozy-be L11). */
    booking: {
      reschedule: 'drawer.booking.reschedule',
      cancel: 'drawer.booking.cancel',
    },
    /**
     * The Next step card under the track (D25): the status and a headline, then Next · When ·
     * Outcome — the same four parts for every status.
     */
    nextStep: {
      aria: 'drawer.nextStep.aria',
      labels: {
        next: 'drawer.nextStep.labels.next',
        when: 'drawer.nextStep.labels.when',
        outcome: 'drawer.nextStep.labels.outcome',
      },
      headline: {
        new: 'drawer.nextStep.headline.new',
        contacted: 'drawer.nextStep.headline.contacted',
        follow_up: 'drawer.nextStep.headline.follow_up',
        no_response: 'drawer.nextStep.headline.no_response',
        appointment_scheduled: 'drawer.nextStep.headline.appointment_scheduled',
        clinic_visited: 'drawer.nextStep.headline.clinic_visited',
        not_interested: 'drawer.nextStep.headline.not_interested',
        invalid: 'drawer.nextStep.headline.invalid',
        lost: 'drawer.nextStep.headline.lost',
      },
      since: {
        created: 'drawer.nextStep.since.created',
        since: 'drawer.nextStep.since.since',
        noAnswer: 'drawer.nextStep.since.noAnswer',
      },
      actions: {
        whatsapp: 'drawer.nextStep.actions.whatsapp',
        call: 'drawer.nextStep.actions.call',
        book: 'drawer.nextStep.actions.book',
        openFile: 'drawer.nextStep.actions.openFile',
        reopen: 'drawer.nextStep.actions.reopen',
        noAnswer: 'drawer.nextStep.actions.noAnswer',
        noAnswerAgain: 'drawer.nextStep.actions.noAnswerAgain',
        more: 'drawer.nextStep.actions.more',
      },
      when: {
        notContacted: 'drawer.nextStep.when.notContacted',
        /** "They wrote <moment> · reply now". */
        replyNow: 'drawer.nextStep.when.replyNow',
        setTime: 'drawer.nextStep.when.setTime',
        /** "Next try <moment>". */
        nextTry: 'drawer.nextStep.when.nextTry',
        visited: 'drawer.nextStep.when.visited',
        closed: 'drawer.nextStep.when.closed',
        /** "<when> · <what>" — the booking still to happen. */
        booking: 'drawer.nextStep.when.booking',
        bookingPending: 'drawer.nextStep.when.bookingPending',
      },
      notes: {
        contactFirst: 'drawer.nextStep.notes.contactFirst',
        checkIn: 'drawer.nextStep.notes.checkIn',
        final: 'drawer.nextStep.notes.final',
        /** "Comes back if they check in by <date>" (clinozy-be D2). */
        winBack: 'drawer.nextStep.notes.winBack',
        never: 'drawer.nextStep.notes.never',
      },
      /** The follow-up time picker. */
      picker: {
        title: 'drawer.nextStep.picker.title',
        laterToday: 'drawer.nextStep.picker.laterToday',
        tomorrow: 'drawer.nextStep.picker.tomorrow',
        inThreeDays: 'drawer.nextStep.picker.inThreeDays',
        nextWeek: 'drawer.nextStep.picker.nextWeek',
        date: 'drawer.nextStep.picker.date',
        time: 'drawer.nextStep.picker.time',
        cancel: 'drawer.nextStep.picker.cancel',
        set: 'drawer.nextStep.picker.set',
      },
    },
    info: {
      created: 'drawer.info.created',
      /** The person's latest activity, on any record. */
      lastActivity: 'drawer.info.lastActivity',
      /** When the lead last closed — shown on a closed lead only. */
      closed: 'drawer.info.closed',
      none: 'drawer.info.none',
      patient: 'drawer.info.patient',
      linked: 'drawer.info.linked',
      notYet: 'drawer.info.notYet',
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
      involved: 'drawer.popover.involved',
      noMatch: 'drawer.popover.noMatch',
      note: 'drawer.popover.note',
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
      instagramDm: 'newLead.presets.instagramDm',
    },
    presetHints: {
      walkIn: 'newLead.presetHints.walkIn',
      instagramDm: 'newLead.presetHints.instagramDm',
    },
    hits: {
      /** "Patient · <C-id> · <mobile>" — a person with a patient file. */
      patient: 'newLead.hits.patient',
      /** "<C-id> · <mobile>". */
      contact: 'newLead.hits.contact',
      /** "Open lead · <C-id> · <mobile>" — a person with an open lead. */
      openLead: 'newLead.hits.openLead',
      /** The action of a person with an open lead: "Open lead". */
      open: 'newLead.hits.open',
      recreate: 'newLead.hits.recreate',
    },
    /** " · +<n> more". Plural. */
    more: 'newLead.more',
    change: 'newLead.change',
    changeTitle: 'newLead.changeTitle',
    afterContact: 'newLead.afterContact',
    detailsSummary: 'newLead.detailsSummary',
    footer: 'newLead.footer',
    create: 'newLead.create',
    toasts: {
      pickFirst: 'newLead.toasts.pickFirst',
      /** "<preset> preset applied". */
      presetApplied: 'newLead.toasts.presetApplied',
      /** "Existing patient <C-id> · the new lead is theirs". */
      existingPatient: 'newLead.toasts.existingPatient',
      /** "Using existing contact <name>". */
      existingContact: 'newLead.toasts.existingContact',
      missing: 'newLead.toasts.missing',
      /** The "Open" of a 409's toast: the person's open lead. */
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
  /** The phone's Details · Chat switch: `lead-drawer-panes-tabs`, `-tab-details`, `-tab-chat`. */
  drawerPanes: 'lead-drawer-panes',
  drawerSave: 'lead-drawer-save',
  drawerRemove: 'lead-drawer-remove',
  drawerPeople: 'lead-drawer-people',
  drawerResize: 'lead-drawer-resize',
  /** The Progress track's steps: `lead-drawer-step-<status>`. */
  drawerStep: 'lead-drawer-step',
  /** The booking still to happen on Progress, and its `-reschedule` and `-cancel`. */
  drawerBooking: 'lead-drawer-booking',
  /**
   * The Next step card (D25): `lead-drawer-next-step`, its `-when`, `-book`, `-whatsapp`, `-call`,
   * `-reopen`, `-open-file`, `-more`; an outcome `lead-drawer-outcome-<status>`.
   */
  drawerNextStep: 'lead-drawer-next-step',
  drawerOutcome: 'lead-drawer-outcome',
  /** The follow-up time picker: `lead-drawer-follow-up`, its `-pick-<id>` and `-set`. */
  drawerFollowUp: 'lead-drawer-follow-up',
  /** New lead — the drawer's own parts derive theirs from it (`new-lead-drawer-save` …). */
  newLead: 'new-lead-drawer',
  /** The root of the contact picker's own ids (`new-lead-contact-recent`, `-quick-add-name` …). */
  newLeadContact: 'new-lead-contact',
  newLeadSearch: 'new-lead-search',
  newLeadPreset: 'new-lead-preset',
  newLeadHit: 'new-lead-hit',
  newLeadNoMatch: 'new-lead-no-match',
  newLeadNewContact: 'new-lead-new-contact',
  newLeadChange: 'new-lead-change',
} as const;
