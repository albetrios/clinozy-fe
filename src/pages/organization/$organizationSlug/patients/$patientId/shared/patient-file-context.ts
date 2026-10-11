import { createContext, useContext } from 'react';

import type { PatientFile } from '@/shared/api/app/patient-file-contracts.ts';
import type { PatientFileSectionSlug } from '@/shared/app/patient-file-sections.ts';

import type { PatientPhotoUploads } from './hooks/usePatientPhotoUpload/index.ts';

/** What the file layout hands its sections and their drawers. */
export interface PatientFileContextValue {
  patientId: string;
  /** The file's read — undefined while it loads. */
  file: PatientFile | undefined;
  /** The section on screen (the one a file-level drawer opened over). */
  section: PatientFileSectionSlug | null;
  /** The sections the member may open, in the file's order (Q-F1). */
  viewable: readonly PatientFileSectionSlug[];
  /**
   * The money mask (Q-F4): masked by default, one flag for the whole file, held
   * by the layout and never persisted — the rail's due eye, the Billing card's
   * and the suggestions' toggle it; the Activity pills follow it.
   */
  masked: boolean;
  toggleMasked: () => void;
  /** The photo uploads: the section's drop and "Upload images", the Add menu's "Photo". */
  photos: PatientPhotoUploads;
}

/** The patient file's context — provided by `PatientFileLayout`. */
export const PatientFileContext = createContext<PatientFileContextValue | null>(null);

/** The open patient file, from inside it (a section, a drawer, a file-level part). */
export function usePatientFileContext(): PatientFileContextValue {
  const value = useContext(PatientFileContext);
  if (!value)
    throw new Error('usePatientFileContext must be used inside the patient file');
  return value;
}
