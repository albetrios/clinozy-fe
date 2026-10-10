import { useNavigate, useParams } from '@tanstack/react-router';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import {
  PATIENT_PHOTO_BODY_PARTS,
  PATIENT_PHOTO_STAGES,
  type PatientPhoto,
  type PatientPhotoBodyPart,
  type PatientPhotoChange,
  type PatientPhotoStage,
  photoName,
} from '@/shared/api/clinic/patient-images-contracts.ts';
import {
  type DrawerChipOption,
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import { DatePicker } from '@/shared/components/Picker/DatePicker/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import {
  usePatientPhoto,
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
import { usePhotoVisits } from '../../shared/hooks/usePhotoVisits/index.ts';
import {
  PHOTO_ALBUM_LOOK,
  PHOTO_BODY_PART_TONES,
  PHOTO_STAGE_TONES,
} from '../../shared/photo-looks.ts';
import type { PhotoVisit } from '../../shared/photo-view.ts';
import { manifest } from './edit.manifest.ts';

const K = PATIENT_PHOTOS_KEYS;

/** The "Not attached" chip of the Visit field. */
const NOT_ATTACHED = 'none';

/** Visits Photo details offers after "Not attached" — the last 8 (H:… `slice(0, 8)`). */
const VISIT_CHIPS = 8;

/** The design's 60 for the name (the API's caption takes 200). */
const NAME_MAX = 60;

/** The drawer's form: the photo's fields as the controls hold them. */
type PhotoForm = {
  name: string;
  takenOn: string;
  album: PhotoAlbum;
  stage: PatientPhotoStage | null;
  bodyPart: PatientPhotoBodyPart | null;
  visit: string;
};

/** The form's fields in the drawer's order — a refused save outlines the first one named. */
const FIELD_ORDER = ['name', 'takenOn', 'album', 'stage', 'bodyPart', 'visit'] as const;

/** The API's names the form spells differently (the 400's `errors[].field`, camel-cased). */
const SERVER_FIELDS = { caption: 'name', appointmentId: 'visit' } as const;

function formOf(photo: PatientPhoto): PhotoForm {
  return {
    name: photoName(photo),
    takenOn: photo.takenOn,
    album: photo.album,
    stage: photo.stage,
    bodyPart: photo.bodyPart,
    visit: photo.appointmentId ?? NOT_ATTACHED,
  };
}

/** What changed — a blank name keeps the old one (`S:429–432`); the name is the caption. */
function changeOf(photo: PatientPhoto, form: PhotoForm): PatientPhotoChange {
  const before = formOf(photo);
  const change: PatientPhotoChange = {};
  const name = form.name.trim();
  if (name && name !== before.name) change.caption = name;
  if (form.takenOn !== before.takenOn) change.takenOn = form.takenOn;
  if (form.album !== before.album) change.album = form.album;
  if (form.stage !== before.stage) change.stage = form.stage;
  if (form.bodyPart !== before.bodyPart) change.bodyPart = form.bodyPart;
  if (form.visit !== before.visit) {
    change.appointmentId = form.visit === NOT_ATTACHED ? null : form.visit;
  }
  return change;
}

/** The chips of each pick-one field, in the drawer's order. */
function usePhotoChips(photo: PatientPhoto, visits: readonly PhotoVisit[]) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const access = usePhotoAccess();
  const { day: dayLabel } = useClinicClock();
  const albums: DrawerChipOption<PhotoAlbum>[] = access.albums.map((album) => ({
    value: album,
    label: t(K.albums[album]),
    tone: PHOTO_ALBUM_LOOK[album].tone,
  }));
  const stages: DrawerChipOption<PatientPhotoStage>[] = PATIENT_PHOTO_STAGES.map(
    (stage) => ({
      value: stage,
      label: t(K.stages[stage]),
      tone: PHOTO_STAGE_TONES[stage],
    }),
  );
  const bodyParts: DrawerChipOption<PatientPhotoBodyPart>[] =
    PATIENT_PHOTO_BODY_PARTS.map((part) => ({
      value: part,
      label: t(K.bodyParts[part]),
      tone: PHOTO_BODY_PART_TONES[part],
    }));
  const offered = visits.slice(0, VISIT_CHIPS);
  // A visit past the last 8 still shows, picked, when the photo is filed under it.
  const own =
    photo.appointmentId &&
    !offered.some((visit) => visit.appointmentId === photo.appointmentId)
      ? visits.filter((visit) => visit.appointmentId === photo.appointmentId)
      : [];
  const visitChips: DrawerChipOption<string>[] = [
    { value: NOT_ATTACHED, label: t(K.details.notAttached) },
    ...[...offered, ...own].map((visit) => ({
      value: visit.appointmentId,
      label: t(K.visitFilter.visit, {
        day: dayLabel(visit.date),
        service: visit.serviceLabel,
      }),
      tone: 'sky' as const,
    })),
  ];
  return { albums, stages, bodyParts, visitChips };
}

