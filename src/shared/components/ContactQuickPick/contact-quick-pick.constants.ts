import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The contact picker's copy lives in `app`, beside the contact editor's. */
export const CONTACT_QUICK_PICK_NS = I18N_NAMESPACES.app;

/** Key paths for {@link ContactQuickPick}. */
export const CONTACT_QUICK_PICK_KEYS = {
  recent: 'contactPick.recent',
  keepTyping: 'contactPick.keepTyping',
  searching: 'contactPick.searching',
  /** Plural: "3 people found". */
  found: 'contactPick.found',
  noMatch: 'contactPick.noMatch',
  /** "Add “<name>” as a new contact". */
  addNamed: 'contactPick.addNamed',
  /** "Add <phone> as a new contact". */
  addPhone: 'contactPick.addPhone',
  /** "Add “<name>” · <phone> as a new contact". */
  addNamedPhone: 'contactPick.addNamedPhone',
  enterKey: 'contactPick.enterKey',
  clearSearch: 'contactPick.clearSearch',
  quickAdd: {
    name: 'contactPick.quickAdd.name',
    namePlaceholder: 'contactPick.quickAdd.namePlaceholder',
    mobile: 'contactPick.quickAdd.mobile',
    add: 'contactPick.quickAdd.add',
    more: 'contactPick.quickAdd.more',
    back: 'contactPick.quickAdd.back',
    addName: 'contactPick.quickAdd.addName',
    needMobile: 'contactPick.quickAdd.needMobile',
    mobileDigits: 'contactPick.quickAdd.mobileDigits',
  },
} as const;

/**
 * The test ids of the picker's own parts, from the host's root id: `<root>-recent`,
 * `<root>-loading`, `<root>-quick-add-name` … The search, a hit, the add row and "No existing
 * match" take the host's own ids (`ContactQuickPickTestIds`).
 */
export const CONTACT_QUICK_PICK_TEST_IDS = {
  recent: (root: string) => `${root}-recent`,
  results: (root: string) => `${root}-results`,
  loading: (root: string) => `${root}-loading`,
  progress: (root: string) => `${root}-progress`,
  hint: (root: string) => `${root}-hint`,
  status: (root: string) => `${root}-status`,
  clear: (root: string) => `${root}-clear`,
  quickAdd: (root: string) => `${root}-quick-add`,
  quickAddName: (root: string) => `${root}-quick-add-name`,
  quickAddMobile: (root: string) => `${root}-quick-add-mobile`,
  quickAddSubmit: (root: string) => `${root}-quick-add-submit`,
  quickAddMore: (root: string) => `${root}-quick-add-more`,
  quickAddBack: (root: string) => `${root}-quick-add-back`,
} as const;
