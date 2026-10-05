import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import {
  organizationPatientPhoto,
  organizationPatientPhotoEdit,
} from '@/lib/routes/patient-file-builders.ts';
import { cn } from '@/lib/utils.ts';
import type { PatientPhoto } from '@/shared/api/clinic/patient-images-api.ts';
import { SkeletonBar } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { usePatientPhotos } from '@/shared/hooks/usePatientPhotos/index.ts';
import { ImageIcon } from '@/shared/icons/index.ts';
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
import {
  photoDays,
  PHOTOS_PAGE,
  photosInView,
  visitsWithPhotos,
} from './shared/photo-view.ts';

const K = PATIENT_PHOTOS_KEYS;

/** The section's test ids beyond the toolbar's and the grid's. */
const IDS = {
  dropZone: 'patient-photos',
  empty: 'patient-photos-empty',
  loadMore: 'patient-photos-load-more',
} as const;

/**
 * Files dragged over the section (H:4789 `drop`): the 2px dashed outline 8px
 * inside while they hover, the upload on drop. Off without Patients create.
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
 * A member who can't open the Private album (Doctor, Admin, Owner; `S:40`)
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

/** "No photos in General yet" — the dashed box, with "Upload images" for a member who may. */
function PhotosEmpty({ album, onUpload }: { album: string; onUpload?: () => void }) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <div
      data-testid={IDS.empty}
      className="border-border-strong flex flex-col items-center gap-2.5 rounded-xl border-[1.5px] border-dashed px-(--table-pad-x) py-12 text-center"
    >
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-xl"
      >
        <ImageIcon className="size-5.5" />
      </span>
      <span className="text-sm font-semibold">{t(K.empty.title, { album })}</span>
      <span className="text-detail text-muted-foreground">{t(K.empty.body)}</span>
      {onUpload ? (
        <Button
          type="button"
          onClick={onUpload}
          className="text-body h-9 rounded-lg px-3.5"
        >
          {t(K.upload)}
        </Button>
      ) : null}
    </div>
  );
}

/** The grid's place while the photos load: three tiles' worth of flat bars. */
function PhotosSkeleton() {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <div
      role="status"
      aria-label={t(K.loading)}
      className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2.5"
    >
      {[0, 1, 2].map((index) => (
        <SkeletonBar key={index} shape="field" className="aspect-square h-auto" />
      ))}
    </div>
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

/** What the section shows: the album under its filter, 12 more at a time. */
function usePhotosInView(
  photos: readonly PatientPhoto[],
  album: PhotoAlbum,
  appointment: string | undefined,
) {
  const [revealed, setRevealed] = useState<Record<PhotoAlbum, number>>({
    general: PHOTOS_PAGE,
    private: PHOTOS_PAGE,
    lhr: PHOTOS_PAGE,
  });
  const inView = photosInView(photos, album, appointment);
  const shown = inView.slice(0, revealed[album]);
  return {
    albumCount: photosInView(photos, album, undefined).length,
    inView,
    shown,
    left: inView.length - shown.length,
    more: () =>
      setRevealed((current) => ({
        ...current,
        [album]: current[album] + PHOTOS_PAGE,
      })),
  };
}

/** The grid, its empty box or its skeleton, and "Load more". */
function PhotosBody({
  loaded,
  album,
  view,
  access,
  onUpload,
  onDelete,
}: {
  loaded: boolean;
  album: PhotoAlbum;
  view: ReturnType<typeof usePhotosInView>;
  access: PhotoAccess;
  onUpload?: () => void;
  onDelete: (photo: PatientPhoto) => void;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const size = useDevicePrefsStore((state) => state.photoSize);
  const { day: dayLabel } = useClinicClock();
  const links = usePhotoLinks();
  if (!loaded) return <PhotosSkeleton />;
  if (view.shown.length === 0) {
    return <PhotosEmpty album={t(K.albums[album])} onUpload={onUpload} />;
  }
  return (
    <>
      <PhotoGrid
        days={photoDays(view.shown)}
        size={size}
        dayLabel={dayLabel}
        onOpen={links.open}
        onEdit={access.canEdit ? links.edit : undefined}
        onDelete={access.canDelete ? onDelete : undefined}
      />
      {view.left > 0 ? (
        <div className="flex justify-center py-1">
          <Button
            type="button"
            variant="outline"
            data-testid={IDS.loadMore}
            onClick={view.more}
            className="text-body h-9 rounded-lg px-4"
          >
            {t(K.loadMore, { count: view.left })}
          </Button>
        </div>
      ) : null}
    </>
  );
}

/**
 * Patient file › Photos (KICKOFF §6.6; H:827–832; `patient-file.md:59–68`):
 * the albums and the visit filter (`?album=&appointment=`), the photos by day
 * at the device's thumbnail size, 12 at a time; a tile opens the viewer, Edit
 * opens Photo details, Delete the reason confirm. Files dropped on the section
 * or picked with "Upload images" go to the album on screen (Patients create).
 * The Private album is Doctor, Admin and Owner only.
 */
export function PatientImagesPage() {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const search: PatientImagesSearch = useSearch({ strict: false });
  const { patientId, photos: uploads } = usePatientFileContext();
  const access = usePhotoAccess();
  const read = usePatientPhotos(patientId, {
    privateAlbum: access.privateAlbum,
    enabled: access.resolved,
  });
  useListLoadError(
    { isError: read.isError, refetch: () => void read.refetch() },
    `patient-photos:${patientId}`,
  );
  const size = useDevicePrefsStore((state) => state.photoSize);
  const setSize = useDevicePrefsStore((state) => state.setPhotoSize);
  const { day: dayLabel } = useClinicClock();
  const links = usePhotoLinks();
  const [deleting, setDeleting] = useState<PatientPhoto | null>(null);

  const album: PhotoAlbum = search.album ?? 'general';
  usePrivateAlbumGuard(album, access, () => links.setSearch({ album: undefined }));
  const upload = access.canUpload ? () => uploads.pick(album) : undefined;
  const drop = usePhotoDrop(
    access.canUpload ? (files) => uploads.upload(files, album) : null,
  );
  const photos = read.data?.photos ?? [];
  const view = usePhotosInView(photos, album, search.appointment);

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
          count={view.inView.length}
          albumCount={view.albumCount}
          appointment={search.appointment}
          visits={visitsWithPhotos(read.data?.visits ?? [], photos)}
          onAppointmentChange={(appointment) => links.setSearch({ appointment })}
          dayLabel={dayLabel}
          size={size}
          onSizeChange={setSize}
        />
        <PhotosBody
          loaded={read.data !== undefined}
          album={album}
          view={view}
          access={access}
          onUpload={upload}
          onDelete={setDeleting}
        />
      </div>
      <PhotoDeleteConfirm photo={deleting} onClose={() => setDeleting(null)} />
    </PatientSection>
  );
}
