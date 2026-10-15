import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import {
  organizationPatientPhoto,
  organizationPatientPhotoEdit,
} from '@/lib/routes/patient-file-builders.ts';
import { cn } from '@/lib/utils.ts';
import type { PatientPhoto } from '@/shared/api/app/patient-images-contracts.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
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
import { usePhotoDrop } from '../shared/hooks/usePhotoDrop/index.ts';
import { usePhotoPaste } from '../shared/hooks/usePhotoPaste/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../shared/patient-photos.constants.ts';
import { PhotoCompare } from './components/PhotoCompare/index.ts';
import { PhotoGrid } from './components/PhotoGrid/index.ts';
import { PhotoSelectionBar } from './components/PhotoSelectionBar/index.ts';
import { PhotoToolbar } from './components/PhotoToolbar/index.ts';
import { PhotoUploadZone } from './components/PhotoUploadZone/index.ts';
import {
  type PhotoSelection,
  usePhotoSelection,
} from './hooks/usePhotoSelection/index.ts';
import { manifest } from './images.manifest.ts';
import type { PatientImagesSearch, PhotoAlbum } from './images.search.ts';
import { PhotoDeleteConfirm } from './shared/components/PhotoDeleteConfirm/index.ts';
import { type PhotoAccess, usePhotoAccess } from './shared/hooks/usePhotoAccess/index.ts';
import { usePhotoVisits } from './shared/hooks/usePhotoVisits/index.ts';
import { compareIdsOf } from './shared/photo-compare.ts';
import { photoDays, photoListParamsOf, PHOTOS_PAGE } from './shared/photo-view.ts';

const K = PATIENT_PHOTOS_KEYS;

/** The section's test ids beyond the toolbar's and the grid's. */
const IDS = {
  dropZone: 'patient-photos',
  empty: 'patient-photos-empty',
  loadMore: 'patient-photos-load-more',
  veil: 'patient-photos-drop-veil',
} as const;

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
 * "No photos in General yet" (change-empty-states R15) for a member who may not
 * upload: the room look in the Photos blush with the `Camera` tile, centred
 * below the toolbar. A member who uploads gets the drop zone instead
 * (`PhotoUploadZone variant="empty"`, change-patient-overview-photos D16).
 */
