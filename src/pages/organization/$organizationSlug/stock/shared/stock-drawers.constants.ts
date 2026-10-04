import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Clinic stock drawers' i18n namespace — the room's own. */
export const STOCK_DRAWERS_NS = I18N_NAMESPACES.clinicStock;

/**
 * The Clinic stock drawers', popover's and confirms' copy, verbatim from
 * `clinic-stock.md` › Forms, Popups and Copy (KICKOFF §6.8 Drawers).
 */
export const STOCK_DRAWER_KEYS = {
  /** "<Record> not found · it may have been deleted" (`S:115`). */
  records: {
    item: 'drawers.records.item',
    purchase: 'drawers.records.purchase',
    vendor: 'drawers.records.vendor',
  },
  saveChanges: 'drawers.saveChanges',
  addName: 'drawers.addName',
  pickers: {
    searchVendors: 'drawers.pickers.searchVendors',
    vendorsHint: 'drawers.pickers.vendorsHint',
    newVendor: 'drawers.pickers.newVendor',
    selectItem: 'drawers.pickers.selectItem',
    newItem: 'drawers.pickers.newItem',
    /** "14 in stock". */
    inStock: 'drawers.pickers.inStock',
  },
  /** The "Used for" chips (`clinic-stock.md:96`). */
  treatments: {
    lhr: 'drawers.treatments.lhr',
    peel: 'drawers.treatments.peel',
    facial: 'drawers.treatments.facial',
    mole: 'drawers.treatments.mole',
    general: 'drawers.treatments.general',
  },
  item: {
    title: { create: 'drawers.item.title.create', edit: 'drawers.item.title.edit' },
    sub: 'drawers.item.sub',
    steps: {
      item: 'drawers.item.steps.item',
      levels: 'drawers.item.steps.levels',
      vendor: 'drawers.item.steps.vendor',
    },
    fields: {
      name: 'drawers.item.fields.name',
      category: 'drawers.item.fields.category',
      unit: 'drawers.item.fields.unit',
      /** "Contents per tube". */
      contents: 'drawers.item.fields.contents',
      /** "optional · lets the team use part of a tube". */
      contentsHint: 'drawers.item.fields.contentsHint',
      measure: 'drawers.item.fields.measure',
      inStock: 'drawers.item.fields.inStock',
      decimals: 'drawers.item.fields.decimals',
      usage: 'drawers.item.fields.usage',
      min: 'drawers.item.fields.min',
      max: 'drawers.item.fields.max',
      vendor: 'drawers.item.fields.vendor',
    },
    save: 'drawers.item.save',
    saved: 'drawers.item.saved',
  },
  /** The stacked "New clinic item" (`clinic-stock.md:187–201`). */
  quickItem: {
    title: 'drawers.quickItem.title',
    sub: 'drawers.quickItem.sub',
    steps: {
      item: 'drawers.quickItem.steps.item',
      details: 'drawers.quickItem.steps.details',
    },
    /** "Cotton added to clinic items". */
    added: 'drawers.quickItem.added',
  },
  vendor: {
    title: { create: 'drawers.vendor.title.create', edit: 'drawers.vendor.title.edit' },
    sub: 'drawers.vendor.sub',
    fields: {
      name: 'drawers.vendor.fields.name',
      phone: 'drawers.vendor.fields.phone',
      phoneHint: 'drawers.vendor.fields.phoneHint',
    },
    save: 'drawers.vendor.save',
    /** "Vendor Ankit Traders added". */
    added: 'drawers.vendor.added',
    saved: 'drawers.vendor.saved',
  },
  movement: {
    title: {
      used: 'drawers.movement.title.used',
      received: 'drawers.movement.title.received',
      adjust: 'drawers.movement.title.adjust',
    },
    /** "Soframycin 30 gm · 3 tube · 90 g now". */
    sub: 'drawers.movement.sub',
    /** "After: 2 tube · 60 g". */
    after: 'drawers.movement.after',
    steps: {
      movement: 'drawers.movement.steps.movement',
      details: 'drawers.movement.steps.details',
      notes: 'drawers.movement.steps.notes',
    },
    fields: {
      type: 'drawers.movement.fields.type',
      quantity: 'drawers.movement.fields.quantity',
      counted: 'drawers.movement.fields.counted',
      decimals: 'drawers.movement.fields.decimals',
      measureIn: 'drawers.movement.fields.measureIn',
      /** "g (1 tube = 30 g)". */
      measureOption: 'drawers.movement.fields.measureOption',
      usedFor: 'drawers.movement.fields.usedFor',
      optional: 'drawers.movement.fields.optional',
      remark: 'drawers.movement.fields.remark',
      remarkPlaceholder: 'drawers.movement.fields.remarkPlaceholder',
    },
    save: 'drawers.movement.save',
    /** "Soframycin 30 gm · −1 tube". */
    summary: 'drawers.movement.summary',
    enterQuantity: 'drawers.movement.enterQuantity',
    /** "Only 3 tube · 90 g in stock". */
    onlyInStock: 'drawers.movement.onlyInStock',
    /** "Used saved · 2 tube left". */
    saved: 'drawers.movement.saved',
  },
  /** The Use popover (`clinic-stock.md:89–103, 205–217`). */
  use: {
    label: 'drawers.use.label',
    inStock: 'drawers.use.inStock',
    measureIn: 'drawers.use.measureIn',
    /** "1 tube = 30 g". */
    conversion: 'drawers.use.conversion',
    quantity: 'drawers.use.quantity',
    less: 'drawers.use.less',
    more: 'drawers.use.more',
    usedFor: 'drawers.use.usedFor',
    /** "After · 2 tube · 60 g". */
    after: 'drawers.use.after',
    moreDetails: 'drawers.use.moreDetails',
    /** "Use 1 tube". */
    save: 'drawers.use.save',
    /** "1 tube of Soframycin 30 gm used · 2 tube left". */
    used: 'drawers.use.used',
    /** "D-Tan Mask is out of stock". */
    outOfStock: 'drawers.use.outOfStock',
  },
  purchase: {
    title: {
      create: 'drawers.purchase.title.create',
      edit: 'drawers.purchase.title.edit',
    },
    sub: 'drawers.purchase.sub',
    reorder: 'drawers.purchase.reorder',
    noSupplier: 'drawers.purchase.noSupplier',
    /** "Bill ₹1,710". */
    bill: 'drawers.purchase.bill',
    /** "₹1,710 due". */
    due: 'drawers.purchase.due',
    paid: 'drawers.purchase.paid',
    steps: {
      bill: 'drawers.purchase.steps.bill',
      items: 'drawers.purchase.steps.items',
      payment: 'drawers.purchase.steps.payment',
    },
    fields: {
      vendor: 'drawers.purchase.fields.vendor',
      billNo: 'drawers.purchase.fields.billNo',
      date: 'drawers.purchase.fields.date',
      items: 'drawers.purchase.fields.items',
      item: 'drawers.purchase.fields.item',
      qty: 'drawers.purchase.fields.qty',
      rate: 'drawers.purchase.fields.rate',
      amount: 'drawers.purchase.fields.amount',
      addItem: 'drawers.purchase.fields.addItem',
      total: 'drawers.purchase.fields.total',
      billAmount: 'drawers.purchase.fields.billAmount',
      paid: 'drawers.purchase.fields.paid',
      full: 'drawers.purchase.fields.full',
      nothing: 'drawers.purchase.fields.nothing',
      enterRate: 'drawers.purchase.fields.enterRate',
      /** "2 items · ₹1,710". */
      peek: 'drawers.purchase.fields.peek',
    },
    save: 'drawers.purchase.save',
    pickSupplier: 'drawers.purchase.pickSupplier',
    saved: 'drawers.purchase.saved',
    savedStock: 'drawers.purchase.savedStock',
  },
  check: {
    title: 'drawers.check.title',
    sub: 'drawers.check.sub',
    /** "2 of 10 counted". */
    counted: 'drawers.check.counted',
    allItems: 'drawers.check.allItems',
    fillRest: 'drawers.check.fillRest',
    heads: {
      item: 'drawers.check.heads.item',
      inSystem: 'drawers.check.heads.inSystem',
      counted: 'drawers.check.heads.counted',
      difference: 'drawers.check.heads.difference',
    },
    /** "In system · 3 tube · 90 g" — a phone card's top line. */
    inSystem: 'drawers.check.inSystem',
    /** "Counted Soframycin 30 gm" — the input's name. */
    countedLabel: 'drawers.check.countedLabel',
    same: 'drawers.check.same',
    /** "= 90 g". */
    measured: 'drawers.check.measured',
    notCounted: 'drawers.check.notCounted',
    matches: 'drawers.check.matches',
    /** "1 item will change" (plural). */
    willChange: 'drawers.check.willChange',
    nothing: 'drawers.check.nothing',
    save: 'drawers.check.save',
    failed: 'drawers.check.failed',
    /** "Stock check saved · 1 item updated" (plural). */
    saved: 'drawers.check.saved',
  },
  confirm: {
    deleteItem: 'drawers.confirm.deleteItem',
    deletePurchase: 'drawers.confirm.deletePurchase',
    deleteVendor: 'drawers.confirm.deleteVendor',
    /** "Soframycin 30 gm removed" — a row's Delete. */
    removed: 'drawers.confirm.removed',
    /** "Soframycin 30 gm deleted" — the drawer's Delete. */
    deleted: 'drawers.confirm.deleted',
    /** "Purchase #15 deleted". */
    purchaseDeleted: 'drawers.confirm.purchaseDeleted',
    revert: {
      title: 'drawers.confirm.revert.title',
      /** "used of 1 tube Noprik Plus numbing cream 50 gm". */
      record: 'drawers.confirm.revert.record',
      body: 'drawers.confirm.revert.body',
      action: 'drawers.confirm.revert.action',
      reasons: {
        mistake: 'drawers.confirm.revert.reasons.mistake',
        wrongItem: 'drawers.confirm.revert.reasons.wrongItem',
        wrongQty: 'drawers.confirm.revert.reasons.wrongQty',
      },
      /** "Used reverted · Noprik Plus numbing cream 50 gm back to 6 tube". */
      done: 'drawers.confirm.revert.done',
      /** A Reverted row's note: "Reverts used of Today 11:05 · Logged by mistake". */
      note: 'drawers.confirm.revert.note',
    },
  },
} as const;

/** The drawers' and the popover's root test ids. */
export const STOCK_DRAWER_TEST_IDS = {
  item: 'stock-item-drawer',
  quickItem: 'stock-new-item-drawer',
  vendor: 'stock-vendor-drawer',
  movement: 'stock-movement-drawer',
  purchase: 'stock-purchase-drawer',
  check: 'stock-check-drawer',
  use: 'stock-use-popover',
} as const;

/** A child drawer stacked on another adds this to its id (`stock-vendor-drawer-stacked`). */
export const STOCK_STACKED_SUFFIX = '-stacked';
