import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import {
  attachPatientImage,
  deletePatientPhoto,
  fetchPatientPhoto,
  listPatientPhotos,
  patientImageQueryKeys,
  restorePatientPhoto,
  updatePatientPhoto,
} from './patient-images-api.ts';
import { photoName, toPatientPhoto } from './patient-images-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';

const PATIENT_ID = 'pat_rhuanxgy2umhsl3av5xjr';
const IMAGE_ID = 'pimg_groupdphototwo00000aa';
const VISIT_ID = 'appt_co7tgiahg3uze2okuj98w';

/** A photo as the local stack answered it (`GET …/images`, 10 Oct 2026). */
const imageRow = (patch: Record<string, unknown> = {}) => ({
  id: IMAGE_ID,
  patient_id: PATIENT_ID,
  appointment_id: VISIT_ID,
  patient_treatment_id: null,
  album: 'lhr',
  stage: 'before',
  file_key: 'organization-files/org_1kugs30wim2jh5k4zw2yk/groupd-img-5101.png',
  file_name: 'IMG_5101.png',
  display_name: null,
  caption: 'Upper lip, session one',
  body_part: 'upper_lip',
  taken_on: '2026-10-01',
  service_label: 'Consultation',
  created_at: '2026-10-10T01:43:04.802Z',
  updated_at: '2026-10-10T01:44:12.491Z',
  ...patch,
});

/** One list page as clinozy-be answers it, with its album counts. */
const listPage = (
  rows: unknown[],
  meta: Record<string, unknown> = {},
  pagination: Record<string, unknown> = {},
) => ({
  data: rows,
  meta: {
    request_id: 'req',
    album_counts: { general: 1, lhr: 1, private: 1 },
    pagination: {
      per_page: 12,
      next: null,
      has_more: false,
      estimated_total: 3,
      ...pagination,
    },
    ...meta,
  },
});

beforeEach(() => vi.resetAllMocks());

describe('listPatientPhotos', () => {
  it('reads one page for the album and visit, with the server’s total and album counts', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      listPage(
        [imageRow()],
        {},
        { next: 'cursor', has_more: true, estimated_total: 13 },
      ) as never,
    );

    const page = await listPatientPhotos(PATIENT_ID, {
      album: 'lhr',
      appointmentId: VISIT_ID,
      limit: 12,
    });

    expect(api.get).toHaveBeenCalledWith('/app/patients/{patient_id}/images', {
      params: { patient_id: PATIENT_ID },
      query: {
        album: 'lhr',
        appointment_id: VISIT_ID,
        has_appointment: undefined,
        stage: undefined,
        body_part: undefined,
        patient_treatment_id: undefined,
        sort: undefined,
        order: undefined,
        limit: 12,
        after: undefined,
      },
    });
    expect(page).toEqual({
      rows: [
        {
          id: IMAGE_ID,
          patientId: PATIENT_ID,
          appointmentId: VISIT_ID,
          patientTreatmentId: null,
          album: 'lhr',
          stage: 'before',
          fileKey: 'organization-files/org_1kugs30wim2jh5k4zw2yk/groupd-img-5101.png',
          fileName: 'IMG_5101.png',
          displayName: null,
          caption: 'Upper lip, session one',
          bodyPart: 'upper_lip',
          takenOn: '2026-10-01',
          serviceLabel: 'Consultation',
          createdAt: '2026-10-10T01:43:04.802Z',
          updatedAt: '2026-10-10T01:44:12.491Z',
        },
      ],
      next: 'cursor',
      hasMore: true,
      total: 13,
      albumCounts: { general: 1, lhr: 1, private: 1 },
    });
  });

  it('asks for the photos under no visit, every other filter, a sort and the next page', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(listPage([]) as never);

    await listPatientPhotos(
      PATIENT_ID,
      {
        appointmentId: 'none',
        stage: 'after',
        bodyPart: 'full_body',
        patientTreatmentId: 'ptrt_session000000000000',
        sort: 'createdAt',
        order: 'asc',
      },
      'cursor',
    );

    expect(vi.mocked(api.get).mock.calls[0]?.[1]).toMatchObject({
      query: {
        appointment_id: undefined,
        has_appointment: 'false',
        stage: 'after',
        body_part: 'full_body',
        patient_treatment_id: 'ptrt_session000000000000',
        sort: 'created_at',
        order: 'asc',
        after: 'cursor',
      },
    });
  });

  it('says nothing of the Private album when the server leaves its count out', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      listPage([], { album_counts: { general: 2, lhr: 0 } }) as never,
    );

    const page = await listPatientPhotos(PATIENT_ID, {});

    expect(page.albumCounts).toEqual({ general: 2, lhr: 0, private: null });
    expect(page.next).toBeNull();
    expect(page.hasMore).toBe(false);
  });

  it('refuses a photo the API would not send', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      listPage([imageRow({ body_part: 'elbow' })]) as never,
    );

    await expect(listPatientPhotos(PATIENT_ID, {})).rejects.toThrow();
  });
});

