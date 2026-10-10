import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  organizationPatientPhoto,
  organizationPatientPhotoEdit,
  organizationPatientSection,
} from '@/lib/routes/patient-file-builders.ts';
import type { PatientPhoto } from '@/shared/api/clinic/patient-images-contracts.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import {
  usePatientPhoto,
  usePatientPhotos,
} from '@/shared/hooks/usePatientPhotos/index.ts';

import { usePatientFileContext } from '../../shared/patient-file-context.ts';
import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../shared/patient-photos.constants.ts';
import type { PatientImagesSearch } from '../images.search.ts';
import { PhotoDeleteConfirm } from '../shared/components/PhotoDeleteConfirm/index.ts';
import { useMissingPhoto } from '../shared/hooks/useMissingPhoto/index.ts';
import { usePhotoAccess } from '../shared/hooks/usePhotoAccess/index.ts';
import { photoAt, photoListParamsOf, photoMatchesVisit } from '../shared/photo-view.ts';
import { PhotoViewer } from './components/PhotoViewer/index.ts';

const K = PATIENT_PHOTOS_KEYS;

/** "Face · Before · 24 Sep · General" — the viewer's line under the name (H:4785 `lb.meta`). */
function usePhotoMeta(): (photo: PatientPhoto) => string {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const { day: dayLabel } = useClinicClock();
  return (photo) =>
    [
      photo.bodyPart ? t(K.bodyParts[photo.bodyPart]) : null,
      photo.stage ? t(K.stages[photo.stage]) : null,
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

/**
 * The photo the URL names (`GET …/images/:patient_image_id`) and the list it browses — its
 * album under the section's visit filter (its whole album when the filter leaves it out), the
 * same cached pages the section reads. Stepping past the photos read reads the next page, then
 * steps; the ends wrap once every page is read.
 */
function useViewerPhotos(onPhoto: (id: string) => void) {
  const { imageId = '' } = useParams({ strict: false });
  const search: PatientImagesSearch = useSearch({ strict: false });
  const { patientId } = usePatientFileContext();
  const read = usePatientPhoto(patientId, imageId);
  const photo = read.data;
  const filter =
    photo && photoMatchesVisit(photo, search.appointment)
      ? search.appointment
      : undefined;
  const list = usePatientPhotos(
    patientId,
    photoListParamsOf(photo?.album ?? 'general', filter),
    { enabled: photo !== undefined },
  );
  const found = photo ? list.photos.findIndex((entry) => entry.id === photo.id) : -1;
  // A "next" that ran past the photos read waits for the next page, then steps.
  const waitingAfter = useRef<string | null>(null);
  const complete = list.isSuccess && !list.hasNextPage;
  useEffect(() => {
    const after = waitingAfter.current;
    if (after === null || list.isFetchingNextPage) return;
    const next = photoAt(list.photos, after, 1, complete);
    // The page is still on its way (or failed — the list says so): keep waiting.
    if (!next && list.hasNextPage) return;
    waitingAfter.current = null;
    if (next) onPhoto(next.id);
  }, [complete, list.hasNextPage, list.isFetchingNextPage, list.photos, onPhoto]);

  const step = (direction: 1 | -1) => {
    if (!photo) return;
    const next = photoAt(list.photos, photo.id, direction, complete);
    if (next) {
      if (next.id !== photo.id) onPhoto(next.id);
      return;
    }
    if (direction === 1 && list.hasNextPage) {
      waitingAfter.current = photo.id;
      list.fetchNextPage();
    }
  };
  return {
    read,
    photo,
    index: found < 0 ? null : found,
    total: list.total ?? list.photos.length,
    step,
  };
}

/**
 * The photo viewer — `/patients/$patientId/images/$imageId` (`S:40`; KICKOFF
 * §6.6): over the Photos section, browsing the album under its visit filter
 * (the section's `?album=&appointment=`); ‹ › and ← → replace the URL with the
 * next photo. Closing goes back to the section. Edit details opens Photo
 * details; Delete the reason confirm, the viewer closing once it lands. A
 * photo that can't be read — deleted, unknown, in an album the member may not
 * open — says so and goes back to Photos.
 */
export function PatientPhotoViewerPage() {
  const access = usePhotoAccess();
  const links = useViewerLinks();
  const { read, photo, index, total, step } = useViewerPhotos(links.photo);
  const metaOf = usePhotoMeta();
  const [deleting, setDeleting] = useState<PatientPhoto | null>(null);
  // Deleting it here: the confirm runs to the end, then the viewer leaves quietly.
  const [deleted, setDeleted] = useState(false);
  useMissingPhoto(deleting === null && !deleted ? read.error : null, () =>
    links.section(true),
  );

  return (
    <>
      {photo ? (
        <PhotoViewer
          photo={photo}
          index={index}
          total={total}
          meta={metaOf(photo)}
          onStep={step}
          onClose={() => links.section(false)}
          onEdit={access.canWrite ? () => links.details(photo.id) : undefined}
          onDelete={access.canWrite ? () => setDeleting(photo) : undefined}
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
