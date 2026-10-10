import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

import { PHOTO_ALBUMS, type PhotoAlbum } from '../../../images.search.ts';

/** What the member may do with the patient's photos. */
export interface PhotoAccess {
  /** False until access has answered — a `false` below is "not known yet". */
  resolved: boolean;
  /** The Private album — `patient:private_album:read` (a View-as preview: Doctor, Admin, Owner). */
  privateAlbum: boolean;
  /** The albums the member sees, in tab order. */
  albums: readonly PhotoAlbum[];
  /**
   * Upload, Photo details and delete — `patient:update`, the one code every photo write needs
   * (`POST` / `PATCH` / `DELETE …/images`, restore). Without it the section only shows.
   */
  canWrite: boolean;
}

/**
 * The photos' access (api-integration §5.4 Gate): the Private album by its code
 * (`passesPatientFileGate(access, 'privateAlbum')`), every write by Patients edit
 * (`patient:update`). Reading the photos at all is `patient:clinical_record:read`, which
 * decides whether the file offers the section (`viewablePatientFileSections`).
 */
export function usePhotoAccess(): PhotoAccess {
  const access = useClinicAccess();
  const resolved = access.isResolved;
  const privateAlbum = resolved && passesPatientFileGate(access, 'privateAlbum');
  return {
    resolved,
    privateAlbum,
    albums: PHOTO_ALBUMS.filter((album) => album !== 'private' || privateAlbum),
    canWrite: resolved && access.can('patients', 'edit'),
  };
}
