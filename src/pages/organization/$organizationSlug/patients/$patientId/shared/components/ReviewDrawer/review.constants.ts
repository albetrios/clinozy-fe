import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The review drawer reads the patient file's namespace. */
export const REVIEW_NS = I18N_NAMESPACES.patientFile;

/** The review drawer's copy (`patient-file.md:189–200, 374–381`; KICKOFF §6.6), verbatim. */
export const REVIEW_KEYS = {
  title: 'review.title',
  /** "Dharti Galani · kept on the patient file so anyone can find it later". */
  sub: 'review.sub',
  steps: {
    review: 'review.steps.review',
    details: 'review.steps.details',
    notes: 'review.steps.notes',
  },
  where: 'review.where',
  rating: 'review.rating',
  link: 'review.link',
  linkHint: 'review.linkHint',
  linkPlaceholder: 'review.linkPlaceholder',
  files: 'review.files',
  filesDrop: 'review.filesDrop',
  /** "MP4, MOV, JPG or PNG · up to 10 MB" — the upload cap, not the drawn 100 MB (A-F13). */
  filesHint: 'review.filesHint',
  /** A picked file's ×: "Remove clip.mp4". */
  removeFile: 'review.removeFile',
  /** The files a saved review already has, on its edit. */
  attached: 'review.attached',
  text: 'review.text',
  textPlaceholder: 'review.textPlaceholder',
  save: 'review.save',
  saveEdit: 'review.saveEdit',
  /** "5★ Google review saved for Dharti Galani". */
  saved: 'review.saved',
  /** " · call-back task created". */
  callBack: 'review.callBack',
  updated: 'review.updated',
  badLink: 'review.badLink',
  notRated: 'review.notRated',
  /** The record's name in "Review not found · it may have been deleted". */
  record: 'review.record',
} as const;

/** The files a review takes: a testimonial video or a screenshot (`patient-file.md:197`). */
export const REVIEW_FILE_TYPES = [
  'video/mp4',
  'video/quicktime',
  'image/jpeg',
  'image/png',
] as const;

/** The drawer's root test id. */
export const REVIEW_TEST_ID = 'review-drawer';
