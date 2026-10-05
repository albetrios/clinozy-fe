import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  organizationPatientPhoto,
  organizationPatientPhotoEdit,
  organizationPatientSection,
} from '@/lib/routes/patient-file-builders.ts';
import type { PatientPhoto } from '@/shared/api/clinic/patient-images-api.ts';
import { usePatientPhotos } from '@/shared/hooks/usePatientPhotos/index.ts';

import { usePatientFileContext } from '../../shared/patient-file-context.ts';
import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../shared/patient-photos.constants.ts';
import type { PatientImagesSearch } from '../images.search.ts';
import { PhotoDeleteConfirm } from '../shared/components/PhotoDeleteConfirm/index.ts';
import { useMissingPhoto } from '../shared/hooks/useMissingPhoto/index.ts';
import { usePhotoAccess } from '../shared/hooks/usePhotoAccess/index.ts';
import { usePhotoDayLabel } from '../shared/hooks/usePhotoDayLabel/index.ts';
import { photoAt, photosInView } from '../shared/photo-view.ts';
import { PhotoViewer } from './components/PhotoViewer/index.ts';

const K = PATIENT_PHOTOS_KEYS;

/** "Face · 24 Sep · General" — the viewer's line under the name (H:4785 `lb.meta`). */
function usePhotoMeta(): (photo: PatientPhoto) => string {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const dayLabel = usePhotoDayLabel();
  return (photo) =>
    [
      photo.bodyPart ? t(K.bodyParts[photo.bodyPart]) : null,
      dayLabel(photo.takenOn),
      t(K.albums[photo.album]),
    ]
      .filter(Boolean)
      .join(' · ');
}

/** The viewer's links, each keeping the section's album and filter. */
function useViewerLinks() {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  return {
    /** Another photo — in place, so Back leaves the viewer. */
    photo: (id: string) =>
      void navigate({
        ...organizationPatientPhoto(organizationSlug, patientId, id),
        search: true,
        replace: true,
      }),
    details: (id: string) =>
      void navigate({
        ...organizationPatientPhotoEdit(organizationSlug, patientId, id),
        search: true,
        replace: true,
      }),
    section: (replace: boolean) =>
      void navigate({
        ...organizationPatientSection(organizationSlug, patientId, 'images'),
        search: true,
        replace,
      }),
  };
}

/** The photo the URL names and the list it browses — its album under the filter. */
function useViewerPhotos(privateAlbum: boolean, enabled: boolean) {
  const { imageId = '' } = useParams({ strict: false });
  const search: PatientImagesSearch = useSearch({ strict: false });
  const { patientId } = usePatientFileContext();
  const read = usePatientPhotos(patientId, { privateAlbum, enabled });
  const photos = read.data?.photos ?? [];
  const photo = photos.find((candidate) => candidate.id === imageId);
  const filtered = photo ? photosInView(photos, photo.album, search.appointment) : [];
  // A photo the visit filter leaves out still browses its album.
  const list =
    photo && !filtered.includes(photo)
      ? photosInView(photos, photo.album, undefined)
      : filtered;
  return { read, photo, list };
}

/**
 * The photo viewer — `/patients/$patientId/images/$imageId` (`S:40`; KICKOFF
 * §6.6): over the Photos section, browsing the album under its visit filter
 * (the section's `?album=&appointment=`); ‹ › and ← → replace the URL with the
 * next photo. Closing goes back to the section. Edit details opens Photo
 * details; Delete the reason confirm, the viewer closing once it lands.
 */
export function PatientPhotoViewerPage() {
  const access = usePhotoAccess();
  const { read, photo, list } = useViewerPhotos(access.privateAlbum, access.resolved);
  const links = useViewerLinks();
  const metaOf = usePhotoMeta();
  const [deleting, setDeleting] = useState<PatientPhoto | null>(null);
  // Deleting it here: the confirm runs to the end, then the viewer leaves quietly.
  const [deleted, setDeleted] = useState(false);
  useMissingPhoto(read.isSuccess && !photo && deleting === null && !deleted, () =>
    links.section(true),
  );

  return (
    <>
      {photo ? (
        <PhotoViewer
          photo={photo}
          index={Math.max(0, list.indexOf(photo))}
          total={list.length}
          meta={metaOf(photo)}
          onStep={(step) => {
            const next = photoAt(list, photo.id, step);
            if (next && next.id !== photo.id) links.photo(next.id);
          }}
          onClose={() => links.section(false)}
          onEdit={access.canEdit ? () => links.details(photo.id) : undefined}
          onDelete={access.canDelete ? () => setDeleting(photo) : undefined}
        />
      ) : null}
      <PhotoDeleteConfirm
        photo={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleted(true);
          links.section(true);
        }}
      />
    </>
  );
}
