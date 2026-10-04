import { useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, type RefObject, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { ImageAlbum } from '@/shared/api/clinic/clinic-schema.ts';
import {
  attachPatientPhoto,
  patientQueryKeys,
} from '@/shared/api/clinic/patients-api.ts';
import { UPLOAD_IMAGE_CONTENT_TYPES } from '@/shared/api/uploads-api.ts';
import { useUploadQueue } from '@/shared/hooks/useUploadQueue/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../patient-photos.constants.ts';

const K = PATIENT_PHOTOS_KEYS;

/** The file picker's test id. */
export const PATIENT_PHOTOS_INPUT_TEST_ID = 'patient-photos-input';

/** What the file's photo uploads offer its parts. */
export interface PatientPhotoUploads {
  /**
   * Open the file picker for an album — from a click or a key press: the
   * browser opens it only inside the user's own gesture.
   */
  pick: (album: ImageAlbum) => void;
  /** Upload dropped or picked files into an album; anything but an image is left out. */
  upload: (files: FileList | readonly File[], album: ImageAlbum) => void;
}

/** {@link usePatientPhotoUpload}: the uploads and the hidden input the file renders once. */
export interface PatientPhotoUpload extends PatientPhotoUploads {
  inputProps: {
    ref: RefObject<HTMLInputElement | null>;
    type: 'file';
    multiple: true;
    accept: string;
    hidden: true;
    tabIndex: -1;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    'data-testid': string;
  };
}

const IMAGE_TYPES: ReadonlySet<string> = new Set(UPLOAD_IMAGE_CONTENT_TYPES);

/** "IMG_5100.jpg" → "IMG_5100": a photo's file name is stored without its extension (`S:430`). */
function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '') || name;
}

/**
 * The patient's photo uploads (KICKOFF §6.6 Photos › Upload): the section's
 * drop and "Upload images", and the Add menu's "Photo". Files go through the
 * shared upload tray (10 MB each, Q-P5); each is filed in the album as it
 * lands, under no visit, taken today, and the photos refresh. Once the last
 * of a batch is filed: "2 photos uploaded to General". A drop with no image in
 * it says "Drop image files". The tray outlives the screen, so the filing
 * does not depend on the file staying open.
 */
export function usePatientPhotoUpload(patientId: string): PatientPhotoUpload {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const { enqueue } = useUploadQueue();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pickedAlbum = useRef<ImageAlbum>('general');

  const upload = useCallback(
    (files: FileList | readonly File[], album: ImageAlbum) => {
      const images = Array.from(files).filter((file) => IMAGE_TYPES.has(file.type));
      if (images.length === 0) {
        notify.info(t(K.notImages));
        return;
      }
      const batch = { filed: 0, total: 0 };
      const albumLabel = t(K.albums[album]);
      batch.total = enqueue(images, {
        onUploaded: async (key, file) => {
          await attachPatientPhoto({
            patientId,
            key,
            fileName: stripExtension(file.name),
            album,
            appointmentId: null,
          });
          void queryClient.invalidateQueries({ queryKey: patientQueryKeys.all });
          batch.filed += 1;
          if (batch.filed === batch.total) {
            notify.success(t(K.uploaded, { count: batch.total, album: albumLabel }));
          }
        },
      }).accepted;
    },
    [enqueue, patientId, queryClient, t],
  );

  const pick = useCallback((album: ImageAlbum) => {
    pickedAlbum.current = album;
    inputRef.current?.click();
  }, []);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { files } = event.currentTarget;
      if (files && files.length > 0) upload(files, pickedAlbum.current);
      // The same file can be picked again.
      event.currentTarget.value = '';
    },
    [upload],
  );

  return useMemo(
    () => ({
      pick,
      upload,
      inputProps: {
        ref: inputRef,
        type: 'file' as const,
        multiple: true as const,
        accept: UPLOAD_IMAGE_CONTENT_TYPES.join(','),
        hidden: true as const,
        tabIndex: -1 as const,
        onChange,
        'data-testid': PATIENT_PHOTOS_INPUT_TEST_ID,
      },
    }),
    [onChange, pick, upload],
  );
}
