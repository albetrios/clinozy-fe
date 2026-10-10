import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The shared clinic vocabulary namespace — section names, roles, statuses. */
export const CLINIC_NS = I18N_NAMESPACES.clinic;

/** Keys in the `clinic` namespace (every value verbatim from the design). */
export const CLINIC_KEYS = {
  sections: {
    today: { label: 'sections.today.label', description: 'sections.today.description' },
    leads: { label: 'sections.leads.label', description: 'sections.leads.description' },
    appointments: {
      label: 'sections.appointments.label',
      description: 'sections.appointments.description',
    },
    patients: {
      label: 'sections.patients.label',
      description: 'sections.patients.description',
    },
    medical: {
      label: 'sections.medical.label',
      description: 'sections.medical.description',
    },
    stock: { label: 'sections.stock.label', description: 'sections.stock.description' },
    payments: {
      label: 'sections.payments.label',
      description: 'sections.payments.description',
    },
    tasks: { label: 'sections.tasks.label', description: 'sections.tasks.description' },
    offerings: {
      label: 'sections.offerings.label',
      description: 'sections.offerings.description',
    },
    users: { label: 'sections.users.label', description: 'sections.users.description' },
  },
  /** Each tone's name — a colour swatch's accessible name (the drawers' Colour fields). */
  tones: {
    butter: 'tones.butter',
    lav: 'tones.lav',
    sky: 'tones.sky',
    sage: 'tones.sage',
    blush: 'tones.blush',
    mint: 'tones.mint',
    peach: 'tones.peach',
    plum: 'tones.plum',
    lime: 'tones.lime',
    slate: 'tones.slate',
    stone: 'tones.stone',
  },
  roles: {
    admin: 'roles.admin',
    doctor: 'roles.doctor',
    therapist: 'roles.therapist',
    front_desk: 'roles.front_desk',
    counsellor: 'roles.counsellor',
    pharmacist: 'roles.pharmacist',
    accountant: 'roles.accountant',
    marketing: 'roles.marketing',
    owner: 'roles.owner',
  },
  /**
   * The leads domain's stored statuses (`S:1063–1073`), labelled as the design
   * shows them — the Leads room's pills and tracker, the appointment form's
   * connected lead and the status toast `useUpdateLead` raises.
   */
  leads: {
    statuses: {
      new: 'leads.statuses.new',
      contacted: 'leads.statuses.contacted',
      follow_up: 'leads.statuses.follow_up',
      clinic_visited: 'leads.statuses.clinic_visited',
      no_response: 'leads.statuses.no_response',
      not_interested: 'leads.statuses.not_interested',
      invalid: 'leads.statuses.invalid',
      lost: 'leads.statuses.lost',
    },
    /**
     * "Re-targeted": a re-target lead still New — a label, not a stored status
     * (D22, `S:1066, 1100`); `clinicLeadStatusKey` picks it.
     */
    retargeted: 'leads.retargeted',
    /**
     * Where a lead came from — the contract's seven and the plan's "Phone call"
     * (`LEAD_RECORD_SOURCE_VALUES`): the chat column's "via <source>" line.
     */
    sources: {
      instagram: 'leads.sources.instagram',
      google: 'leads.sources.google',
      whatsapp: 'leads.sources.whatsapp',
      facebook: 'leads.sources.facebook',
      walk_in: 'leads.sources.walk_in',
      referral: 'leads.sources.referral',
      retarget: 'leads.sources.retarget',
      phone_call: 'leads.sources.phone_call',
    },
    /** What a lead is interested in — the contract's six (`S:1086–1094`); "Others" is no chip. */
    interests: {
      others: 'leads.interests.others',
      clinical: 'leads.interests.clinical',
      peel: 'leads.interests.peel',
      lhr: 'leads.interests.lhr',
      hydrafacial: 'leads.interests.hydrafacial',
      prp: 'leads.interests.prp',
    },
  },
  /**
   * A room list's load failure (KICKOFF §6.0 List error): the toast that keeps
   * the last copy on screen, with "Retry" — every room's, through
   * `useListLoadError`.
   */
  lists: {
    loadError: 'lists.loadError',
    retry: 'lists.retry',
  },
  /**
   * The one time rule's words (`useClinicClock`): a day and a clock time
   * together — "Yesterday 10:30 am", "Mon 10:30 am". The day words are the
   * app's one set (`PICKER_KEYS.date`, `common`).
   */
  clock: {
    /** "Today 11:30 am". */
    todayTime: 'clock.todayTime',
    dayTime: 'clock.dayTime',
  },
  /**
   * The contract's enum labels the rooms share (`schema-routes.md` › Enums,
   * labels verbatim): what the chat column's history and the rooms' pills
   * name a stored value. An appointment's status is the appointments domain's
   * (`appointments.statuses`).
   */
  channels: {
    whatsapp: 'channels.whatsapp',
    call: 'channels.call',
    sms: 'channels.sms',
    instagram: 'channels.instagram',
    email: 'channels.email',
    note: 'channels.note',
  },
  checkInFeels: {
    much_better: 'checkInFeels.much_better',
    better: 'checkInFeels.better',
    same: 'checkInFeels.same',
    worse: 'checkInFeels.worse',
  },
  reviewSources: {
    google: 'reviewSources.google',
    video: 'reviewSources.video',
    instagram: 'reviewSources.instagram',
    internal_form: 'reviewSources.internal_form',
    whatsapp: 'reviewSources.whatsapp',
  },
  paymentModes: {
    cash: 'paymentModes.cash',
    upi: 'paymentModes.upi',
    card: 'paymentModes.card',
    credit: 'paymentModes.credit',
  },
  invoiceTypes: {
    clinic: 'invoiceTypes.clinic',
    medical: 'invoiceTypes.medical',
    consultation: 'invoiceTypes.consultation',
  },
  /** An invoice's status pill (`S:621`, `pyStatus` H:3633): "Paid", "Partly paid", "Due". */
  invoiceStatuses: {
    paid: 'invoiceStatuses.paid',
    partial: 'invoiceStatuses.partial',
    unpaid: 'invoiceStatuses.unpaid',
  },
  /** The contract's `expense_category` (`S:1388–1398`): the ledger's sub line, Send payment's chips. */
  expenseCategories: {
    medicines: 'expenseCategories.medicines',
    consumables: 'expenseCategories.consumables',
    salary: 'expenseCategories.salary',
    rent: 'expenseCategories.rent',
    marketing: 'expenseCategories.marketing',
    utilities: 'expenseCategories.utilities',
    maintenance: 'expenseCategories.maintenance',
    misc: 'expenseCategories.misc',
  },
  taskOutcomes: {
    log_check_in: 'taskOutcomes.log_check_in',
    doing_well: 'taskOutcomes.doing_well',
    no_answer: 'taskOutcomes.no_answer',
    happy: 'taskOutcomes.happy',
    done: 'taskOutcomes.done',
  },
  /**
   * The appointments domain, shared by Appointments, Today, the patient file,
   * Tasks and the appointment form wherever it is stacked: the status machine's
   * words (`appointment-status.ts` — statuses, the popover's moves and reason
   * lines, the guards, the card's next steps, the form's tiles and hint lines,
   * the cancel reasons, `appointments.md` › Copy) and the toasts
   * `useAppointments` raises.
   */
  appointments: {
    statuses: {
      scheduled: 'appointments.statuses.scheduled',
      confirmed: 'appointments.statuses.confirmed',
      checked_in: 'appointments.statuses.checked_in',
      completed: 'appointments.statuses.completed',
      cancelled: 'appointments.statuses.cancelled',
      no_show: 'appointments.statuses.no_show',
    },
    /** The popover's two moves that are not a status label: "Move to another time", "Cancel". */
    moves: {
      reschedule: 'appointments.moves.reschedule',
      cancelled: 'appointments.moves.cancelled',
    },
    /** Each option's reason line (`AP_WHY`, H:3423). */
    moveHints: {
      scheduled: 'appointments.moveHints.scheduled',
      confirmed: 'appointments.moveHints.confirmed',
      checked_in: 'appointments.moveHints.checked_in',
      completed: 'appointments.moveHints.completed',
      reschedule: 'appointments.moveHints.reschedule',
      cancelled: 'appointments.moveHints.cancelled',
      no_show: 'appointments.moveHints.no_show',
    },
    /** A guarded move's words; `{{day}}` and `{{time}}` are the booking's. */
    guards: {
      final: 'appointments.guards.final',
      visitDay: 'appointments.guards.visitDay',
      beforeStart: 'appointments.guards.beforeStart',
      needsPatient: 'appointments.guards.needsPatient',
    },
    nextActions: {
      check_in: 'appointments.nextActions.check_in',
      confirm: 'appointments.nextActions.confirm',
      complete: 'appointments.nextActions.complete',
      rebook: 'appointments.nextActions.rebook',
    },
    /** The form tiles' tooltips when not on offer. */
    tiles: {
      booked: 'appointments.tiles.booked',
      said_yes: 'appointments.tiles.said_yes',
      visit_day: 'appointments.tiles.visit_day',
      after_check_in: 'appointments.tiles.after_check_in',
    },
    /** The hint line under the tiles (`appointments.md:376`); `closed` takes `{{status}}`. */
    hints: {
      scheduled: 'appointments.hints.scheduled',
      confirmed: 'appointments.hints.confirmed',
      checked_in: 'appointments.hints.checked_in',
      completed: 'appointments.hints.completed',
      needs_patient: 'appointments.hints.needs_patient',
      cancelled: 'appointments.hints.cancelled',
      closed: 'appointments.hints.closed',
    },
    /** The API's `cancel_reason` — the contract's five (D32) and two of the form's. */
    cancelReasons: {
      patient_asked: 'appointments.cancelReasons.patient_asked',
      unreachable: 'appointments.cancelReasons.unreachable',
      doctor_unavailable: 'appointments.cancelReasons.doctor_unavailable',
      resource_unavailable: 'appointments.cancelReasons.resource_unavailable',
      rescheduling_later: 'appointments.cancelReasons.rescheduling_later',
      booked_by_mistake: 'appointments.cancelReasons.booked_by_mistake',
      other: 'appointments.cancelReasons.other',
    },
    cancelSides: {
      patient: 'appointments.cancelSides.patient',
      clinic: 'appointments.cancelSides.clinic',
    },
    /**
     * The cancel confirm (`appointments.md:211–225`): the form's Cancel visit
     * and the popover's "Other", which needs a note (A-A3).
     */
    cancelConfirm: {
      title: 'appointments.cancelConfirm.title',
      /** The grey record pill: "<name> · <service>". */
      record: 'appointments.cancelConfirm.record',
      effect: 'appointments.cancelConfirm.effect',
      action: 'appointments.cancelConfirm.action',
    },
    /** The form's Cancel visit reasons (`cancelReasonToContract` stores them). */
    formCancelReasons: {
      patient_cancelled: 'appointments.formCancelReasons.patient_cancelled',
      rescheduling_later: 'appointments.formCancelReasons.rescheduling_later',
      doctor_unavailable: 'appointments.formCancelReasons.doctor_unavailable',
      booked_by_mistake: 'appointments.formCancelReasons.booked_by_mistake',
      other: 'appointments.formCancelReasons.other',
    },
    toasts: {
      booked: 'appointments.toasts.booked',
      bookedQueued: 'appointments.toasts.bookedQueued',
      /** Booked, and the server sent the person nothing yet. */
      bookedOnly: 'appointments.toasts.bookedOnly',
      moved: 'appointments.toasts.moved',
      /** Moved, and the server sent the person nothing yet. */
      movedOnly: 'appointments.toasts.movedOnly',
      updated: 'appointments.toasts.updated',
      statusChanged: 'appointments.toasts.statusChanged',
      statusConfirmed: 'appointments.toasts.statusConfirmed',
      statusCancelled: 'appointments.toasts.statusCancelled',
      cancelled: 'appointments.toasts.cancelled',
      restored: 'appointments.toasts.restored',
    },
  },
  /**
   * The patients domain's stored enums (`S:1171–1204`), labelled as the design
   * shows them (`patients.md:28`, H:3655) — the Patients room's badges and
   * filters, the patient drawer's chips (wherever it is stacked) and the
   * patient file. Gender and consent labels are the person card's
   * (`PERSON_CARD_KEYS.gender` / `.consent`).
   */
  patients: {
    types: {
      aesthetic: 'patients.types.aesthetic',
      clinical: 'patients.types.clinical',
      lhr: 'patients.types.lhr',
      dental: 'patients.types.dental',
      physio: 'patients.types.physio',
      gynac: 'patients.types.gynac',
    },
    statuses: {
      new: 'patients.statuses.new',
      regular: 'patients.statuses.regular',
      vip: 'patients.statuses.vip',
      inactive: 'patients.statuses.inactive',
    },
    conversions: {
      converted: 'patients.conversions.converted',
      not_converted: 'patients.conversions.not_converted',
    },
    /** The drawer's Referrer type chips (`referral_source`, `S:1195`). */
    referralSources: {
      patient: 'patients.referralSources.patient',
      doctor: 'patients.referralSources.doctor',
      instagram: 'patients.referralSources.instagram',
      google: 'patients.referralSources.google',
      walk_in: 'patients.referralSources.walk_in',
      other: 'patients.referralSources.other',
    },
  },
  /** The D18 Visit as a record — "Visit not found" for a link to one that is gone. */
  visits: {
    record: 'visits.record',
  },
  /**
   * The offerings domain, shared by the Offerings room, the Invoice drawer and
   * the booking drawer: the stored enums' labels (`S:1330, 1349`; the derived
   * offer state, `live` = "Running") and the toasts its writes raise
   * (`offerings.md` › States).
   */
  offerings: {
    categories: {
      consultation: 'offerings.categories.consultation',
      treatment: 'offerings.categories.treatment',
      package: 'offerings.categories.package',
      lhr: 'offerings.categories.lhr',
      product: 'offerings.categories.product',
    },
    /** The stored specialties (`OF_SPECS`, H:3547; Q-O6) — the booking's "From offerings" rows. */
    specialties: {
      skin: 'offerings.specialties.skin',
      hair: 'offerings.specialties.hair',
      dental: 'offerings.specialties.dental',
      gynac: 'offerings.specialties.gynac',
      physio: 'offerings.specialties.physio',
      general: 'offerings.specialties.general',
    },
    offerKinds: {
      percent: 'offerings.offerKinds.percent',
      amount: 'offerings.offerKinds.amount',
      fixed: 'offerings.offerKinds.fixed',
      extra: 'offerings.offerKinds.extra',
    },
    offerStates: {
      live: 'offerings.offerStates.live',
      scheduled: 'offerings.offerStates.scheduled',
      paused: 'offerings.offerStates.paused',
      ended: 'offerings.offerStates.ended',
    },
    toasts: {
      offeringCreated: 'offerings.toasts.offeringCreated',
      offeringSaved: 'offerings.toasts.offeringSaved',
      offeringRemoved: 'offerings.toasts.offeringRemoved',
      offerCreated: 'offerings.toasts.offerCreated',
      offerSaved: 'offerings.toasts.offerSaved',
      offerRemoved: 'offerings.toasts.offerRemoved',
      offerPaused: 'offerings.toasts.offerPaused',
      offerResumed: 'offerings.toasts.offerResumed',
    },
  },
} as const;
