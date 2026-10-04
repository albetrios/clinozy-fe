import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  useCheckIn,
  useCheckInContext,
  useCreateCheckIn,
  useCreateReview,
  useDeleteCheckIn,
  useLogFeedbackAction,
  usePatientFeedback,
  useRestoreCheckIn,
  useReview,
} from './useFeedback.ts';

const DHARTI = patientRef('Dharti Galani');
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('useFeedback', () => {
  it('reads a page, and refreshes it after a check-in, a removal and its Undo', async () => {
    const { result } = renderHook(
      () => ({
        page: usePatientFeedback(DHARTI, { type: 'all', limit: 50 }),
        create: useCreateCheckIn(),
        remove: useDeleteCheckIn(),
        restore: useRestoreCheckIn(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.page.data).toBeDefined());
    const before = result.current.page.data?.total ?? 0;
    const saved = await act(() =>
      result.current.create.mutateAsync({
        patientId: DHARTI,
        appointmentId: null,
        treatmentId: null,
        context: 'Visit check-in',
        feel: 'same',
        score: 6,
        followed: null,
        followedNote: null,
        now: null,
        nextPlan: null,
        nextOfferingIds: [],
        date: clinicToday(),
      }),
    );
    await waitFor(() => expect(result.current.page.data?.total).toBe(before + 1));
    await act(() =>
      result.current.remove.mutateAsync({
        id: saved.checkIn.id,
        reason: 'mistake',
        note: null,
      }),
    );
    await waitFor(() => expect(result.current.page.data?.total).toBe(before));
    await act(() => result.current.restore.mutateAsync(saved.checkIn.id));
    await waitFor(() => expect(result.current.page.data?.total).toBe(before + 1));
  });

  it('reads one check-in, one review and the drawer’s heading; idle without ids', async () => {
    const { result } = renderHook(
      () => ({
        checkIn: useCheckIn(ref.checkIn(1)),
        review: useReview(ref.review(1)),
        context: useCheckInContext(DHARTI, {
          appointmentId: null,
          treatmentId: ref.treatment(498),
          editingId: null,
        }),
        idle: useCheckIn(''),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.checkIn.data?.patientId).toBe(DHARTI));
    await waitFor(() => expect(result.current.review.data?.source).toBe('google'));
    await waitFor(() =>
      expect(result.current.context.data?.treatment?.name).toBe('LHR Full Face'),
    );
    expect(result.current.idle.fetchStatus).toBe('idle');
  });

  it('saves a review and logs an action on it', async () => {
    const { result } = renderHook(
      () => ({ create: useCreateReview(), log: useLogFeedbackAction() }),
      { wrapper },
    );
    const saved = await act(() =>
      result.current.create.mutateAsync({
        patientId: DHARTI,
        appointmentId: null,
        source: 'instagram',
        rating: 2,
        text: 'Waited long',
        link: null,
        date: clinicToday(),
      }),
    );
    expect(saved.callBackCreated).toBe(true);
    const action = await act(() =>
      result.current.log.mutateAsync({
        checkInId: null,
        reviewId: saved.review.id,
        action: 'replied_instagram',
        note: null,
      }),
    );
    expect(action.reviewId).toBe(saved.review.id);
  });
});
