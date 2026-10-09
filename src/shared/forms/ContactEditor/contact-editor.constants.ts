import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

import type { ContactPreferencePreset } from './contact-editor-value.ts';

/**
 * The contact editor's copy (`leads.md:439–443`) lives in the shared `clinic`
 * namespace: a contact card in any room opens it. The channel names and the
 * band's "+ Lead" · "+ Appointment" · "+ Patient" are the clinic's own
 * (`CLINIC_KEYS.channels`, `PERSON_CARD_KEYS`).
 */
export const CONTACT_EDITOR_NS = I18N_NAMESPACES.clinic;

/** The contact editor's keys, verbatim from the design. */
export const CONTACT_EDITOR_KEYS = {
  title: 'contactEditor.title',
  sub: 'contactEditor.sub',
  /** The band's name until one is typed. */
  newContact: 'contactEditor.newContact',
  steps: {
    identity: 'contactEditor.steps.identity',
    preferences: 'contactEditor.steps.preferences',
  },
  idHelp: 'contactEditor.idHelp',
  idTooltip: 'contactEditor.idTooltip',
  /** "Copy contact ID <id>". */
  idAria: 'contactEditor.idAria',
  /** "Contact ID <id> copied". */
  idCopied: 'contactEditor.idCopied',
  firstName: 'contactEditor.firstName',
  firstNamePlaceholder: 'contactEditor.firstNamePlaceholder',
  lastName: 'contactEditor.lastName',
  lastNamePlaceholder: 'contactEditor.lastNamePlaceholder',
  mobiles: 'contactEditor.mobiles',
  /** "Mobile <n>". */
  mobileAria: 'contactEditor.mobileAria',
  primary: 'contactEditor.primary',
  primaryTitle: 'contactEditor.primaryTitle',
  setPrimary: 'contactEditor.setPrimary',
  setPrimaryTitle: 'contactEditor.setPrimaryTitle',
  /** "<number> is now the primary number". */
  primaryChanged: 'contactEditor.primaryChanged',
  whatsAppOn: 'contactEditor.whatsAppOn',
  whatsAppOff: 'contactEditor.whatsAppOff',
  removeNumber: 'contactEditor.removeNumber',
  addNumber: 'contactEditor.addNumber',
  addInstagram: 'contactEditor.addInstagram',
  handlePlaceholder: 'contactEditor.handlePlaceholder',
  /** "Instagram <n>". */
  handleAria: 'contactEditor.handleAria',
  removeHandle: 'contactEditor.removeHandle',
  removeHandleTitle: 'contactEditor.removeHandleTitle',
  /** "Removed <handle>". */
  handleRemoved: 'contactEditor.handleRemoved',
  addHandle: 'contactEditor.addHandle',
  defaultChannel: 'contactEditor.defaultChannel',
  /** "· switches to the last channel used", muted after the label. */
  defaultChannelHint: 'contactEditor.defaultChannelHint',
  custom: 'contactEditor.custom',
  customPlaceholder: 'contactEditor.customPlaceholder',
  customAria: 'contactEditor.customAria',
  done: 'contactEditor.done',
  /** "Contact updated · applies everywhere" — a save from a lead or a contact card. */
  updated: 'contactEditor.updated',
  /** The preset preferences' labels, by their tags. */
  preferences: {
    no_calls: 'contactEditor.preferences.noCalls',
    sundays_only: 'contactEditor.preferences.sundaysOnly',
    weekdays_only: 'contactEditor.preferences.weekdaysOnly',
    after_six_pm: 'contactEditor.preferences.afterSix',
    mornings: 'contactEditor.preferences.mornings',
    evenings: 'contactEditor.preferences.evenings',
    weekends_only: 'contactEditor.preferences.weekendsOnly',
    gujarati: 'contactEditor.preferences.gujarati',
    hindi: 'contactEditor.preferences.hindi',
    english: 'contactEditor.preferences.english',
    female_doctor: 'contactEditor.preferences.femaleDoctor',
    text_before_calling: 'contactEditor.preferences.textFirst',
  } satisfies Record<ContactPreferencePreset, string>,
} as const;

/** The editor's root test id; its parts derive theirs (`contact-editor-done` …). */
export const CONTACT_EDITOR_TEST_ID = 'contact-editor';
