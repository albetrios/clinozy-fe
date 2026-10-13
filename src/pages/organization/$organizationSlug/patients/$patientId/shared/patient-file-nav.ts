import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { PatientFilePin } from '@/shared/api/app/preferences-api.ts';
import {
  isPatientFileSection,
  type PatientFileSectionSlug,
} from '@/shared/app/patient-file-sections.ts';
import {
  type AppIcon,
  Calendar,
  Camera,
  FileIcon,
  LayoutGrid,
  MessageSquare,
  Package,
  Pill,
  Receipt,
  Sparkles,
  Stethoscope,
  Wallet,
} from '@/shared/icons/index.ts';

/**
 * Each section's tab and tile tone (H:4940 `PTT`): Clinical notes blush,
 * Visits sky, Prescriptions sage, Treatments lav, Photos blush, Reports mint,
 * Invoices and Payments peach, Packages mint, Team notes lav — and the
 * Overview the plan adds, sage (AMBER A-F2).
 */
export const PATIENT_FILE_SECTION_TONES: Readonly<Record<PatientFileSectionSlug, Tone>> =
  {
    timeline: 'sage',
    overview: 'blush',
    visits: 'sky',
    prescriptions: 'sage',
    treatments: 'lav',
    images: 'blush',
    reports: 'mint',
    invoices: 'peach',
    payments: 'peach',
    packages: 'mint',
    notes: 'lav',
  };

/** Each section's icon (H:4724 `TIC`; `patient-file.md:424`). */
export const PATIENT_FILE_SECTION_ICONS: Readonly<
  Record<PatientFileSectionSlug, AppIcon>
> = {
  timeline: LayoutGrid,
  overview: Stethoscope,
  visits: Calendar,
  prescriptions: Pill,
  treatments: Sparkles,
  images: Camera,
  reports: FileIcon,
  invoices: Receipt,
  payments: Wallet,
  packages: Package,
  notes: MessageSquare,
};

/** A group of the section popover. */
export type PatientFileGroupId = 'clinical' | 'care' | 'billing' | 'team';

/**
 * The section popover's groups (H:4940 `NG`; `patient-file.md:251`), three
 * tiles a row — with the Overview tile the plan adds first in Clinical, so
 * the default section can be reopened (AMBER A-F2).
 */
export const PATIENT_FILE_GROUPS: readonly {
  id: PatientFileGroupId;
  sections: readonly PatientFileSectionSlug[];
}[] = [
  { id: 'clinical', sections: ['timeline', 'overview'] },
  {
    id: 'care',
    sections: ['visits', 'prescriptions', 'treatments', 'images', 'reports'],
  },
  { id: 'billing', sections: ['invoices', 'payments', 'packages'] },
  { id: 'team', sections: ['notes'] },
];

/** One tab of the file bar's strip. */
export interface PatientFileTab {
  section: PatientFileSectionSlug;
  /** Shown because it is open, not because it is pinned — the 5px dot. */
  temporary: boolean;
}

/**
 * The tab strip (H:4940): the pinned sections in pin order, then the open
 * section when it is not pinned ("Not pinned · shown while open"); only the
 * sections the member may view, never a pin the file has no section for.
 */
export function patientFileTabs(
  pins: readonly PatientFilePin[],
  current: PatientFileSectionSlug | null,
  viewable: readonly PatientFileSectionSlug[],
): PatientFileTab[] {
  const pinned = [...new Set(pins)].filter(
    (pin): pin is PatientFileSectionSlug =>
      isPatientFileSection(pin) && viewable.includes(pin),
  );
  const tabs = pinned.map((section) => ({ section, temporary: false }));
  if (current && viewable.includes(current) && !pinned.includes(current)) {
    tabs.push({ section: current, temporary: true });
  }
  return tabs;
}

/** The pins after a tile's pin toggles: pinned → dropped, else added at the end (H:4940). */
export function togglePatientFilePin(
  pins: readonly PatientFilePin[],
  section: PatientFileSectionSlug,
): PatientFilePin[] {
  return pins.includes(section)
    ? pins.filter((pin) => pin !== section)
    : [...pins, section];
}

/**
 * The section a file URL shows: the first segment after the patient's id when
 * it is a section; a file-level dialog (`edit/`, and later the check-in and
 * review drawers) keeps the section it opened over (`from`, A-F1), Clinical
 * notes by default (`S:34`); anything else is none.
 */
export function patientFileSectionOf(
  pathname: string,
  patientId: string,
  from: unknown,
): PatientFileSectionSlug | null {
  const marker = `/patients/${patientId}/`;
  const at = pathname.indexOf(marker);
  if (at < 0) return null;
  const segment = pathname.slice(at + marker.length).split('/')[0] ?? '';
  if (isPatientFileSection(segment)) return segment;
  if (FILE_DIALOG_SEGMENTS.has(segment)) {
    return isPatientFileSection(from) ? from : 'overview';
  }
  return null;
}

/** File-level dialog routes — they open over a section rather than being one (`S:34, 44–47`). */
const FILE_DIALOG_SEGMENTS: ReadonlySet<string> = new Set([
  'edit',
  'check-ins',
  'reviews',
]);
