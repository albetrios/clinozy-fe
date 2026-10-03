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
  },
  /**
   * The contract's enum labels the rooms share (`schema-routes.md` › Enums,
   * labels verbatim): what the chat column's history and the rooms' pills
   * name a stored value.
   */
  appointmentStatuses: {
    scheduled: 'appointmentStatuses.scheduled',
    confirmed: 'appointmentStatuses.confirmed',
    checked_in: 'appointmentStatuses.checked_in',
    completed: 'appointmentStatuses.completed',
    cancelled: 'appointmentStatuses.cancelled',
    no_show: 'appointmentStatuses.no_show',
  },
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
    /** The contract's `cancel_reason` (D32), by side. */
    cancelReasons: {
      patient_asked: 'appointments.cancelReasons.patient_asked',
      unreachable: 'appointments.cancelReasons.unreachable',
      doctor_unavailable: 'appointments.cancelReasons.doctor_unavailable',
      resource_unavailable: 'appointments.cancelReasons.resource_unavailable',
      other: 'appointments.cancelReasons.other',
    },
    cancelSides: {
      patient: 'appointments.cancelSides.patient',
      clinic: 'appointments.cancelSides.clinic',
    },
    /** The form's Cancel visit reasons (`cancelReasonToContract` stores them). */
    formCancelReasons: {
      patient_cancelled: 'appointments.formCancelReasons.patient_cancelled',
      rescheduling_later: 'appointments.formCancelReasons.rescheduling_later',
      doctor_unavailable: 'appointments.formCancelReasons.doctor_unavailable',
      booked_by_mistake: 'appointments.formCancelReasons.booked_by_mistake',
      other: 'appointments.formCancelReasons.other',
    },
    /** A slot's day in a toast: "Today", "Tomorrow", else the date. */
    days: {
      today: 'appointments.days.today',
      tomorrow: 'appointments.days.tomorrow',
    },
    toasts: {
      booked: 'appointments.toasts.booked',
      bookedQueued: 'appointments.toasts.bookedQueued',
      moved: 'appointments.toasts.moved',
      updated: 'appointments.toasts.updated',
      statusChanged: 'appointments.toasts.statusChanged',
      statusConfirmed: 'appointments.toasts.statusConfirmed',
      statusCancelled: 'appointments.toasts.statusCancelled',
      cancelled: 'appointments.toasts.cancelled',
      restored: 'appointments.toasts.restored',
    },
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
