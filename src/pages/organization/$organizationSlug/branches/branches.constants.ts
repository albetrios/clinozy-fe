import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Branches room's i18n namespace. */
export const BRANCHES_NS = I18N_NAMESPACES.branches;

/**
 * The Branches room's copy (`users.md:79–95, 176–198`; H:5196–5222) — once Users › Branches, its
 * own room since change-branches-in-navbar. The section's name and description are the shared
 * clinic vocabulary (`APP_KEYS.sections.branches`); days and hours are `useHoursFormat`'s.
 */
export const BRANCHES_KEYS = {
  manifest: { title: 'manifest.title' },
  /** "New branch" — the toolbar's primary action, a floating pill on a phone. */
  primary: { newBranch: 'primary.newBranch' },
  rowActions: { edit: 'rowActions.edit' },
  bulk: {
    export: 'bulk.export',
    /** "3 rows exported as CSV" (plural). */
    exported: 'bulk.exported',
  },
  /** "Branch" — the record a dead branch link names ("Branch not found · …", `S:115`). */
  record: 'record',
  columns: {
    branch: 'columns.branch',
    address: 'columns.address',
    contact: 'columns.contact',
    hours: 'columns.hours',
    team: 'columns.team',
    defaults: 'columns.defaults',
    status: 'columns.status',
  },
  /** The grey "Main" pill on the main branch. */
  mainPill: 'mainPill',
  /** "Not set" — no default people. */
  notSet: 'notSet',
  /** "Doctor · Dr. Nisha Mavani" — one default person, by role. */
  defaults: {
    doctor: 'defaults.doctor',
    desk: 'defaults.desk',
    therapist: 'defaults.therapist',
    pharmacist: 'defaults.pharmacist',
  },
  status: { open: 'status.open', closed: 'status.closed' },
  /** "All branches loaded" — the plural noun the table's end line names. */
  records: 'records',
  /** "No branches yet" and the line under it. */
  empty: { title: 'empty.title', description: 'empty.description' },
  drawer: {
    title: {
      create: 'drawer.title.create',
      edit: 'drawer.title.edit',
    },
    sub: 'drawer.sub',
    /** The footer's first part and the name pill before a name is typed. */
    summaryNew: 'drawer.summaryNew',
    /** "6 people" — the footer's team count. */
    people: 'drawer.people',
    /** The grey "Main branch" pill. */
    mainBadge: 'drawer.mainBadge',
    steps: {
      place: 'drawer.steps.place',
      contact: 'drawer.steps.contact',
      people: 'drawer.steps.people',
      /** "Places & days" — the fourth step, an existing branch only (D23). */
      places: 'drawer.steps.places',
    },
    groups: {
      branch: 'drawer.groups.branch',
      address: 'drawer.groups.address',
      contact: 'drawer.groups.contact',
      hours: 'drawer.groups.hours',
    },
    fields: {
      name: 'drawer.fields.name',
      colour: 'drawer.fields.colour',
      main: 'drawer.fields.main',
      status: 'drawer.fields.status',
      line1: 'drawer.fields.line1',
      line2: 'drawer.fields.line2',
      area: 'drawer.fields.area',
      city: 'drawer.fields.city',
      pin: 'drawer.fields.pin',
      state: 'drawer.fields.state',
      phone: 'drawer.fields.phone',
      email: 'drawer.fields.email',
      gstin: 'drawer.fields.gstin',
      days: 'drawer.fields.days',
      opens: 'drawer.fields.opens',
      closes: 'drawer.fields.closes',
      team: 'drawer.fields.team',
      doctor: 'drawer.fields.doctor',
      desk: 'drawer.fields.desk',
      therapist: 'drawer.fields.therapist',
      pharmacist: 'drawer.fields.pharmacist',
    },
    placeholders: {
      name: 'drawer.placeholders.name',
      line1: 'drawer.placeholders.line1',
      line2: 'drawer.placeholders.line2',
      area: 'drawer.placeholders.area',
      city: 'drawer.placeholders.city',
      pin: 'drawer.placeholders.pin',
      state: 'drawer.placeholders.state',
      email: 'drawer.placeholders.email',
      gstin: 'drawer.placeholders.gstin',
      team: 'drawer.placeholders.team',
      /** "Pick a time" — the opening and closing time fields. */
      time: 'drawer.placeholders.time',
    },
    hints: {
      colour: 'drawer.hints.colour',
      /** "one per clinic · set when it opened" — the Main branch switch is read-only. */
      main: 'drawer.hints.main',
      phone: 'drawer.hints.phone',
      team: 'drawer.hints.team',
      /** "preselected in forms here" — a default with someone to pick. */
      preselected: 'drawer.hints.preselected',
      /** "add a doctor to the team first" … — nobody on the team holds the role. */
      addFirst: {
        doctor: 'drawer.hints.addFirst.doctor',
        desk: 'drawer.hints.addFirst.desk',
        therapist: 'drawer.hints.addFirst.therapist',
        pharmacist: 'drawer.hints.addFirst.pharmacist',
      },
    },
    toggles: {
      mainOn: 'drawer.toggles.mainOn',
      mainOff: 'drawer.toggles.mainOff',
      openOn: 'drawer.toggles.openOn',
      openOff: 'drawer.toggles.openOff',
    },
    nobody: 'drawer.nobody',
    /** "Riya Shah (you)". */
    you: 'drawer.you',
    save: { create: 'drawer.save.create', edit: 'drawer.save.edit' },
    /** "Name the branch" · "Add the address …" · "Add the phone and email". */
    nameMissing: 'drawer.nameMissing',
    addressMissing: 'drawer.addressMissing',
    contactMissing: 'drawer.contactMissing',
    /** "A branch called Vesu already exists". */
    duplicate: 'drawer.duplicate',
    pinInvalid: 'drawer.pinInvalid',
    phoneInvalid: 'drawer.phoneInvalid',
    emailInvalid: 'drawer.emailInvalid',
    /** "Vesu branch added" / "Vesu saved". */
    added: 'drawer.added',
    saved: 'drawer.saved',
    /**
     * "Places & days" (KICKOFF §6.6, D23): the rooms, machines and holidays of an existing
     * branch, each row saved on its own. Keyed by list — `room`, `machine`, `holiday`.
     */
    places: {
      /** "Rooms" · "Machines" · "Holidays" — each list's heading and its peek tile. */
      sections: {
        room: 'drawer.places.sections.room',
        machine: 'drawer.places.sections.machine',
        holiday: 'drawer.places.sections.holiday',
      },
      hints: {
        room: 'drawer.places.hints.room',
        machine: 'drawer.places.hints.machine',
        holiday: 'drawer.places.hints.holiday',
      },
      /** "2 rooms" · "1 machine" · "3 holidays" — the step's head line, joined by " · ". */
      counts: {
        room: 'drawer.places.counts.room',
        machine: 'drawer.places.counts.machine',
        holiday: 'drawer.places.counts.holiday',
      },
      /** The head line with nothing in any list. */
      nothingYet: 'drawer.places.nothingYet',
      empty: {
        room: 'drawer.places.empty.room',
        machine: 'drawer.places.empty.machine',
        holiday: 'drawer.places.empty.holiday',
      },
      /** "New room" · "New machine" · "New holiday" — the add row's name. */
      newLabel: {
        room: 'drawer.places.newLabel.room',
        machine: 'drawer.places.newLabel.machine',
        holiday: 'drawer.places.newLabel.holiday',
      },
      placeholders: {
        room: 'drawer.places.placeholders.room',
        machine: 'drawer.places.placeholders.machine',
        holiday: 'drawer.places.placeholders.holiday',
      },
      fields: {
        name: 'drawer.places.fields.name',
        date: 'drawer.places.fields.date',
        label: 'drawer.places.fields.label',
      },
      add: 'drawer.places.add',
      rename: 'drawer.places.rename',
      save: 'drawer.places.save',
      cancel: 'drawer.places.cancel',
      remove: 'drawer.places.remove',
      /** The row's switch: "In use" / "Switched off", named "<name> in use". */
      toggle: {
        on: 'drawer.places.toggle.on',
        off: 'drawer.places.toggle.off',
        label: 'drawer.places.toggle.label',
      },
      /** "Remove this room?" — the reason confirm's title. */
      removeTitle: {
        room: 'drawer.places.removeTitle.room',
        machine: 'drawer.places.removeTitle.machine',
        holiday: 'drawer.places.removeTitle.holiday',
      },
      /** "A room called Room 2 already exists" · "Sun 8 Nov is already a holiday" (409). */
      duplicate: {
        room: 'drawer.places.duplicate.room',
        machine: 'drawer.places.duplicate.machine',
        holiday: 'drawer.places.duplicate.holiday',
      },
      nameMissing: 'drawer.places.nameMissing',
      nameTooLong: 'drawer.places.nameTooLong',
      dateMissing: 'drawer.places.dateMissing',
      labelMissing: 'drawer.places.labelMissing',
      labelTooLong: 'drawer.places.labelTooLong',
      /** "Room 3 added" · "Laser room renamed" · "Room 2 switched off" · "Diwali removed". */
      added: 'drawer.places.added',
      renamed: 'drawer.places.renamed',
      switchedOn: 'drawer.places.switchedOn',
      switchedOff: 'drawer.places.switchedOff',
      removed: 'drawer.places.removed',
      /** The step's one read failure, over its retry. */
      loadFailed: 'drawer.places.loadFailed',
    },
  },
} as const;

/** The Branches table's id: the test-id prefix (`branches-table`) and the device prefs' key. */
export const BRANCHES_TABLE_ID = 'branches';

/** The branch drawer's root test id (KICKOFF §6.12 Test ids). */
export const BRANCH_DRAWER_TEST_ID = 'branch-drawer';
