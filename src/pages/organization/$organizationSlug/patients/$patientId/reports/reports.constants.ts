import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import type { ReportType, Tone } from '@/shared/api/clinic/clinic-schema.ts';

/** Upload report and Report view read the patient file's namespace. */
export const REPORT_NS = I18N_NAMESPACES.patientFile;

/** Upload report and Report view (`patient-file.md:143–157, 374–381`; KICKOFF §6.6), verbatim. */
export const REPORT_KEYS = {
  /** "Report" — the not-found toast's record. */
  record: 'report.record',
  types: {
    lab: 'report.types.lab',
    scan: 'report.types.scan',
    consent: 'report.types.consent',
    other: 'report.types.other',
  },
  steps: {
    report: 'report.steps.report',
    details: 'report.steps.details',
    notes: 'report.steps.notes',
  },
  type: 'report.type',
  name: 'report.name',
  date: 'report.date',
  file: 'report.file',
  upload: {
    title: 'report.upload.title',
    namePlaceholder: 'report.upload.namePlaceholder',
    drop: 'report.upload.drop',
    /** "PDF, JPG or PNG · up to 10 MB". */
    fileHint: 'report.upload.fileHint',
    /** "Remove cbc.pdf". */
    remove: 'report.upload.remove',
    note: 'report.upload.note',
    notePlaceholder: 'report.upload.notePlaceholder',
    /** "Lab · 0 files". */
    summary: 'report.upload.summary',
    /** "0 files" (plural). */
    files: 'report.upload.files',
    save: 'report.upload.save',
    noName: 'report.upload.noName',
    uploaded: 'report.upload.uploaded',
  },
  view: {
    /** "Dharti Galani · 20 Sep 2026". */
    sub: 'report.view.sub',
    notes: 'report.view.notes',
    noNotes: 'report.view.noNotes',
    /** The footer's primary (D86). */
    download: 'report.view.download',
    /** "Downloading CBC + Thyroid profile". */
    downloading: 'report.view.downloading',
    /** A file whose upload is gone. */
    fileGone: 'report.view.fileGone',
  },
} as const;

/** Each report type's tone (H:4829; `patient-file.md:147`): Lab mint, Scan sky, Consent lav, Other stone. */
export const REPORT_TYPE_TONES: Readonly<Record<ReportType, Tone>> = {
  lab: 'mint',
  scan: 'sky',
  consent: 'lav',
  other: 'stone',
};

/** What a report's File takes (`S:447`): PDF, JPG or PNG. */
export const REPORT_FILE_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
];

/** The drawers' root test ids. */
export const REPORT_TEST_IDS = {
  drawer: 'report-drawer',
  view: 'report-view',
} as const;