/** The drawer once the photo is read: its form, and the save. */
function PhotoDetailsForm({
  photo,
  visits,
  onClose,
  onStale,
}: {
  photo: PatientPhoto;
  visits: readonly PhotoVisit[];
  onClose: () => void;
  /** Read the photo again — the "Reload" of a save someone else's beat. */
  onStale: () => void;
}) {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const access = usePhotoAccess();
  const update = useUpdatePatientPhoto({ notifyOnError: false });
  const methods = useForm<PhotoForm>({ defaultValues: formOf(photo) });
  const form = useFormValues(methods);
  const ids = useId();
  const field = useDrawerFieldIds(methods, ids);
  const name = field('name');
  const takenOn = field('takenOn');
  const album = field('album');
  const stage = field('stage');
  const bodyPart = field('bodyPart');
  const visit = field('visit');
  const chips = usePhotoChips(photo, visits);
  const dirty = Object.keys(changeOf(photo, form)).length > 0;
  const readOnly = !access.canWrite;
  const set = (fields: Partial<PhotoForm>) => {
    for (const [key, value] of Object.entries(fields)) {
      methods.setValue(key as keyof PhotoForm, value as never, { shouldDirty: true });
    }
  };
  // Nothing changed saves nothing; a refusal outlines its field, a stale read
  // offers "Reload", a dropped connection keeps the draft with "Retry save".
  const { saveState, save } = useDrawerSave<PhotoForm, boolean>({
    form: methods,
    fieldOrder: FIELD_ORDER,
    serverFields: SERVER_FIELDS,
    toastId: 'photo-details-save-failed',
    onStale,
    onField: () => undefined,
    write: async () => {
      const change = changeOf(photo, methods.getValues());
      if (Object.keys(change).length === 0) return false;
      await update.mutateAsync({ photo, change });
      return true;
    },
    onDone: (saved) => {
      if (saved) notify.success(t(K.details.saved));
      onClose();
    },
  });

  return (
    <RecordDrawer
      open
      onClose={onClose}
      title={t(K.details.title)}
      sub={t(K.details.sub)}
      tone="sage"
      content={{ fieldCount: 6 }}
      readOnly={readOnly}
      saveLabel={t(K.details.save)}
      onSave={() => void save()}
      saveState={saveState}
      dirty={dirty}
      testId={manifest.testId}
    >
      <DrawerFieldGrid>
        <DrawerField
          label={t(K.details.name)}
          htmlFor={name.id}
          error={name.error}
          span="half"
        >
          <DrawerInput
            {...name.control}
            value={form.name}
            maxLength={NAME_MAX}
            placeholder={t(K.details.namePlaceholder)}
            disabled={readOnly}
            onChange={(event) => set({ name: event.currentTarget.value })}
            data-testid={`${manifest.testId}-name`}
          />
        </DrawerField>
        <DrawerField
          label={t(K.details.date)}
          htmlFor={takenOn.id}
          error={takenOn.error}
          span="third"
        >
          <DatePicker
            id={takenOn.id}
            label={t(K.details.date)}
            value={form.takenOn}
            onChange={(date) => set({ takenOn: date ?? photo.takenOn })}
            future={0}
            disabled={readOnly}
            size="md"
            testId={`${manifest.testId}-date`}
          />
        </DrawerField>
        <DrawerField label={t(K.details.album)} error={album.error} span="half">
          <DrawerChips
            label={t(K.details.album)}
            options={chips.albums}
            value={form.album}
            onChange={(album) => {
              if (album) set({ album });
            }}
            disabled={readOnly}
            testId={`${manifest.testId}-album`}
          />
        </DrawerField>
        <DrawerField
          label={t(K.details.stage)}
          hint={t(K.details.optional)}
          error={stage.error}
          span="half"
        >
          <DrawerChips
            label={t(K.details.stage)}
            options={chips.stages}
            value={form.stage}
            onChange={(stage) => set({ stage })}
            clearable
            disabled={readOnly}
            testId={`${manifest.testId}-stage`}
          />
        </DrawerField>
        <DrawerField
          label={t(K.details.bodyPart)}
          hint={t(K.details.optional)}
          error={bodyPart.error}
          span="full"
        >
          <DrawerChips
            label={t(K.details.bodyPart)}
            options={chips.bodyParts}
            value={form.bodyPart}
            onChange={(bodyPart) => set({ bodyPart })}
            clearable
            disabled={readOnly}
            testId={`${manifest.testId}-body-part`}
          />
        </DrawerField>
        <DrawerField
          label={t(K.details.visit)}
          hint={t(K.details.visitHint)}
          error={visit.error}
          span="full"
        >
          <DrawerChips
            label={t(K.details.visit)}
            options={chips.visitChips}
            value={form.visit}
            onChange={(visit) => set({ visit: visit ?? NOT_ATTACHED })}
            disabled={readOnly}
            testId={`${manifest.testId}-visit`}
          />
        </DrawerField>
      </DrawerFieldGrid>
    </RecordDrawer>
  );
}

/**
 * Photo details — `/patients/$patientId/images/$imageId/edit` (`S:41`; KICKOFF
 * §6.6 Drawers): the 560px drawer over Photos — Name (≤60, stored as the
 * caption; a blank one keeps the old), Date (none in the future), Album
 * (General stone · Private lav · LHR blush), Stage (Before · After, optional),
 * Body part (the API's fifteen, optional), Visit ("Not attached" + the last 8
 * checked-in or completed visits). "Save details" sends what changed with the
 * read's `updated_at` → "Photo details saved". Read-only without
 * `patient:update`. Closing goes back to the section with its album and filter.
 */
export function PatientPhotoDetailsPage() {
  const { organizationSlug = '', imageId = '' } = useParams({ strict: false });
  const navigate = useNavigate();
  const { patientId } = usePatientFileContext();
  const read = usePatientPhoto(patientId, imageId);
  const visits = usePhotoVisits();
  // The drawer opens once access has answered — never read-only for a moment first.
  const { resolved } = usePhotoAccess();
  const close = () =>
    void navigate({
      ...organizationPatientSection(organizationSlug, patientId, 'images'),
      search: true,
      replace: true,
    });
  useMissingPhoto(read.error, close);
  if (!(read.data && resolved)) return null;
  return (
    <PhotoDetailsForm
      // A reload after a stale save starts the form again from the fresh read.
      key={read.data.updatedAt}
      photo={read.data}
      visits={visits}
      onClose={close}
      onStale={() => void read.refetch()}
    />
  );
}
