import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import { CONTACT_EDITOR_KEYS } from '@/shared/forms/ContactEditor/contact-editor.constants.ts';

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
  enterKey: 'contactPick.enterKey',
  clearSearch: 'contactPick.clearSearch',
  /** "<name> added to contacts" — a quick add that made the contact. */
  added: 'contactPick.added',
  /** "<name> is already a contact · picked" — the mobile was theirs. */
  existing: 'contactPick.existing',
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
  /** A patients-only picker's words (Receive payment, the Invoice drawer — D23). */
  patient: {
    newPatient: 'contactPick.patient.newPatient',
    add: 'contactPick.patient.add',
    added: 'contactPick.patient.added',
    existing: 'contactPick.patient.existing',
  },
} as const;

/** The add row's and the quick add's words, by whom the picker reads (`ContactScope`). */
export const CONTACT_QUICK_PICK_ADD_KEYS = {
  everyone: {
    /** The add row on an empty search, and the quick add's title. */
    newPerson: CONTACT_EDITOR_KEYS.newContact,
    submit: CONTACT_QUICK_PICK_KEYS.quickAdd.add,
  },
  patients: {
    newPerson: CONTACT_QUICK_PICK_KEYS.patient.newPatient,
    submit: CONTACT_QUICK_PICK_KEYS.patient.add,
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
  quickAddInstagram: (root: string) => `${root}-quick-add-instagram`,
  /** One value on the add row (`name`, `phone`, `instagram`), from the add row's own id. */
  addValue: (addRow: string, kind: string) => `${addRow}-${kind}`,
  quickAddSubmit: (root: string) => `${root}-quick-add-submit`,
  quickAddMore: (root: string) => `${root}-quick-add-more`,
  quickAddBack: (root: string) => `${root}-quick-add-back`,
} as const;
