import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Medical drawers' copy lives in the room's namespace: only this room opens them. */
export const MEDICAL_DRAWERS_NS = I18N_NAMESPACES.medical;

/**
 * Key paths for the Medical record drawers (`medical.md` › Forms, Popups,
 * Copy; verbatim): what every drawer shares — the records a "not found" toast
 * names, the partner pickers, the quick records, the delete confirm — then
 * each drawer's own words.
 */
export const MEDICAL_DRAWER_KEYS = {
  /** "<Record> not found · it may have been deleted" (`S:115`). */
  records: {
    medicine: 'drawers.records.medicine',
    supplier: 'drawers.records.supplier',
    manufacturer: 'drawers.records.manufacturer',
    mr: 'drawers.records.mr',
  },
  /** An edit drawer's primary (`medical.md:185, 203, 219, 234`). */
  saveChanges: 'drawers.saveChanges',
  /** "Add a name" — each record's one required field. */
  addName: 'drawers.addName',
  /** The partner pickers' searches, rows, groups and create actions. */
  pickers: {
    searchManufacturer: 'drawers.pickers.searchManufacturer',
    searchManufacturers: 'drawers.pickers.searchManufacturers',
    searchSupplier: 'drawers.pickers.searchSupplier',
    searchSuppliers: 'drawers.pickers.searchSuppliers',
    searchMrs: 'drawers.pickers.searchMrs',
    /** "2 medicines" — a manufacturer option's sub line (plural). */
    medicineCount: 'drawers.pickers.medicineCount',
    /** A partner option without a phone. */
    noPhone: 'drawers.pickers.noPhone',
    /** "Distributes ALVI" — the supplier picker's first group. */
    distributes: 'drawers.pickers.distributes',
    otherSuppliers: 'drawers.pickers.otherSuppliers',
    addManufacturer: 'drawers.pickers.addManufacturer',
    newManufacturer: 'drawers.pickers.newManufacturer',
    addSupplier: 'drawers.pickers.addSupplier',
    newSupplier: 'drawers.pickers.newSupplier',
    addMr: 'drawers.pickers.addMr',
    newMr: 'drawers.pickers.newMr',
  },
  /** The quick records' toasts (`medical.md:315–318`). */
  quick: {
    manufacturer: 'drawers.quick.manufacturer',
    supplier: 'drawers.quick.supplier',
    mr: 'drawers.quick.mr',
    medicine: 'drawers.quick.medicine',
  },
  /** The reason confirm (`medical.md:366`): titles and the "deleted" toast. */
  deleteConfirm: {
    medicine: 'drawers.deleteConfirm.medicine',
    supplier: 'drawers.deleteConfirm.supplier',
    manufacturer: 'drawers.deleteConfirm.manufacturer',
    mr: 'drawers.deleteConfirm.mr',
    /** "Glycolac Cream deleted". */
    deleted: 'drawers.deleteConfirm.deleted',
  },
  /** New / Edit manufacturer (`medical.md:208–222`). */
  manufacturer: {
    title: {
      create: 'drawers.manufacturer.title.create',
      edit: 'drawers.manufacturer.title.edit',
    },
    sub: 'drawers.manufacturer.sub',
    steps: {
      maker: 'drawers.manufacturer.steps.maker',
      connections: 'drawers.manufacturer.steps.connections',
    },
    fields: {
      name: 'drawers.manufacturer.fields.name',
      colour: 'drawers.manufacturer.fields.colour',
      suppliers: 'drawers.manufacturer.fields.suppliers',
      suppliersHint: 'drawers.manufacturer.fields.suppliersHint',
      mrs: 'drawers.manufacturer.fields.mrs',
      mrsHint: 'drawers.manufacturer.fields.mrsHint',
      medicines: 'drawers.manufacturer.fields.medicines',
      /** "1 medicine in Stock" (plural). */
      medicineCount: 'drawers.manufacturer.fields.medicineCount',
      noMedicines: 'drawers.manufacturer.fields.noMedicines',
    },
    /** The footer's "· 2 suppliers · 1 MR" (each plural). */
    summary: {
      suppliers: 'drawers.manufacturer.summary.suppliers',
      mrs: 'drawers.manufacturer.summary.mrs',
    },
    save: 'drawers.manufacturer.save',
    saved: 'drawers.manufacturer.saved',
  },
  /** New / Edit supplier (`medical.md:190–206`). */
  supplier: {
    title: {
      create: 'drawers.supplier.title.create',
      edit: 'drawers.supplier.title.edit',
    },
    sub: 'drawers.supplier.sub',
    steps: {
      supplier: 'drawers.supplier.steps.supplier',
      distributes: 'drawers.supplier.steps.distributes',
      account: 'drawers.supplier.steps.account',
    },
    fields: {
      name: 'drawers.supplier.fields.name',
      phone: 'drawers.supplier.fields.phone',
      phoneHint: 'drawers.supplier.fields.phoneHint',
      gst: 'drawers.supplier.fields.gst',
      manufacturers: 'drawers.supplier.fields.manufacturers',
      manufacturersHint: 'drawers.supplier.fields.manufacturersHint',
      payable: 'drawers.supplier.fields.payable',
      /** "₹827 · 5 days" (plural on the days). */
      payableValue: 'drawers.supplier.fields.payableValue',
      nothingDue: 'drawers.supplier.fields.nothingDue',
      orders: 'drawers.supplier.fields.orders',
      /** "1 order · ₹4,236" (plural). */
      ordersValue: 'drawers.supplier.fields.ordersValue',
      noOrders: 'drawers.supplier.fields.noOrders',
    },
    /** The Account rows (`medical.md:200`). */
    account: {
      label: 'drawers.supplier.account.label',
      reference: 'drawers.supplier.account.reference',
      date: 'drawers.supplier.account.date',
      stage: 'drawers.supplier.account.stage',
      amount: 'drawers.supplier.account.amount',
      balance: 'drawers.supplier.account.balance',
      notBilled: 'drawers.supplier.account.notBilled',
      due: 'drawers.supplier.account.due',
      paid: 'drawers.supplier.account.paid',
      credit: 'drawers.supplier.account.credit',
      creditStage: 'drawers.supplier.account.creditStage',
      adjusted: 'drawers.supplier.account.adjusted',
    },
    quickFill: { newOrder: 'drawers.supplier.quickFill.newOrder' },
    save: 'drawers.supplier.save',
    saved: 'drawers.supplier.saved',
  },
  /** New / Edit MR (`medical.md:224–237`). */
  mr: {
    title: { create: 'drawers.mr.title.create', edit: 'drawers.mr.title.edit' },
    sub: 'drawers.mr.sub',
    steps: { mr: 'drawers.mr.steps.mr', represents: 'drawers.mr.steps.represents' },
    fields: {
      name: 'drawers.mr.fields.name',
      phone: 'drawers.mr.fields.phone',
      phoneHint: 'drawers.mr.fields.phoneHint',
      nextVisit: 'drawers.mr.fields.nextVisit',
      manufacturers: 'drawers.mr.fields.manufacturers',
      manufacturersHint: 'drawers.mr.fields.manufacturersHint',
    },
    save: 'drawers.mr.save',
    saved: 'drawers.mr.saved',
  },
  /** Log MR visit (`medical.md:239–252`). */
  visit: {
    title: 'drawers.visit.title',
    steps: {
      visit: 'drawers.visit.steps.visit',
      details: 'drawers.visit.steps.details',
      notes: 'drawers.visit.steps.notes',
    },
    fields: {
      date: 'drawers.visit.fields.date',
      nextVisit: 'drawers.visit.fields.nextVisit',
      twoWeeks: 'drawers.visit.fields.twoWeeks',
      oneMonth: 'drawers.visit.fields.oneMonth',
      samples: 'drawers.visit.fields.samples',
      samplesPlaceholder: 'drawers.visit.fields.samplesPlaceholder',
      note: 'drawers.visit.fields.note',
    },
    /** "Next visit 12 Oct". */
    summary: 'drawers.visit.summary',
    save: 'drawers.visit.save',
    /** "Visit logged · reminder set for 12 Oct". */
    saved: 'drawers.visit.saved',
    /** A visit logged with no next one set. */
    savedNoReminder: 'drawers.visit.savedNoReminder',
  },
  /** New / Edit medicine (`medical.md:170–188`). */
  medicine: {
    title: {
      create: 'drawers.medicine.title.create',
      edit: 'drawers.medicine.title.edit',
    },
    /** "ALVI · Adapalene 0.1% + Clindamycin". */
    sub: 'drawers.medicine.sub',
    /** "ALVI · composition not set". */
    subNoComposition: 'drawers.medicine.subNoComposition',
    steps: {
      main: 'drawers.medicine.steps.main',
      batches: 'drawers.medicine.steps.batches',
    },
    /** The 11px section labels inside the steps (H:3836). */
    groups: {
      medicine: 'drawers.medicine.groups.medicine',
      price: 'drawers.medicine.groups.price',
    },
    fields: {
      name: 'drawers.medicine.fields.name',
      manufacturer: 'drawers.medicine.fields.manufacturer',
      composition: 'drawers.medicine.fields.composition',
      compositionHint: 'drawers.medicine.fields.compositionHint',
      compositionPlaceholder: 'drawers.medicine.fields.compositionPlaceholder',
      soldWith: 'drawers.medicine.fields.soldWith',
      prescriptionOnly: 'drawers.medicine.fields.prescriptionOnly',
      overTheCounter: 'drawers.medicine.fields.overTheCounter',
    },
    /** The price panel (H:2916). */
    price: {
      mrp: 'drawers.medicine.price.mrp',
      inclGst: 'drawers.medicine.price.inclGst',
      gst: 'drawers.medicine.price.gst',
      beforeGst: 'drawers.medicine.price.beforeGst',
      /** "GST 18%". */
      gstAmount: 'drawers.medicine.price.gstAmount',
      bestBuyRate: 'drawers.medicine.price.bestBuyRate',
      addSupplierPrice: 'drawers.medicine.price.addSupplierPrice',
      margin: 'drawers.medicine.price.margin',
    },
    /** The stock levels panel (H:2917). */
    stock: {
      title: 'drawers.medicine.stock.title',
      /** "8 in stock · Healthy". */
      now: 'drawers.medicine.stock.now',
      states: {
        healthy: 'drawers.medicine.stock.states.healthy',
        reorder: 'drawers.medicine.stock.states.reorder',
        overstocked: 'drawers.medicine.stock.states.overstocked',
        out: 'drawers.medicine.stock.states.out',
      },
      reorderAt: 'drawers.medicine.stock.reorderAt',
      fillUpTo: 'drawers.medicine.stock.fillUpTo',
      decreaseReorder: 'drawers.medicine.stock.decreaseReorder',
      increaseReorder: 'drawers.medicine.stock.increaseReorder',
      decreaseFill: 'drawers.medicine.stock.decreaseFill',
      increaseFill: 'drawers.medicine.stock.increaseFill',
      /** "Reorder alert when stock falls to 2." */
      hintAlert: 'drawers.medicine.stock.hintAlert',
      /** "Order 10 to fill up to 10. Shows under Stock › Low stock." */
      hintOrder: 'drawers.medicine.stock.hintOrder',
    },
    batches: {
      title: 'drawers.medicine.batches.title',
      batch: 'drawers.medicine.batches.batch',
      expiry: 'drawers.medicine.batches.expiry',
      expiryPlaceholder: 'drawers.medicine.batches.expiryPlaceholder',
      qty: 'drawers.medicine.batches.qty',
      rate: 'drawers.medicine.batches.rate',
      add: 'drawers.medicine.batches.add',
      /** "8 in stock" — the batches' total. */
      total: 'drawers.medicine.batches.total',
      /** "Enter the expiry as MM/YY". */
      expiryInvalid: 'drawers.medicine.batches.expiryInvalid',
      batchMissing: 'drawers.medicine.batches.batchMissing',
    },
    rates: {
      title: 'drawers.medicine.rates.title',
      supplier: 'drawers.medicine.rates.supplier',
      rate: 'drawers.medicine.rates.rate',
      free: 'drawers.medicine.rates.free',
      leadDays: 'drawers.medicine.rates.leadDays',
      add: 'drawers.medicine.rates.add',
      /** The red rate cell's tooltip: "Enter this supplier’s rate". */
      rateMissing: 'drawers.medicine.rates.rateMissing',
    },
    badges: {
      /** "8 in stock". */
      inStock: 'drawers.medicine.badges.inStock',
      /** "Best ₹440 · K R Medical Agency". */
      best: 'drawers.medicine.badges.best',
    },
    save: 'drawers.medicine.save',
    toasts: {
      /** "Added Azelan 20% Cream". */
      added: 'drawers.medicine.toasts.added',
      /** "Saved Azelan 20% Cream". */
      saved: 'drawers.medicine.toasts.saved',
      enterMrp: 'drawers.medicine.toasts.enterMrp',
      enterRates: 'drawers.medicine.toasts.enterRates',
      /** "Pick a manufacturer" — when no maker is picked yet. */
      pickManufacturer: 'drawers.medicine.toasts.pickManufacturer',
    },
  },
} as const;

/** The drawers' root test ids; their parts derive theirs (`medicine-drawer-save` …). */
export const MEDICAL_DRAWER_TEST_IDS = {
  medicine: 'medicine-drawer',
  supplier: 'supplier-drawer',
  manufacturer: 'manufacturer-drawer',
  mr: 'mr-drawer',
  visit: 'mr-visit-drawer',
} as const;

/** A drawer stacked on another takes its kind's id with this suffix (`supplier-drawer-stacked`). */
export const MEDICAL_STACKED_SUFFIX = '-stacked';
