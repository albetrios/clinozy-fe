import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Clinic stock room's i18n namespace. */
export const STOCK_NS = I18N_NAMESPACES.clinicStock;

/**
 * The Clinic stock room's copy, verbatim from `clinic-stock.md` › Copy (KICKOFF
 * §6.8). Room-only, so it never rides the entry chunk.
 */
export const STOCK_KEYS = {
  manifest: { title: 'manifest.title' },
  tabs: {
    /** The tab row's accessible name. */
    label: 'tabs.label',
    items: 'tabs.items',
    purchases: 'tabs.purchases',
    movements: 'tabs.movements',
    vendors: 'tabs.vendors',
  },
  search: { placeholder: 'search.placeholder', label: 'search.label' },
  create: {
    item: 'create.item',
    purchase: 'create.purchase',
    vendor: 'create.vendor',
  },
  /** The Items tab's "Stock check" button. */
  check: 'check',
  filters: {
    all: 'filters.all',
    stock: 'filters.stock',
    lowStock: 'filters.lowStock',
    category: 'filters.category',
    lasts: 'filters.lasts',
    status: 'filters.status',
    type: 'filters.type',
  },
  table: {
    /** "Today 11:05" — a day word and a clock time. */
    when: 'table.when',
    addPhone: 'table.addPhone',
    noValue: 'table.noValue',
  },
  empty: {
    hint: 'empty.hint',
    /** Purchases and Movements ("No stock items here"). */
    stock: 'empty.stock',
  },
  bulk: {
    export: 'bulk.export',
    /** "3 rows exported as CSV" (plural). */
    exported: 'bulk.exported',
  },
  /** `stock_category` labels (`IS_CAT`, H:3722). */
  categories: {
    creams_serums: 'categories.creams_serums',
    peels: 'categories.peels',
    masks: 'categories.masks',
    consumables: 'categories.consumables',
    equipment: 'categories.equipment',
    other: 'categories.other',
  },
  /** `stock_unit` labels — the design never pluralises them ("3 tube"). */
  units: {
    piece: 'units.piece',
    tube: 'units.tube',
    bottle: 'units.bottle',
    kit: 'units.kit',
    pack: 'units.pack',
    box: 'units.box',
    vial: 'units.vial',
    ampoule: 'units.ampoule',
    sachet: 'units.sachet',
    jar: 'units.jar',
    roll: 'units.roll',
    pair: 'units.pair',
    ml: 'units.ml',
    g: 'units.g',
    litre: 'units.litre',
  },
  /** `measure_unit` labels. */
  measures: {
    ml: 'measures.ml',
    g: 'measures.g',
    pcs: 'measures.pcs',
    units: 'measures.units',
  },
  quantity: {
    /** "3 tube", "90 g". */
    amount: 'quantity.amount',
    /** "3 tube · 90 g". */
    measured: 'quantity.measured',
  },
  levels: { ok: 'levels.ok', low: 'levels.low', out: 'levels.out' },
  runway: {
    /** "~5 days" (plural). */
    days: 'runway.days',
    /** "~6 weeks" (plural). */
    weeks: 'runway.weeks',
    none: 'runway.none',
  },
  items: {
    records: 'items.records',
    empty: 'items.empty',
    columns: {
      seq: 'items.columns.seq',
      name: 'items.columns.name',
      category: 'items.columns.category',
      stock: 'items.columns.stock',
      lasts: 'items.columns.lasts',
      vendor: 'items.columns.vendor',
    },
    /** "per tube · uses ~0.5/week". */
    sub: 'items.sub',
    /** "per tube of 30 g · uses ~0.5/week". */
    subContents: 'items.subContents',
    /** "3 tube · 90 g · OK". */
    stockLine: 'items.stockLine',
    rowActions: {
      use: 'items.rowActions.use',
      receive: 'items.rowActions.receive',
      log: 'items.rowActions.log',
      adjust: 'items.rowActions.adjust',
      edit: 'items.rowActions.edit',
      delete: 'items.rowActions.delete',
    },
  },
  purchases: {
    records: 'purchases.records',
    /** "4 purchases · ₹2,310 due" (plural). */
    count: 'purchases.count',
    columns: {
      seq: 'purchases.columns.seq',
      vendor: 'purchases.columns.vendor',
      billNo: 'purchases.columns.billNo',
      date: 'purchases.columns.date',
      bill: 'purchases.columns.bill',
      due: 'purchases.columns.due',
      status: 'purchases.columns.status',
    },
    statuses: {
      paid: 'purchases.statuses.paid',
      partly: 'purchases.statuses.partly',
      unpaid: 'purchases.statuses.unpaid',
    },
    rowActions: {
      /** "Pay ₹1,710" (Q-M1). */
      pay: 'purchases.rowActions.pay',
      edit: 'purchases.rowActions.edit',
      delete: 'purchases.rowActions.delete',
    },
  },
  movements: {
    records: 'movements.records',
    /** "7 entries" (plural). */
    count: 'movements.count',
    columns: {
      type: 'movements.columns.type',
      party: 'movements.columns.party',
      when: 'movements.columns.when',
      by: 'movements.columns.by',
      change: 'movements.columns.change',
    },
    types: {
      used: 'movements.types.used',
      received: 'movements.types.received',
      adjust: 'movements.types.adjust',
      damaged: 'movements.types.damaged',
      returned: 'movements.types.returned',
      reverted: 'movements.types.reverted',
      payment: 'movements.types.payment',
    },
    /** The grey pill a reverted entry adds. */
    reverted: 'movements.reverted',
    /** "Purchase #16". */
    purchase: 'movements.purchase',
    /** "Purchase #16 · SW-77". */
    paymentSub: 'movements.paymentSub',
    /** "− 1 tube", "+ 24 bottle" — the sign, then the amount. */
    change: 'movements.change',
    rowActions: { revert: 'movements.rowActions.revert' },
  },
  vendors: {
    records: 'vendors.records',
    empty: 'vendors.empty',
    /** "5 vendors · ₹2,310 payable" (plural). */
    count: 'vendors.count',
    columns: {
      name: 'vendors.columns.name',
      purchases: 'vendors.columns.purchases',
      payable: 'vendors.columns.payable',
    },
    /** "1 purchase" (plural). */
    purchases: 'vendors.purchases',
    noPurchases: 'vendors.noPurchases',
    rowActions: {
      /** "Pay ₹2,310" (Q-M1). */
      pay: 'vendors.rowActions.pay',
      edit: 'vendors.rowActions.edit',
      delete: 'vendors.rowActions.delete',
    },
  },
} as const;

/** The Clinic stock tabs' table ids: test-id prefixes and the device prefs' keys. */
export const STOCK_TABLE_IDS = {
  items: 'stock-items',
  purchases: 'stock-purchases',
  movements: 'stock-movements',
  vendors: 'stock-vendors',
} as const;
