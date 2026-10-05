import { useNavigate, useParams } from '@tanstack/react-router';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import type { BodyPart } from '@/shared/api/clinic/clinic-schema.ts';
import {
  type PatientPhoto,
  type PatientPhotoPatch,
  type PatientPhotoVisit,
  photoName,
} from '@/shared/api/clinic/patient-images-api.ts';
import {
  type DrawerChipOption,
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import {
  usePatientPhotos,
  useUpdatePatientPhoto,
} from '@/shared/hooks/usePatientPhotos/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../shared/patient-photos.constants.ts';
import type { PhotoAlbum } from '../../images.search.ts';
import { useMissingPhoto } from '../../shared/hooks/useMissingPhoto/index.ts';
import { usePhotoAccess } from '../../shared/hooks/usePhotoAccess/index.ts';
import { usePhotoDayLabel } from '../../shared/hooks/usePhotoDayLabel/index.ts';
import {
  PHOTO_ALBUM_LOOK,
  PHOTO_BODY_PART_TONES,
  PHOTO_BODY_PARTS,
} from '../../shared/photo-looks.ts';
import { manifest } from './edit.manifest.ts';

const K = PATIENT_PHOTOS_KEYS;

/** The "Not attached" chip of the Visit field. */
const NOT_ATTACHED = 'none';

/** Visits Photo details offers after "Not attached" — the last 8 (H:… `slice(0, 8)`). */
const VISIT_CHIPS = 8;

/** The drawer's form: the photo's fields as the controls hold them. */
type PhotoForm = {
  name: string;
  takenOn: string;
  album: PhotoAlbum;
  bodyPart: BodyPart | null;
  visit: string;
};

/** The form's fields in the drawer's order — a refused save outlines the first one named. */
const FIELD_ORDER = ['name', 'takenOn', 'album', 'bodyPart', 'visit'] as const;

/** The contract's names the form spells differently. */
const SERVER_FIELDS = { caption: 'name', appointmentId: 'visit' } as const;

function formOf(photo: PatientPhoto): PhotoForm {
  return {
    name: photoName(photo),
    takenOn: photo.takenOn,
    album: photo.album,
    bodyPart: photo.bodyPart,
    visit: photo.appointmentId ?? NOT_ATTACHED,
  };
}

/** What changed — a blank name keeps the old one (`S:429–432`). */
function patchOf(photo: PatientPhoto, form: PhotoForm): PatientPhotoPatch {
  const before = formOf(photo);
  const patch: PatientPhotoPatch = {};
  const name = form.name.trim();
  if (name && name !== before.name) patch.caption = name;
  if (form.takenOn !== before.takenOn) patch.takenOn = form.takenOn;
  if (form.album !== before.album) patch.album = form.album;
  if (form.bodyPart !== before.bodyPart) patch.bodyPart = form.bodyPart;
  if (form.visit !== before.visit) {
    patch.appointmentId = form.visit === NOT_ATTACHED ? null : form.visit;
  }
  return patch;
}

/** The drawer once the photo is read: its form, and the save. */
function PhotoDetailsForm({
  photo,
  visits,
  onClose,
}: {
  photo: PatientPhoto;
  visits: readonly PatientPhotoVisit[];
  onClose: () => void;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const access = usePhotoAccess();
  const dayLabel = usePhotoDayLabel();
  const update = useUpdatePatientPhoto({ notifyOnError: false });
  const methods = useForm<PhotoForm>({ defaultValues: formOf(photo) });
  const form = useFormValues(methods);
  const nameId = useId();
  const dateId = useId();
  const dirty = Object.keys(patchOf(photo, form)).length > 0;
  const set = (fields: Partial<PhotoForm>) => {
    for (const [key, value] of Object.entries(fields)) {
      methods.setValue(key as keyof PhotoForm, value as never, { shouldDirty: true });
    }
  };
  // Nothing changed saves nothing; a refusal outlines its field, a dropped
  // connection keeps the draft with "Retry save" (the shared drawer save).
  const { saveState, save } = useDrawerSave<PhotoForm, boolean>({
    form: methods,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    toastId: 'photo-details-save-failed',
    onField: () => undefined,
    write: async () => {
      const patch = patchOf(photo, methods.getValues());
      if (Object.keys(patch).length === 0) return false;
      await update.mutateAsync({ id: photo.id, patch });
      return true;
    },
    onDone: (saved) => {
      if (saved) notify.success(t(K.details.saved));
      onClose();
    },
  });

  const albums: DrawerChipOption<PhotoAlbum>[] = access.albums.map((album) => ({
    value: album,
    label: t(K.albums[album]),
    tone: PHOTO_ALBUM_LOOK[album].tone,
  }));
  // A part the drawer doesn't offer still shows, picked, when the photo has it.
  const parts =
    photo.bodyPart && !PHOTO_BODY_PARTS.includes(photo.bodyPart)
      ? [...PHOTO_BODY_PARTS, photo.bodyPart]
      : PHOTO_BODY_PARTS;
  const bodyParts: DrawerChipOption<BodyPart>[] = parts.map((part) => ({
    value: part,
    label: t(K.bodyParts[part]),
    tone: PHOTO_BODY_PART_TONES[part],
  }));
  const visitChips: DrawerChipOption<string>[] = [
    { value: NOT_ATTACHED, label: t(K.details.notAttached) },
    ...visits.slice(0, VISIT_CHIPS).map((visit) => ({
      value: visit.appointmentId,
      label: t(K.visitFilter.visit, {
        day: dayLabel(visit.date),
        service: visit.serviceLabel,
      }),
      tone: 'sky' as const,
    })),
  ];

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(K.details.title)}
      sub={t(K.details.sub)}
      tone="sage"
      content={{ fieldCount: 5 }}
      readOnly={!access.canEdit}
      saveLabel={t(K.details.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={dirty}
      testId={manifest.testId}
    >
      <DrawerFieldGrid>
        <DrawerField label={t(K.details.name)} htmlFor={nameId} span="half">
          <DrawerInput
            id={nameId}
            value={form.name}
            maxLength={60}
            placeholder={t(K.details.namePlaceholder)}
            disabled={!access.canEdit}
            onChange={(event) => set({ name: event.currentTarget.value })}
            data-testid={`${manifest.testId}-name`}
          />
        </DrawerField>
        <DrawerField label={t(K.details.date)} htmlFor={dateId} span="third">
          <DatePicker
            id={dateId}
            label={t(K.details.date)}
            value={form.takenOn}
            onChange={(date) => set({ takenOn: date ?? photo.takenOn })}
            future={0}
            disabled={!access.canEdit}
            size="md"
            testId={`${manifest.testId}-date`}
          />
        </DrawerField>
        <DrawerField label={t(K.details.album)} span="half">
          <DrawerChips
            label={t(K.details.album)}
            options={albums}
            value={form.album}
            onChange={(album) => {
              if (album) set({ album });
            }}
            disabled={!access.canEdit}
            testId={`${manifest.testId}-album`}
          />
        </DrawerField>
        <DrawerField
          label={t(K.details.bodyPart)}
          hint={t(K.details.optional)}
          span="full"
        >
          <DrawerChips
            label={t(K.details.bodyPart)}
            options={bodyParts}
            value={form.bodyPart}
            onChange={(bodyPart) => set({ bodyPart })}
            clearable
            disabled={!access.canEdit}
            testId={`${manifest.testId}-body-part`}
          />
        </DrawerField>
        <DrawerField label={t(K.details.visit)} hint={t(K.details.visitHint)} span="full">
          <DrawerChips
            label={t(K.details.visit)}
            options={visitChips}
            value={form.visit}
            onChange={(visit) => set({ visit: visit ?? NOT_ATTACHED })}
            disabled={!access.canEdit}
            testId={`${manifest.testId}-visit`}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </RecordDrawer>
  );
}

/**
 * Photo details — `/patients/$patientId/images/$imageId/edit` (`S:41`; KICKOFF
 * §6.6 Drawers): the 560px drawer over Photos — Name (≤60, a blank one keeps
 * the old), Date, Album (General stone · Private lav · LHR blush), Body part
 * (optional), Visit ("Not attached" + the last 8). "Save details" → "Photo
 * details saved". Read-only without Patients edit. Closing goes back to the
 * section with its album and filter.
 */
export function PatientPhotoDetailsPage() {
  const { organizationSlug = '', imageId = '' } = useParams({ strict: false });
  const navigate = useNavigate();
  const { patientId } = usePatientFileContext();
  const access = usePhotoAccess();
  const read = usePatientPhotos(patientId, {
    privateAlbum: access.privateAlbum,
    enabled: access.resolved,
  });
  const photo = read.data?.photos.find((candidate) => candidate.id === imageId);
  const close = () =>
    void navigate({
      ...organizationPatientSection(organizationSlug, patientId, 'images'),
      search: true,
      replace: true,
    });
  useMissingPhoto(read.isSuccess && !photo, close);
  if (!(photo && read.data)) return null;
  return <PhotoDetailsForm photo={photo} visits={read.data.visits} onClose={close} />;
}
