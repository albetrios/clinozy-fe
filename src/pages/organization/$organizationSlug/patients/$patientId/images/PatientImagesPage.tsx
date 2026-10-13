import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import {
  organizationPatientPhoto,
  organizationPatientPhotoEdit,
} from '@/lib/routes/patient-file-builders.ts';
import { cn } from '@/lib/utils.ts';
import type { PatientPhoto } from '@/shared/api/app/patient-images-contracts.ts';
import { EmptyState, EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import {
  type PatientPhotoList,
  usePatientPhotos,
} from '@/shared/hooks/usePatientPhotos/index.ts';
import { Camera } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../shared/patient-photos.constants.ts';
import { PhotoGrid } from './components/PhotoGrid/index.ts';
import { PhotoToolbar } from './components/PhotoToolbar/index.ts';
import { manifest } from './images.manifest.ts';
import type { PatientImagesSearch, PhotoAlbum } from './images.search.ts';
import { PhotoDeleteConfirm } from './shared/components/PhotoDeleteConfirm/index.ts';
import { type PhotoAccess, usePhotoAccess } from './shared/hooks/usePhotoAccess/index.ts';
import { usePhotoVisits } from './shared/hooks/usePhotoVisits/index.ts';
import { photoDays, photoListParamsOf, PHOTOS_PAGE } from './shared/photo-view.ts';

const K = PATIENT_PHOTOS_KEYS;

/** The section's test ids beyond the toolbar's and the grid's. */
const IDS = {
  dropZone: 'patient-photos',
  empty: 'patient-photos-empty',
  loadMore: 'patient-photos-load-more',
} as const;

/**
 * Files dragged over the section (H:4789 `drop`): the 2px dashed outline 8px
 * inside while they hover, the upload on drop. Off without `patient:update`.
 */
function usePhotoDrop(onFiles: ((files: FileList) => void) | null) {
  const [over, setOver] = useState(false);
  if (!onFiles) return { over: false, handlers: {} };
  return {
    over,
    handlers: {
      onDragOver: (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!over) setOver(true);
      },
      onDragLeave: (event: DragEvent<HTMLDivElement>) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setOver(false);
      },
      onDrop: (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setOver(false);
        onFiles(event.dataTransfer.files);
      },
    },
  };
}

/**
 * A member who can't open the Private album (`patient:private_album:read`)
 * who follows a link to it gets the permission toast and General.
 */
function usePrivateAlbumGuard(
  album: PhotoAlbum,
  access: PhotoAccess,
  toGeneral: () => void,
) {
  const { t } = useTranslation(ERRORS_NS);
  const refused = access.resolved && album === 'private' && !access.privateAlbum;
  const toldFor = useRef(false);
  useEffect(() => {
    if (!refused || toldFor.current) return;
    toldFor.current = true;
    notify.info(t(ERRORS_KEYS.api.http403));
    toGeneral();
  }, [refused, t, toGeneral]);
}

/**
 * "No photos in General yet" (change-empty-states R15): the room look in the
 * Photos blush with the `Camera` tile, centred below the toolbar, with "Upload"
 * for a member who may.
 */
function PhotosEmpty({ album, onUpload }: { album: string; onUpload?: () => void }) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <EmptyState
      tone="blush"
      icon={<Camera />}
      title={t(K.empty.title, { album })}
      description={t(K.empty.body)}
      testId={IDS.empty}
      action={
        onUpload ? (
          <EmptyStateAction onClick={onUpload}>{t(K.upload)}</EmptyStateAction>
        ) : undefined
      }
    />
  );
}

/** The grid's place while the photos load: three tiles' worth of flat bars. */
function PhotosSkeleton() {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <output
      aria-label={t(K.loading)}
      className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2.5"
    >
      {[0, 1, 2].map((index) => (
        <SkeletonBar key={index} shape="field" className="aspect-square h-auto" />
      ))}
    </output>
  );
}

/** The photos' links: the viewer, Photo details, and the section's own params. */
function usePhotoLinks() {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  return {
    open: (photo: PatientPhoto) =>
      void navigate({
        ...organizationPatientPhoto(organizationSlug, patientId, photo.id),
        search: true,
      }),
    edit: (photo: PatientPhoto) =>
      void navigate({
        ...organizationPatientPhotoEdit(organizationSlug, patientId, photo.id),
        search: true,
      }),
    setSearch: (patch: PatientImagesSearch) =>
      void navigate({
        to: '.',
        search: (current: Record<string, unknown>) => ({
          ...current,
          ...patch,
        }),
        hash: true,
        replace: true,
      }),
  };
}

/** "Load more · 4 left" — the server's total less the photos read; a page's worth when it is not told. */
function photosLeft(read: PatientPhotoList): number {
  if (read.total === null) return PHOTOS_PAGE;
  return Math.max(read.total - read.photos.length, 1);
}

