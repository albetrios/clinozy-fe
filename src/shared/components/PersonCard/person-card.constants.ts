import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/**
 * Person-card copy lives in `app`: any room's person can open one, and it
 * loads with the org shell — off the entry bundle.
 */
export const PERSON_CARD_NS = I18N_NAMESPACES.app;

/** Key paths for the contact and team cards (verbatim from `_patterns.md:209–229`). */
export const PERSON_CARD_KEYS = {
  contactLabel: 'personCard.contactLabel',
  openPatientFile: 'personCard.openPatientFile',
  since: 'personCard.since',
  leadSince: 'personCard.leadSince',
  kind: {
    patient: 'personCard.kind.patient',
    lead: 'personCard.kind.lead',
    contact: 'personCard.kind.contact',
  },
  editContact: 'personCard.editContact',
  changeContact: 'personCard.changeContact',
  changeContactHint: 'personCard.changeContactHint',
  reach: 'personCard.reach',
  team: 'personCard.team',
  about: 'personCard.about',
  reachSub: {
    whatsappPrimary: 'personCard.reachSub.whatsappPrimary',
    whatsappAlternate: 'personCard.reachSub.whatsappAlternate',
    phonePrimary: 'personCard.reachSub.phonePrimary',
    phoneAlternate: 'personCard.reachSub.phoneAlternate',
    instagram: 'personCard.reachSub.instagram',
  },
  whatsApp: 'personCard.whatsApp',
  call: 'personCard.call',
  openInstagram: 'personCard.openInstagram',
  copy: 'personCard.copy',
  copied: 'personCard.copied',
  noReach: 'personCard.noReach',
  claim: 'personCard.claim',
  claimHint: 'personCard.claimHint',
  gender: {
    female: 'personCard.gender.female',
    male: 'personCard.gender.male',
    other: 'personCard.gender.other',
  },
  genderAge: 'personCard.genderAge',
  age: 'personCard.age',
  /** The mark after an age the desk typed ("34 yrs · approx.") and its tooltip (feat-approximate-age FE3). */
  approximate: 'personCard.approximate',
  approximateHint: 'personCard.approximateHint',
  cameVia: 'personCard.cameVia',
  owedToThem: 'personCard.owedToThem',
  owedByThem: 'personCard.owedByThem',
  /** Plural (`_one` / `_other`, and each locale's own categories). */
  reviews: 'personCard.reviews',
  consent: {
    data: 'personCard.consent.data',
    photos: 'personCard.consent.photos',
    marketing: 'personCard.consent.marketing',
    hint: 'personCard.consent.hint',
    given: 'personCard.consent.given',
    missing: 'personCard.consent.missing',
  },
  newLead: 'personCard.newLead',
  newLeadHint: 'personCard.newLeadHint',
  newAppointment: 'personCard.newAppointment',
  newAppointmentHint: 'personCard.newAppointmentHint',
  newPatient: 'personCard.newPatient',
  newPatientHint: 'personCard.newPatientHint',
  online: 'personCard.online',
  offline: 'personCard.offline',
  memberKind: {
    assigned: 'personCard.memberKind.assigned',
    sentThis: 'personCard.memberKind.sentThis',
    treating: 'personCard.memberKind.treating',
    involved: 'personCard.memberKind.involved',
  },
  assignToYourself: 'personCard.assignToYourself',
  works: 'personCard.works',
  updated: 'personCard.updated',
  fetching: 'personCard.fetching',
} as const;
