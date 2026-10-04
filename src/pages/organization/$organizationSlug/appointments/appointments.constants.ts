import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Appointments room's i18n namespace. */
export const APPOINTMENTS_NS = I18N_NAMESPACES.appointments;

/** The calendars' three periods — a view's "Today", arrows and label speak in one. */
const PERIODS = (prefix: string) => ({
  day: `${prefix}.day`,
  week: `${prefix}.week`,
  month: `${prefix}.month`,
});

/**
 * The Appointments room's keys (`appointments.md` › Copy, verbatim). The
 * status machine's words, the cancel reasons and the toasts are the clinic
 * vocabulary (`CLINIC_KEYS.appointments`) — Today, the patient file and the
 * appointment form speak them too.
 */
export const APPOINTMENTS_KEYS = {
  manifest: { title: 'manifest.title' },
  /** The record's name in "Appointment not found · it may have been deleted" (`S:115`); the card's dialog name. */
  record: 'record',
  /** "All <records> loaded" / "Loading more <records>". */
  records: 'records',
  toolbar: {
    viewsLabel: 'toolbar.viewsLabel',
    views: {
      agenda: 'toolbar.views.agenda',
      day: 'toolbar.views.day',
      week: 'toolbar.views.week',
      month: 'toolbar.views.month',
    },
    today: PERIODS('toolbar.today'),
    jump: PERIODS('toolbar.jump'),
    period: 'toolbar.period',
    /** A Week's label: "<from> – <to>" ("27 Sep – 3 Oct"). */
    weekRange: 'toolbar.weekRange',
    previous: PERIODS('toolbar.previous'),
    next: PERIODS('toolbar.next'),
    search: 'toolbar.search',
    searchLabel: 'toolbar.searchLabel',
    newAppointment: 'toolbar.newAppointment',
  },
  filters: {
    label: 'filters.label',
    previousMonth: 'filters.previousMonth',
    nextMonth: 'filters.nextMonth',
    upcoming: 'filters.upcoming',
    /** A calendar day's tooltip: "<YYYY-MM-DD> · <n> booked". */
    dayBooked: 'filters.dayBooked',
    appointedTo: 'filters.appointedTo',
    allDoctors: 'filters.allDoctors',
    doctors: 'filters.doctors',
    searchTeam: 'filters.searchTeam',
    /** The Day doctor picker's footer. */
    showAll: 'filters.showAll',
    done: 'filters.done',
    status: 'filters.status',
    all: 'filters.all',
    active: 'filters.active',
  },
  agenda: {
    columns: {
      time: 'agenda.columns.time',
      contact: 'agenda.columns.contact',
      service: 'agenda.columns.service',
      doctor: 'agenda.columns.doctor',
      latest: 'agenda.columns.latest',
      quickView: 'agenda.columns.quickView',
      status: 'agenda.columns.status',
    },
    minutes: 'agenda.minutes',
    empty: 'agenda.empty',
    bookOne: 'agenda.bookOne',
    /** A day group's label and sub line (H:5906). */
    day: {
      today: 'agenda.day.today',
      tomorrow: 'agenda.day.tomorrow',
      yesterday: 'agenda.day.yesterday',
      inDays: 'agenda.day.inDays',
      nextWeek: 'agenda.day.nextWeek',
      inWeeks: 'agenda.day.inWeeks',
      daysAgo: 'agenda.day.daysAgo',
    },
    /** "<n> confirmed" · "<n> awaiting reply" or "· all set" — the number in `<n>`. */
    counts: {
      confirmed: 'agenda.counts.confirmed',
      awaiting: 'agenda.counts.awaiting',
      allSet: 'agenda.counts.allSet',
      confirmedHint: 'agenda.counts.confirmedHint',
      waitingHint: 'agenda.counts.waitingHint',
      /** The counts' tooltip: "<n confirmed> · <n waiting for a reply>". */
      hint: 'agenda.counts.hint',
    },
    /** "Latest update" pills, mark included (`appointments.md:359`). */
    latest: {
      planReady: 'agenda.latest.planReady',
      planPending: 'agenda.latest.planPending',
      reminderRead: 'agenda.latest.reminderRead',
      reminderDelivered: 'agenda.latest.reminderDelivered',
      reminderSent: 'agenda.latest.reminderSent',
      repliedYes: 'agenda.latest.repliedYes',
      moved: 'agenda.latest.moved',
      movedTimes: 'agenda.latest.movedTimes',
      checkedIn: 'agenda.latest.checkedIn',
    },
    /** Each pill's tooltip (`appointments.md:360`). */
    latestHints: {
      planReady: 'agenda.latestHints.planReady',
      planPending: 'agenda.latestHints.planPending',
      reminderRead: 'agenda.latestHints.reminderRead',
      reminderDelivered: 'agenda.latestHints.reminderDelivered',
      reminderSent: 'agenda.latestHints.reminderSent',
      repliedYes: 'agenda.latestHints.repliedYes',
      moved: 'agenda.latestHints.moved',
      checkedIn: 'agenda.latestHints.checkedIn',
    },
    changeStatus: 'agenda.changeStatus',
  },
  /** The Change status popover (`appointments.md:165–179`). */
  status: {
    title: 'status.title',
    /** "Now: <b>Scheduled</b>" — the status in `<b>`. */
    now: 'status.now',
    nowReason: 'status.nowReason',
    why: 'status.why',
    back: 'status.back',
  },
  /** The appointment card (`appointments.md:149–163`). */
  card: {
    when: 'card.when',
    noUpdate: 'card.noUpdate',
    open: 'card.open',
    reschedule: 'card.reschedule',
    cancel: 'card.cancel',
    tracker: 'card.tracker',
  },
} as const;

/**
 * `data-testid`s of the room: its own under the `appointments-` prefix, the
 * booking card (every view's hover card and quick view) under `appointment-card`.
 */
export const APPOINTMENTS_TEST_IDS = {
  today: 'appointments-today',
  periodPrevious: 'appointments-period-previous',
  periodNext: 'appointments-period-next',
  periodLabel: 'appointments-period-label',
  dayGroup: 'appointments-day-group',
  empty: 'appointments-empty',
  bookOne: 'appointments-book-one',
  quickView: 'appointments-quick-view',
  statusButton: 'appointments-status-button',
  statusPopover: 'appointments-status-popover',
  statusOption: (move: string) => `appointments-status-option-${move}`,
  cancelReason: (reason: string) => `appointments-cancel-reason-${reason}`,
  statusBack: 'appointments-status-back',
  appointmentCard: 'appointment-card',
  cardNext: 'appointment-card-next',
  cardOpen: 'appointment-card-open',
  cardMove: (move: string) => `appointment-card-move-${move}`,
  filtersCalendar: 'appointments-filters-calendar',
  filtersDay: 'appointments-filters-day',
  filtersUpcoming: 'appointments-filters-upcoming',
  filtersMonthPrevious: 'appointments-filters-month-previous',
  filtersMonthNext: 'appointments-filters-month-next',
  filtersDoctors: 'appointments-filters-doctors',
  filtersStatus: (value: string) => `appointments-filters-status-${value}`,
} as const;
