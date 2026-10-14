import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The record drawer's chrome copy lives in `app`: every room's drawer shares
 * it, and it loads with the org shell — off the entry bundle.
 */
export const RECORD_DRAWER_NS = I18N_NAMESPACES.app;

/**
 * Key paths for the record drawer and its parts (footer, steps, Quick fill).
 * Screen copy — titles, sub lines, a screen's own Save label such as "Create
 * patient" — comes from each room's namespace; these are the shared defaults.
 */
export const RECORD_DRAWER_KEYS = {
  cancel: 'recordDrawer.cancel',
  back: 'recordDrawer.back',
  close: 'recordDrawer.close',
  save: 'recordDrawer.save',
  saving: 'recordDrawer.saving',
  retrySave: 'recordDrawer.retrySave',
  saveAndAdd: 'recordDrawer.saveAndAdd',
  delete: 'recordDrawer.delete',
  notSaved: 'recordDrawer.notSaved',
  /**
   * The failed save's toast (KICKOFF §6.0 Save, network): "Couldn’t save ·
   * connection dropped. Everything you entered is still here." with "Retry".
   */
  saveFailed: 'recordDrawer.saveFailed',
  readOnly: 'recordDrawer.readOnly',
  quickFill: 'recordDrawer.quickFill',
  step: {
    next: 'recordDrawer.step.next',
    edit: 'recordDrawer.step.edit',
    open: 'recordDrawer.step.open',
    missing: 'recordDrawer.step.missing',
    /** A step head's sub line before any of its fields is filled. */
    notFilled: 'recordDrawer.step.notFilled',
    /** Read out with the head: "Step 2 of 3". */
    position: 'recordDrawer.step.position',
    /** Read out with the head: what its circle shows in colour. */
    state: {
      open: 'recordDrawer.step.state.open',
      done: 'recordDrawer.step.state.done',
      missing: 'recordDrawer.step.state.missing',
      later: 'recordDrawer.step.state.later',
      locked: 'recordDrawer.step.state.locked',
    },
  },
  peek: {
    /** Filled fields past the six a collapsed step shows: "+2 more". */
    more: 'recordDrawer.peek.more',
    /** A collapsed step's empty fields, read out and on hover: "Not filled: Email, GSTIN". */
    notFilled: 'recordDrawer.peek.notFilled',
    /** How many fields of a collapsed step are empty: "2 not filled". */
    notFilledCount: 'recordDrawer.peek.notFilledCount',
  },
  /** The clinic currency's sign before a typed amount — a money field's "₹" tile. */
  currency: 'recordDrawer.currency',
  /** A stepper's "−" and "+" (`DrawerStepper`). */
  stepper: {
    decrease: 'recordDrawer.stepper.decrease',
    increase: 'recordDrawer.stepper.increase',
  },
  /** Each tone's colour name — what a swatch announces (`DrawerSwatches`) and its peek shows. */
  colours: {
    butter: 'recordDrawer.colours.butter',
    lav: 'recordDrawer.colours.lav',
    sky: 'recordDrawer.colours.sky',
    sage: 'recordDrawer.colours.sage',
    blush: 'recordDrawer.colours.blush',
    mint: 'recordDrawer.colours.mint',
    peach: 'recordDrawer.colours.peach',
    plum: 'recordDrawer.colours.plum',
    lime: 'recordDrawer.colours.lime',
    slate: 'recordDrawer.colours.slate',
    stone: 'recordDrawer.colours.stone',
  },
} as const;

/** Default `data-testid` of a drawer; screens pass their own (`patient-drawer`). */
export const RECORD_DRAWER_TEST_ID = 'record-drawer';
