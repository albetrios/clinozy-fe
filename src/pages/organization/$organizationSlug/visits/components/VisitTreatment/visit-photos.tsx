import { useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { photoName } from '@/shared/api/clinic/patient-images-api.ts';
import {
  attachPatientPhoto,
  patientQueryKeys,
} from '@/shared/api/clinic/patients-api.ts';
import type { PatientConsent } from '@/shared/api/clinic/patients-contracts.ts';
import type { VisitDetail } from '@/shared/api/clinic/visits-contracts.ts';
import { UPLOAD_IMAGE_CONTENT_TYPES } from '@/shared/api/uploads-api.ts';
import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { usePatientPhotos } from '@/shared/hooks/usePatientPhotos/index.ts';
import { useUploadQueue } from '@/shared/hooks/useUploadQueue/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';
import { VISIT_CONSENTS } from '../../visits.person.ts';

const K = VISIT_KEYS.treatment;
const ids = VISIT_TEST_IDS.treatment;

/** The grid holds six cells: up to four photos, the capture tile and "Up to 6 in view". */
const PHOTOS_IN_VIEW = 4;

const IMAGE_TYPES: ReadonlySet<string> = new Set(UPLOAD_IMAGE_CONTENT_TYPES);

/** "IMG_5100.jpg" → "IMG_5100": a photo's file name is stored without its extension (`S:430`). */
const stripExtension = (name: string) => name.replace(/\.[a-z0-9]+$/i, '') || name;

/** The consent line's words: photos and marketing, photos only, or no photo consent yet. */
function consentKey(consents: readonly PatientConsent[]): string {
  if (!consents.includes(VISIT_CONSENTS[1])) return K.consent.none;
  return consents.includes(VISIT_CONSENTS[2])
    ? K.consent.marketing
    : K.consent.photosOnly;
}

/**
 * "Photo comparison" (KICKOFF §6.13; `today.md:262`; H:2608–2620): the
 * patient's latest photos in capture order ("1 · <name> · 2 Jul"), the dashed
 * sage "Capture today" tile — the camera on a tablet, the file picker
 * elsewhere, through the shared upload tray, filed under this visit — and "Up
 * to 6 in view"; the line under them names who sees them and the consent.
 * Private photos only for the roles their album allows (`S:40`).
 */
export function VisitPhotos({ detail }: { detail: VisitDetail }) {
  const { t } = useTranslation(VISIT_NS);
  const clock = useClinicClock();
  const access = useClinicAccess();
  const queryClient = useQueryClient();
  const { enqueue } = useUploadQueue();
  const input = useRef<HTMLInputElement>(null);
  const patientId = detail.person.patientId ?? '';
  const privateAlbum =
    access.isResolved && passesPatientFileGate(access.roles, 'privateAlbum');
  const photos = (usePatientPhotos(patientId, { privateAlbum }).data?.photos ?? [])
    .slice()
    .sort(
      (a, b) =>
        a.takenOn.localeCompare(b.takenOn) || a.createdAt.localeCompare(b.createdAt),
    )
    .slice(-PHOTOS_IN_VIEW);
  const consent = t(consentKey(detail.patient?.consents ?? []));
  const first = detail.patient?.firstName ?? detail.person.name;

  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const images = Array.from(event.currentTarget.files ?? []).filter((file) =>
      IMAGE_TYPES.has(file.type),
    );
    event.currentTarget.value = '';
    if (images.length === 0 || !patientId) return;
    const batch = { filed: 0, total: 0 };
    batch.total = enqueue(images, {
      onUploaded: async (key, file) => {
        await attachPatientPhoto({
          patientId,
          key,
          fileName: stripExtension(file.name),
          album: 'general',
          appointmentId: detail.visit.appointmentId,
        });
        void queryClient.invalidateQueries({ queryKey: patientQueryKeys.all });
        batch.filed += 1;
        if (batch.filed === batch.total) {
          notify.success(t(K.captured, { count: batch.total, first }));
        }
      },
    }).accepted;
  };

  return (
    <div className="bg-canvas flex min-h-0 flex-col gap-2.5 border-t px-5 py-3.5 max-md:px-3 md:border-s md:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-heading text-title font-semibold tracking-[-0.02em]">
          {t(K.photos)}
        </h3>
        <span className="text-muted-foreground-strong text-xs">{t(K.photosSub)}</span>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-2 max-md:auto-rows-[7.5rem] max-md:grid-rows-none">
        {photos.map((photo, index) => (
          <figure
            key={photo.id}
            data-testid={ids.photo}
            className="bg-background flex min-h-0 flex-col gap-1 rounded-lg border p-1.25"
          >
            <div className="bg-muted min-h-0 flex-1 overflow-hidden rounded-lg">
              <img
                src={photo.fileUrl}
                alt=""
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
                className="size-full object-cover"
              />
            </div>
            <figcaption className="text-caption text-foreground-soft truncate">
              {t(K.photo, {
                n: index + 1,
                label: photoName(photo),
                date: clock.date(photo.takenOn),
              })}
            </figcaption>
          </figure>
        ))}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={!patientId}
          data-testid={ids.capture}
          className="text-detail text-tone-sage-foreground border-tone-sage-dot flex flex-col items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed p-1.25 text-center"
        >
          {t(K.capture)}
          <span className="text-micro text-muted-foreground-strong">
            {t(K.captureSub)}
          </span>
        </button>
        <div className="text-muted-foreground-strong flex items-center justify-center rounded-lg border border-dashed p-1.5 text-center text-xs">
          {t(K.upTo)}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        tabIndex={-1}
        onChange={upload}
      />
      <p className="text-muted-foreground-strong text-xs">
        {t(K.photoNote, { consent })}
      </p>
    </div>
  );
}
