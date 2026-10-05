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
} as const;

/** The drawer's root test id. */
export const PACKAGE_TEST_ID = 'package-drawer';
