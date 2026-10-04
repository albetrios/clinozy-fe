import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * The record drawer's chrome copy lives in `clinic`: every room's drawer shares
 * it, and it loads with the org shell — off the entry bundle.
 */
export const RECORD_DRAWER_NS = I18N_NAMESPACES.clinic;

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
  },
  peek: {
    empty: 'recordDrawer.peek.empty',
    added: 'recordDrawer.peek.added',
    noneYet: 'recordDrawer.peek.noneYet',
  },
} as const;

/** Default `data-testid` of a drawer; screens pass their own (`patient-drawer`). */
export const RECORD_DRAWER_TEST_ID = 'record-drawer';
