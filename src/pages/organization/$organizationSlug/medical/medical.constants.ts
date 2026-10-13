import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Medical room's i18n namespace. */
export const MEDICAL_NS = I18N_NAMESPACES.medical;

/**
 * The Medical room's copy, verbatim from `medical.md` › Copy (KICKOFF §6.7).
 * Room-only, so it never rides the entry chunk.
 */
export const MEDICAL_KEYS = {
  manifest: { title: 'manifest.title' },
  tabs: {
    /** The tab row's accessible name. */
    label: 'tabs.label',
    sales: 'tabs.sales',
    medicines: 'tabs.medicines',
    purchases: 'tabs.purchases',
    suppliers: 'tabs.suppliers',
    manufacturers: 'tabs.manufacturers',
    mrs: 'tabs.mrs',
    payments: 'tabs.payments',
    /** "More"'s and the Create menu's group headings (H:5433). */
    groups: {
      selling: 'tabs.groups.selling',
      stock: 'tabs.groups.stock',
      buying: 'tabs.groups.buying',
      money: 'tabs.groups.money',
    },
  },
  search: { placeholder: 'search.placeholder', label: 'search.label' },
  create: {
    sale: 'create.sale',
    medicine: 'create.medicine',
    purchaseOrder: 'create.purchaseOrder',
    supplier: 'create.supplier',
    manufacturer: 'create.manufacturer',
    mr: 'create.mr',
    /** The split button's "⌄" ("Create something else"). */
    menu: 'create.menu',
  },
  viewActions: {
    reorderLow: 'viewActions.reorderLow',
    sellAllDiscount: 'viewActions.sellAllDiscount',
    removeDiscount: 'viewActions.removeDiscount',
    prescriptions: 'viewActions.prescriptions',
    /** Sales with Status Unpaid (`medical.md:17`, Q-M6). */
    paymentReminders: 'viewActions.paymentReminders',
    /** "Pay all received · ₹2,980". */
    payAllReceived: 'viewActions.payAllReceived',
  },
  filters: {
    all: 'filters.all',
    any: 'filters.any',
    stock: 'filters.stock',
    lowStock: 'filters.lowStock',
    expiry: 'filters.expiry',
    within30: 'filters.within30',
    within60: 'filters.within60',
    within90: 'filters.within90',
    status: 'filters.status',
    stage: 'filters.stage',
    manufacturer: 'filters.manufacturer',
    manufacturers: 'filters.manufacturers',
    suppliers: 'filters.suppliers',
    mrs: 'filters.mrs',
  },
  table: {
    /** "49%". */
    percent: 'table.percent',
    addPhone: 'table.addPhone',
    noValue: 'table.noValue',
  },
  empty: { hint: 'empty.hint', store: 'empty.store' },
  bulk: {
    export: 'bulk.export',
    /** "3 rows exported as CSV" (plural). */
    exported: 'bulk.exported',
  },
  toasts: {
    discountOn: 'toasts.discountOn',
    discountOnOne: 'toasts.discountOnOne',
    discountOff: 'toasts.discountOff',
  },
  sales: {
    records: 'sales.records',
    /** "3 sales" (plural). */
    count: 'sales.count',
    columns: {
      seq: 'sales.columns.seq',
      customer: 'sales.columns.customer',
      medicines: 'sales.columns.medicines',
      bill: 'sales.columns.bill',
      margin: 'sales.columns.margin',
      status: 'sales.columns.status',
      when: 'sales.columns.when',
    },
    patient: 'sales.patient',
    contact: 'sales.contact',
    line: 'sales.line',
    batches: 'sales.batches',
    returned: 'sales.returned',
    refunded: 'sales.refunded',
    statuses: {
      paid: 'sales.statuses.paid',
      unpaid: 'sales.statuses.unpaid',
      returned: 'sales.statuses.returned',
    },
    rowActions: {
      collect: 'sales.rowActions.collect',
      return: 'sales.rowActions.return',
      print: 'sales.rowActions.print',
      void: 'sales.rowActions.void',
    },
  },
  medicines: {
    records: 'medicines.records',
    empty: 'medicines.empty',
    columns: {
      seq: 'medicines.columns.seq',
      name: 'medicines.columns.name',
      manufacturer: 'medicines.columns.manufacturer',
      stock: 'medicines.columns.stock',
      expiry: 'medicines.columns.expiry',
      mrp: 'medicines.columns.mrp',
      bestRate: 'medicines.columns.bestRate',
      margin: 'medicines.columns.margin',
    },
    needsMrp: 'medicines.needsMrp',
    stockLine: 'medicines.stockLine',
    levels: {
      ok: 'medicines.levels.ok',
      low: 'medicines.levels.low',
      out: 'medicines.levels.out',
    },
    expiry: 'medicines.expiry',
    noStock: 'medicines.noStock',
    discount: 'medicines.discount',
    rowActions: {
      returnExpiring: 'medicines.rowActions.returnExpiring',
      discount: 'medicines.rowActions.discount',
      removeDiscount: 'medicines.rowActions.removeDiscount',
      edit: 'medicines.rowActions.edit',
      delete: 'medicines.rowActions.delete',
    },
  },
  purchases: {
    records: 'purchases.records',
    /** "3 orders" (plural). */
    count: 'purchases.count',
    columns: {
      seq: 'purchases.columns.seq',
      supplier: 'purchases.columns.supplier',
      items: 'purchases.columns.items',
      date: 'purchases.columns.date',
      total: 'purchases.columns.total',
      stage: 'purchases.columns.stage',
    },
    /** "2 items" (plural). */
    items: 'purchases.items',
    free: 'purchases.free',
    partPaid: 'purchases.partPaid',
    stages: {
      ordered: 'purchases.stages.ordered',
      received: 'purchases.stages.received',
      paid: 'purchases.stages.paid',
      cancelled: 'purchases.stages.cancelled',
    },
    rowActions: {
      receive: 'purchases.rowActions.receive',
      edit: 'purchases.rowActions.edit',
      cancel: 'purchases.rowActions.cancel',
      pay: 'purchases.rowActions.pay',
      view: 'purchases.rowActions.view',
    },
  },
  suppliers: {
    records: 'suppliers.records',
    empty: 'suppliers.empty',
    /** "4 suppliers · ₹6,563 payable" (plural). */
    count: 'suppliers.count',
    columns: {
      name: 'suppliers.columns.name',
      manufacturers: 'suppliers.columns.manufacturers',
      orders: 'suppliers.columns.orders',
      payable: 'suppliers.columns.payable',
      ageing: 'suppliers.columns.ageing',
    },
    /** "1 order" (plural). */
    orders: 'suppliers.orders',
    noOrders: 'suppliers.noOrders',
    /** "5 days" (plural). */
    ageing: 'suppliers.ageing',
    rowActions: {
      pay: 'suppliers.rowActions.pay',
      newOrder: 'suppliers.rowActions.newOrder',
      edit: 'suppliers.rowActions.edit',
      delete: 'suppliers.rowActions.delete',
    },
  },
  manufacturers: {
    records: 'manufacturers.records',
    empty: 'manufacturers.empty',
    /** "6 manufacturers" (plural). */
    count: 'manufacturers.count',
    columns: {
      name: 'manufacturers.columns.name',
      medicines: 'manufacturers.columns.medicines',
      suppliers: 'manufacturers.columns.suppliers',
      mrs: 'manufacturers.columns.mrs',
    },
    /** "1 medicine" (plural). */
    medicines: 'manufacturers.medicines',
    noMedicines: 'manufacturers.noMedicines',
    rowActions: {
      edit: 'manufacturers.rowActions.edit',
      delete: 'manufacturers.rowActions.delete',
    },
  },
  mrs: {
    records: 'mrs.records',
    empty: 'mrs.empty',
    /** "3 MRs" (plural). */
    count: 'mrs.count',
    columns: {
      name: 'mrs.columns.name',
      represents: 'mrs.columns.represents',
      lastVisit: 'mrs.columns.lastVisit',
      nextVisit: 'mrs.columns.nextVisit',
      samples: 'mrs.columns.samples',
    },
    rowActions: {
      logVisit: 'mrs.rowActions.logVisit',
      edit: 'mrs.rowActions.edit',
      delete: 'mrs.rowActions.delete',
    },
  },
  payments: {
    records: 'payments.records',
    empty: 'payments.empty',
  },
} as const;

/** The Medical tabs' table ids: test-id prefixes and the device prefs' keys. */
export const MEDICAL_TABLE_IDS = {
  sales: 'medical-sales',
  medicines: 'medical-medicines',
  purchases: 'medical-purchases',
  suppliers: 'medical-suppliers',
  manufacturers: 'medical-manufacturers',
  mrs: 'medical-mrs',
  payments: 'medical-payments',
} as const;
