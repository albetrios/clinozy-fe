import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Packages section reads the patient file's namespace. */
export const PACKAGE_NS = I18N_NAMESPACES.patientFile;

/** The cards' (H:833; `patient-file.md:70–79`) and Edit package's copy keys. */
export const PACKAGE_KEYS = {
  /** Edit package — a package's validity and sessions (`PATCH …/offerings`). */
  title: 'package.title',
  /** "Sessions are counted when a treatment is completed". */
  summary: 'package.summary',
  validUntil: 'package.validUntil',
  sessions: 'package.sessions',
  save: 'package.save',
  saved: 'package.saved',
  /** A package's card on the section. */
  card: {
    /** "6 left" (plural). */
    left: 'package.card.left',
    /** "1 of 7 used". */
    used: 'package.card.used',
    /** "Valid till 24 Sep 2027". */
    validTill: 'package.card.validTill',
    /** No `valid_until` — and the date picker's empty state. */
    noExpiry: 'package.card.noExpiry',
    /** The server's status when the package is past use. */
    statuses: {
      used_up: 'package.card.statuses.used_up',
      expired: 'package.card.statuses.expired',
    },
    book: 'package.card.book',
    edit: 'package.card.edit',
    empty: 'package.card.empty',
  },
} as const;

/** Edit package's root test id. */
export const PACKAGE_TEST_ID = 'package-drawer';

/** One package card: `patient-package-<id>`, its `-book` and `-edit` buttons. */
export const PACKAGE_CARD_TEST_ID = 'patient-package';
