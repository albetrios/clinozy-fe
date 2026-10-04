import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Users room's i18n namespace. */
export const USERS_NS = I18N_NAMESPACES.users;

/**
 * The Users room's copy, verbatim from `users.md` › Copy (KICKOFF §6.12). The
 * section names and descriptions, the role names and the reason confirm's
 * chrome are the shared clinic vocabulary (`CLINIC_KEYS`).
 */
export const USERS_KEYS = {
  manifest: { title: 'manifest.title' },
  /** "User" — the record a dead member link names ("User not found · …", `S:115`). */
  record: 'record',
  /** The room's tabs — links to `users/`, `users/roles/`, `users/branches/`. */
  tabs: {
    /** The tab row's accessible name. */
    label: 'tabs.label',
    team: 'tabs.team',
    roles: 'tabs.roles',
    branches: 'tabs.branches',
  },
  search: { placeholder: 'search.placeholder', label: 'search.label' },
  primary: {
    newUser: 'primary.newUser',
    newRole: 'primary.newRole',
    newBranch: 'primary.newBranch',
  },
  /** The Team's column heads, also the meta line's labels and the Filters sections'. */
  columns: {
    seq: 'columns.seq',
    user: 'columns.user',
    email: 'columns.email',
    roles: 'columns.roles',
    branches: 'columns.branches',
    hours: 'columns.hours',
    commission: 'columns.commission',
    status: 'columns.status',
    updated: 'columns.updated',
  },
  table: {
    /** "All users loaded" — the plural noun the table's end line names. */
    records: 'table.records',
    /** The first role pill's tooltip. */
    mainRole: 'table.mainRole',
    /** Every other role pill's tooltip. */
    alsoRole: 'table.alsoRole',
    /** "Today · 09:02". */
    today: 'table.today',
    /** "Dec 09, 2025 · 10:38". */
    dayTime: 'table.dayTime',
    /** "10%". */
    commission: 'table.commission',
  },
  /** A member's status pill, and an invitation's line under it. */
  status: {
    active: 'status.active',
    inactive: 'status.inactive',
    invited: 'status.invited',
    /** "Invitation expires {{date}}". */
    expires: 'status.expires',
    expired: 'status.expired',
  },
  /** Working hours (`usRange`, H:3608): "Mon–Sat · 09:30–19:30". */
  hours: {
    everyDay: 'hours.everyDay',
    /** "Mon–Sat". */
    run: 'hours.run',
    /** "Mon, Wed, Fri". */
    list: 'hours.list',
    /** "<days> · <from>–<to>". */
    line: 'hours.line',
  },
  filters: {
    roles: 'filters.roles',
    all: 'filters.all',
    branches: 'filters.branches',
    status: 'filters.status',
  },
  rowActions: { edit: 'rowActions.edit', delete: 'rowActions.delete' },
  bulk: {
    export: 'bulk.export',
    /** "3 rows exported as CSV" (plural). */
    exported: 'bulk.exported',
  },
  empty: { title: 'empty.title', description: 'empty.description' },
  /** The user drawer — New user (an invitation, D17) and Edit user (`users.md:99–124`). */
  drawer: {
    title: { create: 'drawer.title.create', edit: 'drawer.title.edit' },
    sub: 'drawer.sub',
    steps: { profile: 'drawer.steps.profile', hours: 'drawer.steps.hours' },
    groups: {
      profile: 'drawer.groups.profile',
      rolesBranches: 'drawer.groups.rolesBranches',
      hours: 'drawer.groups.hours',
      pay: 'drawer.groups.pay',
    },
    fields: {
      name: 'drawer.fields.name',
      mobile: 'drawer.fields.mobile',
      email: 'drawer.fields.email',
      colour: 'drawer.fields.colour',
      roles: 'drawer.fields.roles',
      access: 'drawer.fields.access',
      branches: 'drawer.fields.branches',
      days: 'drawer.fields.days',
      from: 'drawer.fields.from',
      to: 'drawer.fields.to',
      commission: 'drawer.fields.commission',
      status: 'drawer.fields.status',
    },
    hints: {
      mobile: 'drawer.hints.mobile',
      colour: 'drawer.hints.colour',
      roles: 'drawer.hints.roles',
      branches: 'drawer.hints.branches',
      days: 'drawer.hints.days',
    },
    placeholders: {
      name: 'drawer.placeholders.name',
      email: 'drawer.placeholders.email',
      time: 'drawer.placeholders.time',
      commission: 'drawer.placeholders.commission',
    },
    /** "% of billed". */
    commissionSuffix: 'drawer.commissionSuffix',
    /** The quick commission chips: "{{value}}%". */
    commissionQuick: 'drawer.commissionQuick',
    decrease: 'drawer.decrease',
    increase: 'drawer.increase',
    /** "Gets access to" with no role picked. */
    pickRole: 'drawer.pickRole',
    statusOn: 'drawer.statusOn',
    statusOff: 'drawer.statusOff',
    resend: 'drawer.resend',
    quickFill: {
      doctor: 'drawer.quickFill.doctor',
      therapist: 'drawer.quickFill.therapist',
      front_desk: 'drawer.quickFill.front_desk',
      pharmacist: 'drawer.quickFill.pharmacist',
    },
    /** The footer summary before a name is typed: "New user". */
    summaryNew: 'drawer.summaryNew',
    save: {
      create: 'drawer.save.create',
      edit: 'drawer.save.edit',
      createAnother: 'drawer.save.createAnother',
    },
    /** Save with Name or Email empty. */
    missing: 'drawer.missing',
    /** Save with no role picked. */
    noRole: 'drawer.noRole',
    emailInvalid: 'drawer.emailInvalid',
    mobileInvalid: 'drawer.mobileInvalid',
    /** clinozy-be has no role the membership could take (not even Member or Viewer). */
    noPlatformRole: 'drawer.noPlatformRole',
    /** "Dr. Nisha Mavani added". */
    added: 'drawer.added',
    /** "Dr. Reenal Chaniyara saved". */
    saved: 'drawer.saved',
  },
  /** The reason confirm over a Team row or the user drawer (`users.md:238–252`). */
  deleteUser: {
    title: 'deleteUser.title',
    /** "Dr. Reenal Chaniyara removed", with Undo. */
    removed: 'deleteUser.removed',
  },
} as const;

/** The Team table's id: the test-id prefix (`users-team-table`) and the device prefs' key. */
export const TEAM_TABLE_ID = 'users-team';

/** The member drawer's root test id (KICKOFF §6.12 Test ids). */
export const USER_DRAWER_TEST_ID = 'user-drawer';
