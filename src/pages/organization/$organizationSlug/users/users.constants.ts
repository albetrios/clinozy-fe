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
  rowActions: {
    edit: 'rowActions.edit',
    delete: 'rowActions.delete',
    /** "Leave clinic" — your own row and drawer, never the owner's (D17, Settings' self-removal). */
    leave: 'rowActions.leave',
  },
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
  /** Leave clinic — `{{clinic}}` is the organisation's name, else `clinicFallback`. */
  leave: {
    title: 'leave.title',
    description: 'leave.description',
    confirm: 'leave.confirm',
    /** The confirm's cancel: "Stay". */
    stay: 'leave.stay',
    /** "Leaving <clinic>…", with Undo. */
    pending: 'leave.pending',
    /** "You left <clinic>". */
    done: 'leave.done',
    clinicFallback: 'leave.clinicFallback',
  },
  /** Roles & access (`users.md:42–77`; H:1117–1146, H:5179–5194). */
  roles: {
    /** The role list's label ("Roles", 11px uppercase). */
    label: 'roles.label',
    /** Each preset's one-line purpose (`users.md:50`); a custom role's lines. */
    purposes: {
      admin: 'roles.purposes.admin',
      doctor: 'roles.purposes.doctor',
      therapist: 'roles.purposes.therapist',
      front_desk: 'roles.purposes.front_desk',
      counsellor: 'roles.purposes.counsellor',
      pharmacist: 'roles.purposes.pharmacist',
      accountant: 'roles.purposes.accountant',
      marketing: 'roles.purposes.marketing',
      /** "Custom role" — a custom role in the list. */
      custom: 'roles.purposes.custom',
      /** "Custom role · set what it can do below" — a custom role's page. */
      customPage: 'roles.purposes.customPage',
    },
    /** The custom role name box's accessible name. */
    nameLabel: 'roles.nameLabel',
    /** The custom role description box's accessible name (Settings' role dialog, relocated — D17). */
    descriptionLabel: 'roles.descriptionLabel',
    copyFrom: 'roles.copyFrom',
    /** "Front desk now has the same access as Counsellor". */
    copied: 'roles.copied',
    /** "Preview as Front desk". */
    preview: 'roles.preview',
    /** The preview button's tooltip. */
    previewHint: 'roles.previewHint',
    /** "Previewing Clinozy as Doctor". */
    previewing: 'roles.previewing',
    back: 'roles.back',
    people: 'roles.people',
    /** A member pill's tooltip: "Open Riya Shah". */
    openPerson: 'roles.openPerson',
    /** "+ Admin" — the other roles a member holds. */
    also: 'roles.also',
    nobody: 'roles.nobody',
    matrix: {
      title: 'roles.matrix.title',
      section: 'roles.matrix.section',
      view: 'roles.matrix.view',
      create: 'roles.matrix.create',
      edit: 'roles.matrix.edit',
      delete: 'roles.matrix.delete',
      row: 'roles.matrix.row',
      full: 'roles.matrix.full',
      some: 'roles.matrix.some',
      none: 'roles.matrix.none',
      rowHint: 'roles.matrix.rowHint',
      /** A box's name: "Front desk can view · Leads". */
      cell: {
        view: 'roles.matrix.cell.view',
        create: 'roles.matrix.cell.create',
        edit: 'roles.matrix.cell.edit',
        delete: 'roles.matrix.cell.delete',
      },
    },
    abilities: {
      title: 'roles.abilities.title',
      disc: {
        label: 'roles.abilities.disc.label',
        description: 'roles.abilities.disc.description',
      },
      floor: {
        label: 'roles.abilities.floor.label',
        description: 'roles.abilities.floor.description',
      },
      prices: {
        label: 'roles.abilities.prices.label',
        description: 'roles.abilities.prices.description',
      },
      dayclose: {
        label: 'roles.abilities.dayclose.label',
        description: 'roles.abilities.dayclose.description',
      },
      reverse: {
        label: 'roles.abilities.reverse.label',
        description: 'roles.abilities.reverse.description',
      },
      refund: {
        label: 'roles.abilities.refund.label',
        description: 'roles.abilities.refund.description',
      },
      void: {
        label: 'roles.abilities.void.label',
        description: 'roles.abilities.void.description',
      },
      allbr: {
        label: 'roles.abilities.allbr.label',
        description: 'roles.abilities.allbr.description',
      },
      clinical: {
        label: 'roles.abilities.clinical.label',
        description: 'roles.abilities.clinical.description',
      },
      export: {
        label: 'roles.abilities.export.label',
        description: 'roles.abilities.export.description',
      },
      perms: {
        label: 'roles.abilities.perms.label',
        description: 'roles.abilities.perms.description',
      },
    },
    notes: {
      admin: 'roles.notes.admin',
      readOnly: 'roles.notes.readOnly',
      live: 'roles.notes.live',
    },
    locked: {
      /** "Admins always have full access". */
      admin: 'roles.locked.admin',
      /** "You can’t change roles · ask an admin". */
      noPerms: 'roles.locked.noPerms',
      /** "You can’t add roles · ask an admin". */
      noAdd: 'roles.locked.noAdd',
      /** A role clinozy-be keeps as a system role: its Users row is the platform's (D47). */
      platform: 'roles.locked.platform',
    },
    /** "Role added · name it and pick what it can do". */
    added: 'roles.added',
    /** A new role's name: "New role", then "New role 2" … */
    newRoleName: 'roles.newRoleName',
    /** "A role called {{name}} already exists" (§7.3: a rename can't duplicate). */
    duplicateName: 'roles.duplicateName',
    /** Delete role — the Settings capability, relocated (D17, Q-U6). */
    deleteRole: {
      action: 'roles.deleteRole.action',
      title: 'roles.deleteRole.title',
      description: 'roles.deleteRole.description',
      confirm: 'roles.deleteRole.confirm',
      pending: 'roles.deleteRole.pending',
    },
    /**
     * Workspace permissions — the clinozy-be codes the matrix doesn't map,
     * named by the catalog (Settings' role dialog, relocated — D17).
     */
    workspace: {
      title: 'roles.workspace.title',
      hint: 'roles.workspace.hint',
      /** The viewer can give none of them. */
      none: 'roles.workspace.none',
      loadFailed: 'roles.workspace.loadFailed',
      /** A role clinozy-be keeps as a system role: its codes are the platform's (D47). */
      locked: 'roles.workspace.locked',
    },
  },
  /** Branches (`users.md:79–95, 176–198`; H:5196–5222). */
  branches: {
    /** "Branch" — the record a dead branch link names ("Branch not found · …", `S:115`). */
    record: 'branches.record',
    columns: {
      branch: 'branches.columns.branch',
      address: 'branches.columns.address',
      contact: 'branches.columns.contact',
      hours: 'branches.columns.hours',
      team: 'branches.columns.team',
      defaults: 'branches.columns.defaults',
      status: 'branches.columns.status',
    },
    /** The grey "Main" pill on the main branch. */
    main: 'branches.main',
    /** "Not set" — no default people. */
    notSet: 'branches.notSet',
    /** "Doctor · Dr. Nisha Mavani" — one default person, by role. */
    defaults: {
      doctor: 'branches.defaults.doctor',
      desk: 'branches.defaults.desk',
      therapist: 'branches.defaults.therapist',
      pharmacist: 'branches.defaults.pharmacist',
    },
    status: { open: 'branches.status.open', closed: 'branches.status.closed' },
    /** "All branches loaded" — the plural noun the table's end line names. */
    records: 'branches.records',
    /** "No branches yet". */
    empty: 'branches.empty',
    drawer: {
      title: {
        create: 'branches.drawer.title.create',
        edit: 'branches.drawer.title.edit',
      },
      sub: 'branches.drawer.sub',
      /** The footer's first part and the name pill before a name is typed. */
      summaryNew: 'branches.drawer.summaryNew',
      /** "6 people" — the footer's team count. */
      people: 'branches.drawer.people',
      /** The grey "Main branch" pill. */
      mainBadge: 'branches.drawer.mainBadge',
      steps: {
        place: 'branches.drawer.steps.place',
        contact: 'branches.drawer.steps.contact',
        people: 'branches.drawer.steps.people',
      },
      groups: {
        branch: 'branches.drawer.groups.branch',
        address: 'branches.drawer.groups.address',
        contact: 'branches.drawer.groups.contact',
        hours: 'branches.drawer.groups.hours',
      },
      fields: {
        name: 'branches.drawer.fields.name',
        colour: 'branches.drawer.fields.colour',
        main: 'branches.drawer.fields.main',
        status: 'branches.drawer.fields.status',
        line1: 'branches.drawer.fields.line1',
        line2: 'branches.drawer.fields.line2',
        area: 'branches.drawer.fields.area',
        city: 'branches.drawer.fields.city',
        pin: 'branches.drawer.fields.pin',
        state: 'branches.drawer.fields.state',
        phone: 'branches.drawer.fields.phone',
        email: 'branches.drawer.fields.email',
        gstin: 'branches.drawer.fields.gstin',
        days: 'branches.drawer.fields.days',
        opens: 'branches.drawer.fields.opens',
        closes: 'branches.drawer.fields.closes',
        team: 'branches.drawer.fields.team',
        doctor: 'branches.drawer.fields.doctor',
        desk: 'branches.drawer.fields.desk',
        therapist: 'branches.drawer.fields.therapist',
        pharmacist: 'branches.drawer.fields.pharmacist',
      },
      placeholders: {
        name: 'branches.drawer.placeholders.name',
        line1: 'branches.drawer.placeholders.line1',
        line2: 'branches.drawer.placeholders.line2',
        area: 'branches.drawer.placeholders.area',
        city: 'branches.drawer.placeholders.city',
        pin: 'branches.drawer.placeholders.pin',
        state: 'branches.drawer.placeholders.state',
        email: 'branches.drawer.placeholders.email',
        gstin: 'branches.drawer.placeholders.gstin',
        team: 'branches.drawer.placeholders.team',
      },
      hints: {
        colour: 'branches.drawer.hints.colour',
        phone: 'branches.drawer.hints.phone',
        team: 'branches.drawer.hints.team',
        /** "preselected in forms here" — a default with someone to pick. */
        preselected: 'branches.drawer.hints.preselected',
        /** "add a doctor to the team first" … — nobody on the team holds the role. */
        addFirst: {
          doctor: 'branches.drawer.hints.addFirst.doctor',
          desk: 'branches.drawer.hints.addFirst.desk',
          therapist: 'branches.drawer.hints.addFirst.therapist',
          pharmacist: 'branches.drawer.hints.addFirst.pharmacist',
        },
      },
      toggles: {
        mainOn: 'branches.drawer.toggles.mainOn',
        mainOff: 'branches.drawer.toggles.mainOff',
        openOn: 'branches.drawer.toggles.openOn',
        openOff: 'branches.drawer.toggles.openOff',
      },
      nobody: 'branches.drawer.nobody',
      /** "Riya Shah (you)". */
      you: 'branches.drawer.you',
      save: { create: 'branches.drawer.save.create', edit: 'branches.drawer.save.edit' },
      /** "Name the branch" · "Add the address" · "A branch called Vesu already exists". */
      nameMissing: 'branches.drawer.nameMissing',
      addressMissing: 'branches.drawer.addressMissing',
      duplicate: 'branches.drawer.duplicate',
      phoneInvalid: 'branches.drawer.phoneInvalid',
      emailInvalid: 'branches.drawer.emailInvalid',
      /** "Vesu branch added" / "Vesu saved". */
      added: 'branches.drawer.added',
      saved: 'branches.drawer.saved',
    },
    deleteBranch: {
      title: 'branches.deleteBranch.title',
      /** "Vesu removed", with Undo. */
      removed: 'branches.deleteBranch.removed',
    },
  },
} as const;

/** The Team table's id: the test-id prefix (`users-team-table`) and the device prefs' key. */
export const TEAM_TABLE_ID = 'users-team';

/** The member drawer's root test id (KICKOFF §6.12 Test ids). */
export const USER_DRAWER_TEST_ID = 'user-drawer';

/** The Branches table's id: the test-id prefix (`users-branches-table`) and the device prefs' key. */
export const BRANCHES_TABLE_ID = 'users-branches';

/** The branch drawer's root test id (KICKOFF §6.12 Test ids). */
export const BRANCH_DRAWER_TEST_ID = 'branch-drawer';
