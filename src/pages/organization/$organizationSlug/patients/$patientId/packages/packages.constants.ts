import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** Add package reads the patient file's namespace. */
export const PACKAGE_NS = I18N_NAMESPACES.patientFile;

/** Add package (H:4833–4835; `patient-file.md:158–169`; KICKOFF §6.6), verbatim. */
export const PACKAGE_KEYS = {
  title: 'package.title',
  step: 'package.step',
  /** "LHR Full Face · 7s · ₹4,800". */
  option: 'package.option',
  /** No offering of more than one session to pick. */
  empty: 'package.empty',
  summary: 'package.summary',
  save: 'package.save',
  noPick: 'package.noPick',
  added: 'package.added',
  /** A package's card on the section (H:833; `patient-file.md:70–79`). */
  card: {
    /** "6 left" (plural). */
    left: 'package.card.left',
    /** "1 of 7 used". */
    used: 'package.card.used',
    /** "Valid till 24 Sep 2027". */
    validTill: 'package.card.validTill',
    /** "Next: 8 Oct". */
    next: 'package.card.next',
    use: 'package.card.use',
    book: 'package.card.book',
    empty: 'package.card.empty',
    /** "Session 2 of 7 used". */
    sessionUsed: 'package.card.sessionUsed',
    noneLeft: 'package.card.noneLeft',
  },
} as const;

/** The drawer's root test id. */
export const PACKAGE_TEST_ID = 'package-drawer';

/** One package card: `patient-package-<id>`, its `-use` and `-book` buttons. */
export const PACKAGE_CARD_TEST_ID = 'patient-package';
