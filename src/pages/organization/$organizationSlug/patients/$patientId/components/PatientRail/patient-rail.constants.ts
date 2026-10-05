import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The rail reads the patient file's namespace. */
export const PATIENT_RAIL_NS = I18N_NAMESPACES.patientFile;

/** The rail's copy (`patient-file.md:508–511`, verbatim; plurals for the counts). */
export const PATIENT_RAIL_KEYS = {
  copyId: 'rail.copyId',
  idCopied: 'rail.idCopied',
  /** "Since 24 Sep 2026" — the tenure line's tooltip. */
  since: 'rail.since',
  joinedToday: 'rail.joinedToday',
  /** "45 days as patient" (plural). */
  daysAsPatient: 'rail.daysAsPatient',
  /** "3 months as patient" (plural). */
  monthsAsPatient: 'rail.monthsAsPatient',
  editContact: 'rail.editContact',
  reach: 'rail.reach',
  reachSub: {
    whatsappPrimary: 'rail.reachSub.whatsappPrimary',
    fromLead: 'rail.reachSub.fromLead',
    mobile: 'rail.reachSub.mobile',
    instagram: 'rail.reachSub.instagram',
  },
  /** "•••• 3212" — a number until its eye is pressed. */
  maskedNumber: 'rail.maskedNumber',
  showNumber: 'rail.showNumber',
  hideNumber: 'rail.hideNumber',
  openWhatsApp: 'rail.openWhatsApp',
  call: 'rail.call',
  openInstagram: 'rail.openInstagram',
  numberCopied: 'rail.numberCopied',
  handleCopied: 'rail.handleCopied',
  about: 'rail.about',
  /** "🎂 in 24 days" (plural). */
  birthdayIn: 'rail.birthdayIn',
  birthdayToday: 'rail.birthdayToday',
  noAddress: 'rail.noAddress',
  upNext: 'rail.upNext',
  /** "Hydrafacial · 45 min". */
  visitService: 'rail.visitService',
  reschedule: 'rail.reschedule',
  book: 'rail.book',
  notBooked: 'rail.notBooked',
  noUpcoming: 'rail.noUpcoming',
  /** "₹ ••••" — money while the file is masked (Q-F4). */
  maskedAmount: 'rail.maskedAmount',
  /** "since 12 days" (plural). */
  dueSince: 'rail.dueSince',
  showAmount: 'rail.showAmount',
  hideAmount: 'rail.hideAmount',
  collect: 'rail.collect',
  /** "₹500 to return". */
  creditToReturn: 'rail.creditToReturn',
  allPaid: 'rail.allPaid',
  feedback: 'rail.feedback',
  /** "Better · 7/10". */
  feedbackScore: 'rail.feedbackScore',
  /** "5★ on Google". */
  feedbackReview: 'rail.feedbackReview',
  noFeedback: 'rail.noFeedback',
} as const;

/** The rail's test id (KICKOFF §6.6 Test ids). */
export const PATIENT_RAIL_TEST_ID = 'patient-rail';