/** The grid, its empty box, its skeleton or its failure, and "Load more". */
function PhotosBody({
  read,
  album,
  access,
  onUpload,
  onDelete,
}: {
  read: PatientPhotoList;
  album: PhotoAlbum;
  access: PhotoAccess;
  onUpload?: () => void;
  onDelete: (photo: PatientPhoto) => void;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const size = useDevicePrefsStore((state) => state.photoSize);
  const { day: dayLabel } = useAppClock();
  const links = usePhotoLinks();
  if (read.isPending) return <PhotosSkeleton />;
  if (read.photos.length === 0) {
    // A failed first read is not an empty album: say so, with Retry.
    if (read.isError) return <RetryError onRetry={read.refetch} />;
    return <PhotosEmpty album={t(K.albums[album])} onUpload={onUpload} />;
  }
  return (
    <>
      <PhotoGrid
        days={photoDays(read.photos)}
        size={size}
        dayLabel={dayLabel}
        onOpen={links.open}
        onEdit={access.canWrite ? links.edit : undefined}
        onDelete={access.canWrite ? onDelete : undefined}
      />
      {read.hasNextPage ? (
        <div className="flex justify-center py-1">
          <Button
            type="button"
            variant="outline"
            data-testid={IDS.loadMore}
            onClick={read.fetchNextPage}
            disabled={read.isFetchingNextPage}
            aria-busy={read.isFetchingNextPage || undefined}
            className="text-body h-9 rounded-lg px-4"
          >
            {t(K.loadMore, { count: photosLeft(read) })}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/**
 * Patient file › Photos (KICKOFF §6.6; H:827–832; `patient-file.md:59–68`):
 * the albums with the server's counts and the visit filter
 * (`?album=&appointment=`, read as `GET …/images?album=&appointment_id=`), the
 * photos by day at the device's thumbnail size, a page of 12 at a time ("Load
 * more" reads the next); a tile opens the viewer, Edit opens Photo details,
 * Delete the reason confirm. Files dropped on the section or picked with
 * "Upload images" go to the album on screen. Every write is `patient:update`;
 * the Private album is `patient:private_album:read`. Each tile shows the photo
 * from its `file_url` (D86).
 */
export function PatientImagesPage() {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const search: PatientImagesSearch = useSearch({ strict: false });
  const { patientId, photos: uploads } = usePatientFileContext();
  const access = usePhotoAccess();
  const album: PhotoAlbum = search.album ?? 'general';
  // The Private album's read waits for the guard: a member without its code is sent to General.
  const allowed = access.resolved && (album !== 'private' || access.privateAlbum);
  const read = usePatientPhotos(patientId, photoListParamsOf(album, search.appointment), {
    enabled: allowed,
  });
  useListLoadError(
    { isError: read.isError, refetch: read.refetch },
    `patient-photos:${patientId}`,
  );
  const visits = usePhotoVisits();
  const size = useDevicePrefsStore((state) => state.photoSize);
  const setSize = useDevicePrefsStore((state) => state.setPhotoSize);
  const { day: dayLabel } = useAppClock();
  const links = usePhotoLinks();
  const [deleting, setDeleting] = useState<PatientPhoto | null>(null);

  usePrivateAlbumGuard(album, access, () => links.setSearch({ album: undefined }));
  const upload = access.canWrite ? () => uploads.pick(album) : undefined;
  const drop = usePhotoDrop(
    access.canWrite ? (files) => uploads.upload(files, album) : null,
  );

  return (
    <PatientSection
      section="images"
      data-testid={manifest.testId}
      primary={upload ? { label: t(K.upload), onSelect: upload } : undefined}
    >
      <div
        data-testid={IDS.dropZone}
        {...drop.handlers}
        className={cn(
          'flex min-h-full flex-col gap-3 px-(--table-pad-x) pt-3 pb-5 outline-2 -outline-offset-8 transition-[outline-color]',
          drop.over
            ? 'bg-primary/3 outline-primary outline-dashed'
            : 'outline-transparent',
        )}
      >
        <PhotoToolbar
          album={album}
          albums={access.albums}
          onAlbumChange={(next) =>
            links.setSearch({ album: next === 'general' ? undefined : next })
          }
          albumCounts={read.albumCounts}
          count={read.total}
          appointment={search.appointment}
          visits={visits}
          onAppointmentChange={(appointment) => links.setSearch({ appointment })}
          dayLabel={dayLabel}
          size={size}
          onSizeChange={setSize}
        />
        <PhotosBody
          read={read}
          album={album}
          access={access}
          onUpload={upload}
          onDelete={setDeleting}
        />
      </div>
      <PhotoDeleteConfirm photo={deleting} onClose={() => setDeleting(null)} />
    </PatientSection>
  );
}
