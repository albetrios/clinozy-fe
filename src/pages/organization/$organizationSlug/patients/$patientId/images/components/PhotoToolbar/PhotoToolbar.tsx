import { type KeyboardEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { PatientPhotoVisit } from '@/shared/api/clinic/patient-images-api.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { Picker, type PickerOption } from '@/shared/components/Picker/index.ts';
import { RoomViewTabs } from '@/shared/components/RoomToolbar/index.ts';
import { ChevronDown } from '@/shared/icons/index.ts';
import type { PhotoSize } from '@/shared/store/useDevicePrefsStore/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../shared/patient-photos.constants.ts';
import { NO_VISIT, type PhotoAlbum } from '../../images.search.ts';
import {
  PHOTO_ALBUM_LOOK,
  PHOTO_SIZE_LOOK,
  PHOTO_SIZES,
} from '../../shared/photo-looks.ts';
import type { PhotoVisitOption } from '../../shared/photo-view.ts';
import { PHOTO_TOOLBAR_TEST_IDS } from './photo-toolbar.constants.ts';

const K = PATIENT_PHOTOS_KEYS;

/** The visit filter's "All photos" key. */
const ALL = 'all';

const SIZE_KEYS: Readonly<Record<PhotoSize, { name: string; letter: string }>> = {
  small: { name: K.sizes.small, letter: K.sizes.smallShort },
  medium: { name: K.sizes.medium, letter: K.sizes.mediumShort },
  large: { name: K.sizes.large, letter: K.sizes.largeShort },
};

/** Props of {@link PhotoToolbar}. */
export interface PhotoToolbarProps {
  album: PhotoAlbum;
  /** The albums the member sees (Private only for Doctor, Admin, Owner). */
  albums: readonly PhotoAlbum[];
  onAlbumChange: (album: PhotoAlbum) => void;
  /** Photos of the album under the filter; none shows no count. */
  count: number;
  /** Photos of the album, for "All photos" · "3 in General". */
  albumCount: number;
  /** The filter: a visit id, "none", or every photo (undefined). */
  appointment: string | undefined;
  visits: readonly PhotoVisitOption[];
  onAppointmentChange: (appointment: string | undefined) => void;
  /** "24 Sep" / "Today" for a visit's day. */
  dayLabel: (date: string) => string;
  size: PhotoSize;
  onSizeChange: (size: PhotoSize) => void;
}

/** "#2790 · Completed": a visit's number and status. */
function useVisitOptions(
  visits: readonly PhotoVisitOption[],
  dayLabel: (date: string) => string,
): PickerOption[] {
  const { t } = useTranslation([PATIENT_PHOTOS_NS, CLINIC_NS]);
  return visits.map(({ visit, count }: { visit: PatientPhotoVisit; count: number }) => ({
    key: visit.appointmentId,
    label: t(K.visitFilter.visit, {
      day: dayLabel(visit.date),
      service: visit.serviceLabel,
    }),
    sub: t(K.visitFilter.visitSub, {
      seq: visit.seq,
      status: t(CLINIC_KEYS.appointments.statuses[visit.status], { ns: CLINIC_NS }),
    }),
    meta: t(K.visitFilter.visitMeta, { count }),
    tone: 'sky' as const,
  }));
}

/** S / M / L — radios that move with the arrow keys, focus following the pick. */
function PhotoSizeRadios({
  size,
  onSizeChange,
}: {
  size: PhotoSize;
  onSizeChange: (size: PhotoSize) => void;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const refs = useRef(new Map<PhotoSize, HTMLButtonElement>());
  const step = (event: KeyboardEvent<HTMLButtonElement>) => {
    const forward = ['ArrowRight', 'ArrowDown'].includes(event.key);
    if (!(forward || ['ArrowLeft', 'ArrowUp'].includes(event.key))) return;
    event.preventDefault();
    const index = PHOTO_SIZES.indexOf(size);
    const next =
      PHOTO_SIZES[(index + (forward ? 1 : -1) + PHOTO_SIZES.length) % PHOTO_SIZES.length];
    if (!next) return;
    refs.current.get(next)?.focus();
    onSizeChange(next);
  };
  return (
    <div
      role="radiogroup"
      aria-label={t(K.sizes.label)}
      data-slot="segmented"
      className="bg-card flex h-9 flex-none gap-0.5 rounded-lg border p-0.75"
    >
      {PHOTO_SIZES.map((option) => {
        const checked = option === size;
        const name = t(SIZE_KEYS[option].name);
        return (
          <button
            key={option}
            ref={(node) => {
              if (node) refs.current.set(option, node);
              else refs.current.delete(option);
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={name}
            title={name}
            tabIndex={checked ? 0 : -1}
            onClick={() => onSizeChange(option)}
            onKeyDown={step}
            data-testid={`${PHOTO_TOOLBAR_TEST_IDS.size}-${option}`}
            className={cn(
              'flex size-7 items-center justify-center rounded-md font-semibold transition-colors',
              PHOTO_SIZE_LOOK[option].letter,
              checked
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(SIZE_KEYS[option].letter)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The Photos toolbar (H:828; `patient-file.md:61`): the album tabs on the
 * segmented track — General `ImageIcon`, Private `Lock`, LHR `Sparkles` —
 * "3 photos", the visit filter "All photos ⌄" ("All photos" · "Not attached
 * to a visit" · each visit with photos), then the S / M / L radios at the end.
 * It wraps on a phone.
 */
export function PhotoToolbar({
  album,
  albums,
  onAlbumChange,
  count,
  albumCount,
  appointment,
  visits,
  onAppointmentChange,
  dayLabel,
  size,
  onSizeChange,
}: PhotoToolbarProps) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const albumLabel = t(K.albums[album]);
  const visitOptions = useVisitOptions(visits, dayLabel);
  const options: PickerOption[] = [
    {
      key: ALL,
      label: t(K.visitFilter.all),
      sub: t(K.visitFilter.allSub, { count: albumCount, album: albumLabel }),
    },
    { key: NO_VISIT, label: t(K.visitFilter.none), sub: t(K.visitFilter.noneSub) },
    ...visitOptions,
  ];

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="min-w-0 flex-none">
        <RoomViewTabs
          label={t(K.albumTabs)}
          tabs={albums.map((id) => ({
            id,
            label: t(K.albums[id]),
            icon: PHOTO_ALBUM_LOOK[id].icon,
          }))}
          value={album}
          onValueChange={(id) => onAlbumChange(id as PhotoAlbum)}
          testIdPrefix={PHOTO_TOOLBAR_TEST_IDS.prefix}
        />
      </div>
      {count > 0 ? (
        <span className="text-detail text-muted-foreground whitespace-nowrap">
          {t(K.count, { count })}
        </span>
      ) : null}
      <Picker
        label={t(K.visitFilter.label)}
        value={appointment ?? ALL}
        options={options}
        onChange={(key) => onAppointmentChange(!key || key === ALL ? undefined : key)}
        searchable={false}
        size="md"
        minWidth={300}
        testId={PHOTO_TOOLBAR_TEST_IDS.visitFilter}
        className="flex-none"
        renderTrigger={({ open, selected }) => (
          <button
            type="button"
            data-testid={PHOTO_TOOLBAR_TEST_IDS.visitFilter}
            data-slot="button"
            className="bg-card text-body text-foreground hover:bg-muted inline-flex h-9 items-center gap-1.5 rounded-lg border ps-3 pe-2.5 font-medium whitespace-nowrap transition-colors"
          >
            {selected[0]?.label ?? t(K.visitFilter.all)}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'text-muted-foreground size-3.5 transition-transform duration-150',
                open && 'rotate-180',
              )}
            />
          </button>
        )}
      />
      <span className="flex-1" />
      <PhotoSizeRadios size={size} onSizeChange={onSizeChange} />
    </div>
  );
}