describe('one photo and its writes', () => {
  it('reads one photo', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: imageRow() } as never);

    const photo = await fetchPatientPhoto({ patientId: PATIENT_ID, imageId: IMAGE_ID });

    expect(api.get).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/images/{patient_image_id}',
      { params: { patient_id: PATIENT_ID, patient_image_id: IMAGE_ID } },
    );
    expect(photo.caption).toBe('Upper lip, session one');
  });

  it('files an uploaded photo under its file’s name, cut to 60, its key the stored object’s', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: imageRow({ album: 'general', appointment_id: null }),
    } as never);
    const long = `${'a'.repeat(70)}.jpg`;

    await attachPatientImage({
      patientId: PATIENT_ID,
      fileKey: 'org/ab/photo.jpg',
      fileName: long,
    });
    await attachPatientImage({
      patientId: PATIENT_ID,
      fileKey: 'org/ab/b.png',
      fileName: 'IMG_5100.png',
      album: 'lhr',
      appointmentId: VISIT_ID,
    });

    expect(api.post).toHaveBeenNthCalledWith(1, '/app/patients/{patient_id}/images', {
      params: { patient_id: PATIENT_ID },
      body: {
        file_key: 'org/ab/photo.jpg',
        album: 'general',
        display_name: 'a'.repeat(60),
        appointment_id: undefined,
      },
      idempotencyKey: 'image:org/ab/photo.jpg',
    });
    expect(vi.mocked(api.post).mock.calls[1]?.[1]).toMatchObject({
      body: { album: 'lhr', display_name: 'IMG_5100', appointment_id: VISIT_ID },
    });
  });

  it('saves what changed with the read’s updated_at and the action’s key', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: imageRow({ stage: 'after', updated_at: '2026-10-10T02:00:00.000Z' }),
    } as never);
    const photo = toPatientPhoto(imageRow() as never);

    const saved = await updatePatientPhoto({
      photo,
      change: { stage: 'after', appointmentId: null },
      idempotencyKey: 'key-1',
    });

    expect(api.patch).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/images/{patient_image_id}',
      {
        params: { patient_id: PATIENT_ID, patient_image_id: IMAGE_ID },
        body: {
          caption: undefined,
          taken_on: undefined,
          album: undefined,
          stage: 'after',
          body_part: undefined,
          appointment_id: null,
          expected_updated_at: '2026-10-10T01:44:12.491Z',
        },
        idempotencyKey: 'key-1',
      },
    );
    expect(saved.stage).toBe('after');
  });

  it('deletes with the reason and note, and restores with the action’s key', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined } as never);
    vi.mocked(api.post).mockResolvedValueOnce({ data: imageRow() } as never);

    await deletePatientPhoto({
      patientId: PATIENT_ID,
      imageId: IMAGE_ID,
      reason: 'not_needed',
      note: null,
    });
    const back = await restorePatientPhoto({
      patientId: PATIENT_ID,
      imageId: IMAGE_ID,
      idempotencyKey: 'key-2',
    });

    expect(api.delete).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/images/{patient_image_id}',
      {
        params: { patient_id: PATIENT_ID, patient_image_id: IMAGE_ID },
        reason: 'not_needed',
        note: undefined,
      },
    );
    expect(api.post).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/images/{patient_image_id}/restore',
      {
        params: { patient_id: PATIENT_ID, patient_image_id: IMAGE_ID },
        idempotencyKey: 'key-2',
      },
    );
    expect(back.id).toBe(IMAGE_ID);
  });
});

describe('the photos’ keys and names', () => {
  it('sits under the patients’ key, by organization and patient', () => {
    expect(patientImageQueryKeys.all.slice(0, 2)).toEqual([...patientQueryKeys.all]);
    expect(patientImageQueryKeys.detail('org_a', PATIENT_ID, IMAGE_ID)).toEqual([
      ...patientImageQueryKeys.patient('org_a', PATIENT_ID),
      'detail',
      IMAGE_ID,
    ]);
  });

  it('names a photo by its caption, else its filed name, else its file’s', () => {
    expect(
      photoName({ caption: ' Left cheek ', displayName: 'IMG_1', fileName: 'IMG_1.png' }),
    ).toBe('Left cheek');
    expect(
      photoName({ caption: '  ', displayName: 'IMG_1', fileName: 'IMG_1.png' }),
    ).toBe('IMG_1');
    expect(photoName({ caption: null, displayName: null, fileName: 'IMG_1.png' })).toBe(
      'IMG_1.png',
    );
  });
});
