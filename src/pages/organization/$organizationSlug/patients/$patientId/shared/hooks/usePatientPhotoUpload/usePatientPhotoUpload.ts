import { useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, type RefObject, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
  attachPatientImage,
  patientImageQueryKeys,
} from '@/shared/api/app/patient-images-api.ts';
import {
  PATIENT_PHOTO_CONTENT_TYPES,
  type PatientPhotoAlbum,
} from '@/shared/api/app/patient-images-contracts.ts';
import { useUploadQueue } from '@/shared/hooks/useUploadQueue/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../patient-photos.constants.ts';

const K = PATIENT_PHOTOS_KEYS;

/** The file picker's test id. */
export const PATIENT_PHOTOS_INPUT_TEST_ID = 'patient-photos-input';

/** The camera input's test id (a touch device's "Take photo"). */
export const PATIENT_PHOTOS_CAMERA_TEST_ID = 'patient-photos-camera';

/** What the file's photo uploads offer its parts. */
export interface PatientPhotoUploads {
  /**
   * Open the file picker for an album — from a click or a key press: the
   * browser opens it only inside the user's own gesture.
   */
  pick: (album: PatientPhotoAlbum) => void;
  /**
   * Open the camera for an album ("Take photo" on a touch device — the input's
   * `capture`); like {@link pick}, only inside the user's own gesture.
   */
  capture: (album: PatientPhotoAlbum) => void;
  /** Upload dropped, pasted or picked files into an album; anything but an image is left out. */
  upload: (files: FileList | readonly File[], album: PatientPhotoAlbum) => void;
}

/** One hidden file input the file renders once: the picker's or the camera's. */
export interface PatientPhotoInputProps {
  ref: RefObject<HTMLInputElement | null>;
  type: 'file';
  multiple: boolean;
  accept: string;
  /** `environment` — the camera's input: the device opens its rear camera. */
  capture?: 'environment';
  hidden: true;
  tabIndex: -1;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  'data-testid': string;
}

/** {@link usePatientPhotoUpload}: the uploads and the hidden inputs the file renders once. */
export interface PatientPhotoUpload extends PatientPhotoUploads {
  inputProps: PatientPhotoInputProps;
  /** The camera's input (`capture="environment"`, one photo a shot). */
  cameraInputProps: PatientPhotoInputProps;
}

/** What clinozy-be files as a photo — a JPG or a PNG (a WebP upload is refused at the attach). */
const IMAGE_TYPES: ReadonlySet<string> = new Set(PATIENT_PHOTO_CONTENT_TYPES);

/**
 * The patient's photo uploads (KICKOFF §6.6 Photos › Upload): the section's
 * drop, paste, upload strip and "Upload images", the Overview's Photos card,
 * the Add menu's "Photo", and on a touch device "Take photo" — the camera
 * input (change-patient-overview-photos D15). JPG and PNG files go
 * through the shared upload tray (10 MB each, Q-P5); each is filed in the
 * album as it lands (`POST /app/patients/:patient_id/images`, named as its
 * file), under no visit, taken today (the server's default), and the photos
 * refresh. Once the last of a batch is filed: "2 photos uploaded to General".
 * A drop with no JPG or PNG in it says "Drop image files". The tray outlives
 * the screen, so the filing does not depend on the file staying open.
 */
export function usePatientPhotoUpload(patientId: string): PatientPhotoUpload {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const { enqueue } = useUploadQueue();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const pickedAlbum = useRef<PatientPhotoAlbum>('general');

  const upload = useCallback(
    (files: FileList | readonly File[], album: PatientPhotoAlbum) => {
      const images = Array.from(files).filter((file) => IMAGE_TYPES.has(file.type));
      if (images.length === 0) {
        notify.info(t(K.notImages));
        return;
      }
      const batch = { filed: 0, total: 0 };
      const albumLabel = t(K.albums[album]);
      batch.total = enqueue(images, {
        onUploaded: async (key, file) => {
          await attachPatientImage({
            patientId,
            fileKey: key,
            fileName: file.name,
            album,
          });
          void queryClient.invalidateQueries({ queryKey: patientImageQueryKeys.all });
          batch.filed += 1;
          if (batch.filed === batch.total) {
            notify.success(t(K.uploaded, { count: batch.total, album: albumLabel }));
          }
        },
      }).accepted;
    },
    [enqueue, patientId, queryClient, t],
  );

  const pick = useCallback((album: PatientPhotoAlbum) => {
    pickedAlbum.current = album;
    inputRef.current?.click();
  }, []);

  const capture = useCallback((album: PatientPhotoAlbum) => {
    pickedAlbum.current = album;
    cameraRef.current?.click();
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

  return useMemo(() => {
    const accept = PATIENT_PHOTO_CONTENT_TYPES.join(',');
    return {
      pick,
      capture,
      upload,
      inputProps: {
        ref: inputRef,
        type: 'file' as const,
        multiple: true,
        accept,
        hidden: true as const,
        tabIndex: -1 as const,
        onChange,
        'data-testid': PATIENT_PHOTOS_INPUT_TEST_ID,
      },
      cameraInputProps: {
        ref: cameraRef,
        type: 'file' as const,
        multiple: false,
        accept,
        capture: 'environment' as const,
        hidden: true as const,
        tabIndex: -1 as const,
        onChange,
        'data-testid': PATIENT_PHOTOS_CAMERA_TEST_ID,
      },
    };
  }, [capture, onChange, pick, upload]);
}
