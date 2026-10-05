import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

import { PHOTO_ALBUMS, type PhotoAlbum } from '../../../images.search.ts';

/** What the member may do with the patient's photos. */
export interface PhotoAccess {
  /** False until access has answered — a `false` below is "not known yet". */
  resolved: boolean;
  /** The Private album — Doctor, Admin and Owner (`S:40`; AMBER A-F9). */
  privateAlbum: boolean;
  /** The albums the member sees, in tab order. */
  albums: readonly PhotoAlbum[];
  /** Upload — Patients create ("Upload images", the drop). */
  canUpload: boolean;
  /** Photo details — Patients edit (`S:41`); read-only without. */
  canEdit: boolean;
  /** Delete — Patients delete. */
  canDelete: boolean;
}

/**
 * The photos' access (KICKOFF §6.6 Access): the Private album by role, upload
 * by Patients create, details by edit, delete by delete. Without create the
 * Photos "Upload images" and the drop go (`patient-file.md:7`).
 */
export function usePhotoAccess(): PhotoAccess {
  const access = useClinicAccess();
  const resolved = access.isResolved;
  const privateAlbum = resolved && passesPatientFileGate(access.roles, 'privateAlbum');
  return {
    resolved,
    privateAlbum,
    albums: PHOTO_ALBUMS.filter((album) => album !== 'private' || privateAlbum),
    canUpload: resolved && access.can('patients', 'create'),
    canEdit: resolved && access.can('patients', 'edit'),
    canDelete: resolved && access.can('patients', 'delete'),
  };
}
