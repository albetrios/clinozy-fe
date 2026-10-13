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
 * vocabulary (`APP_KEYS.appointments`) — Today, the patient file and the
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
      reminderSent: 'agenda.latest.reminderSent',
      repliedYes: 'agenda.latest.repliedYes',
      moved: 'agenda.latest.moved',
      movedTimes: 'agenda.latest.movedTimes',
      checkedIn: 'agenda.latest.checkedIn',
    },
    /** Each pill's tooltip (`appointments.md:360`). */
    latestHints: {
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
  /** Day · Week · Month (`appointments.md:42–53, 362–365`). */
  calendar: {
    /** The Day header: "<n> booked · <h> h". */
    dayLoad: 'calendar.dayLoad',
    free: 'calendar.free',
    /** The phone Day strip's name. */
    doctor: 'calendar.doctor',
    bookSlot: 'calendar.bookSlot',
    /** The slot toast: "New appointment · <day> · <time>". */
    newAt: 'calendar.newAt',
    pastDay: 'calendar.pastDay',
    /** The Day doctor picker's line: "<n> booked" or "free". */
    doctorBooked: 'calendar.doctorBooked',
    doctorFree: 'calendar.doctorFree',
    /** A Week day's load tooltip, with or without " · overlapping booking". */
    chairTime: 'calendar.chairTime',
    chairTimeOverlap: 'calendar.chairTimeOverlap',
    overlap: 'calendar.overlap',
    /** "+<n> more" in a Month cell. */
    more: 'calendar.more',
    /** The Month day popover's title: "<day> · <n> appointments". */
    dayCount: 'calendar.dayCount',
    openDay: 'calendar.openDay',
    /** A block's tooltip, with or without " · overlaps another booking" (Day). */
    block: 'calendar.block',
    blockClash: 'calendar.blockClash',
    /** "10:30 am · 20m". */
    blockTime: 'calendar.blockTime',
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
  /** "Other"'s note in the cancel view, and its red "Cancel" (L-64: one ask). */
  cancelNote: 'appointments-cancel-note',
  cancelSubmit: 'appointments-cancel-submit',
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
  /** The STATUS chips' group; each chip is `appointments-filters-status-<value>`. */
  filtersStatus: 'appointments-filters-status',
  /** A calendar view's card (`data-view` = day · week · month). */
  calendar: 'appointments-calendar',
  /** A booking's block on a calendar (`data-status`). */
  block: 'appointments-block',
  /** The Day header row (`md` and up) and its doctor picker. */
  dayHeader: 'appointments-day-header',
  dayDoctors: 'appointments-day-doctors',
  /** The phone Day strip (`role="radiogroup"`) and each doctor in it. */
  dayStrip: 'appointments-day-strip',
  dayStripOption: 'appointments-day-strip-option',
  /** A day's column of blocks (Day, Week) — `data-date`. */
  dayColumn: 'appointments-day-column',
  /** The Day column's empty surface a press books a slot on (pointer only, hidden from AT). */
  daySlots: 'appointments-day-slots',
  nowLine: 'appointments-now-line',
  /** A Week day header button — `data-date`. */
  weekDay: 'appointments-week-day',
  /** A Month cell, "+<n> more" and its day popover. */
  monthCell: 'appointments-month-cell',
  monthMore: 'appointments-month-more',
  monthPopover: 'appointments-month-popover',
  monthOpenDay: 'appointments-month-open-day',
} as const;