function PhotosEmpty({ album }: { album: string }) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <EmptyState
      tone="blush"
      icon={<Camera />}
      title={t(K.empty.title, { album })}
      description={t(K.empty.body)}
      testId={IDS.empty}
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
    /** Open the comparison on its own entry, so Back closes it. */
    compare: (ids: readonly string[]) =>
      void navigate({
        to: '.',
        search: (current: Record<string, unknown>) => ({
          ...current,
          compare: ids.join(','),
        }),
        hash: true,
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
  onDelete,
  selection,
  upload,
}: {
  read: PatientPhotoList;
  album: PhotoAlbum;
  access: PhotoAccess;
  onDelete: (photo: PatientPhoto) => void;
  selection: PhotoSelection;
  /** The picker and the camera for the album; none for a member who may not upload. */
  upload: { choose: () => void; camera: () => void } | null;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const size = useDevicePrefsStore((state) => state.photoSize);
  const { day: dayLabel } = useAppClock();
  const links = usePhotoLinks();
  if (read.isPending) return <PhotosSkeleton />;
  if (read.photos.length === 0) {
    // A failed first read is not an empty album: say so, with Retry.
    if (read.isError) return <RetryError onRetry={read.refetch} />;
    if (upload) {
      return (
        <PhotoUploadZone
          variant="empty"
          album={t(K.albums[album])}
          onChoose={upload.choose}
          onCamera={upload.camera}
        />
      );
    }
    return <PhotosEmpty album={t(K.albums[album])} />;
  }
  return (
    <>
      {upload ? (
        <PhotoUploadZone
          variant="strip"
          album={t(K.albums[album])}
          onChoose={upload.choose}
          onCamera={upload.camera}
        />
      ) : null}
      <PhotoGrid
        days={photoDays(read.photos)}
        size={size}
        dayLabel={dayLabel}
        onOpen={links.open}
        onEdit={access.canWrite ? links.edit : undefined}
        onDelete={access.canWrite ? onDelete : undefined}
        selection={{
          active: selection.active,
          ids: selection.ids,
          full: selection.full,
          onToggle: selection.toggle,
        }}
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

/** The drag veil: "Drop to add to General" over the section while files hover it. */
function DropVeil({ album }: { album: string }) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  return (
    <div
      aria-hidden="true"
      data-testid={IDS.veil}
      className="bg-overlay/35 pointer-events-none absolute inset-0 z-10 flex justify-center backdrop-blur-sm"
    >
      <span
        data-slot="pill"
        className="bg-primary text-primary-foreground sticky top-1/2 mt-10 flex h-11 items-center gap-2 self-start rounded-full px-5 text-sm font-semibold shadow-(--elevation-fab)"
      >
        <Camera className="size-4.5" />
        {t(K.dropzone.veil, { album })}
      </span>
    </div>
  );
}

/** The album's upload: its drop and its paste, the picker and the camera — none for a reader. */
function useAlbumUpload(album: PhotoAlbum, canWrite: boolean) {
  const { photos: uploads } = usePatientFileContext();
  const toAlbum = canWrite
    ? (files: FileList | readonly File[]) => uploads.upload(files, album)
    : null;
  const drop = usePhotoDrop(toAlbum);
  usePhotoPaste(toAlbum);
  const upload = canWrite
    ? { choose: () => uploads.pick(album), camera: () => uploads.capture(album) }
    : null;
  return { drop, upload };
}

/** The comparison the URL names (`?compare=`), over the section; nothing without one. */
function SectionComparison({
  value,
  dayLabel,
  setSearch,
}: {
  value: string | undefined;
  dayLabel: (date: string) => string;
  setSearch: (patch: PatientImagesSearch) => void;
}) {
  const ids = compareIdsOf(value);
  if (ids.length === 0) return null;
  return (
    <PhotoCompare
      ids={ids}
      dayLabel={dayLabel}
      onRemove={(id) =>
        setSearch({ compare: ids.filter((entry) => entry !== id).join(',') })
      }
      onClose={() => setSearch({ compare: undefined })}
    />
  );
}

/** The selection bar while selecting: Compare opens the picks on `?compare=`. */
function SectionSelectionBar({
  selection,
  onCompare,
}: {
  selection: PhotoSelection;
  onCompare: (ids: readonly string[]) => void;
}) {
  if (!selection.active) return null;
  return (
    <PhotoSelectionBar
      count={selection.picked.length}
      comparable={selection.comparable}
      onClear={selection.clear}
      onCompare={() => onCompare(selection.picked.map((photo) => photo.id))}
      onDone={selection.stop}
    />
  );
}

/**
 * Patient file › Photos (KICKOFF §6.6; H:827–832; `patient-file.md:59–68`):
 * the albums with the server's counts and the visit filter
 * (`?album=&appointment=`, read as `GET …/images?album=&appointment_id=`), the
 * photos by day at the device's thumbnail size, a page of 12 at a time ("Load
 * more" reads the next); a tile opens the viewer, Edit opens Photo details,
 * Delete the reason confirm. Upload is in view for a writer
 * (change-patient-overview-photos): the strip above the grid — or, for an
 * empty album, the drop zone — with "Choose photos" and, on a touch device,
 * "Take photo"; files dropped on the section (a veil names the album) and
 * images pasted on it go to the album on screen, as does the section's "Upload
 * images". "Select" (or a tile's check) picks up to eight photos; the bar's
 * Compare opens two to eight side by side on `?compare=`. Every write is
 * `patient:update`; the Private album is `patient:private_album:read`. Each
 * tile shows the photo from its `file_url` (D86).
 */
export function PatientImagesPage() {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const search: PatientImagesSearch = useSearch({ strict: false });
  const { patientId } = usePatientFileContext();
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
  const selection = usePhotoSelection();
  const [deleting, setDeleting] = useState<PatientPhoto | null>(null);
  const { drop, upload } = useAlbumUpload(album, access.canWrite);
  usePrivateAlbumGuard(album, access, () => links.setSearch({ album: undefined }));
  const canSelect = read.photos.length > 0 || selection.active;

  return (
    <PatientSection
      section="images"
      data-testid={manifest.testId}
      primary={upload ? { label: t(K.upload), onSelect: upload.choose } : undefined}
    >
      <div
        data-testid={IDS.dropZone}
        {...drop.handlers}
        className={cn(
          'relative flex min-h-full flex-col gap-3 px-(--table-pad-x) pt-3 pb-5 outline-2 -outline-offset-8 transition-[outline-color]',
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
          selecting={selection.active}
          onSelectingChange={canSelect ? selection.setActive : null}
        />
        <PhotosBody
          read={read}
          album={album}
          access={access}
          onDelete={setDeleting}
          selection={selection}
          upload={upload}
        />
        <SectionSelectionBar selection={selection} onCompare={links.compare} />
        {drop.over ? <DropVeil album={t(K.albums[album])} /> : null}
      </div>
      <PhotoDeleteConfirm photo={deleting} onClose={() => setDeleting(null)} />
      <SectionComparison
        value={search.compare}
        dayLabel={dayLabel}
        setSearch={links.setSearch}
      />
    </PatientSection>
  );
}
