import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { patientFileQueryKeys } from '@/shared/api/clinic/patient-file-api.ts';
import type { PatientFile } from '@/shared/api/clinic/patient-file-contracts.ts';
import type { PatientRecord } from '@/shared/api/clinic/patients-contracts.ts';

import { useClinicalLists } from './useClinicalLists.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
}));

const DHARTI = patientRef('Dharti Galani');
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function renderLists() {
  const patient: PatientRecord = await clinicFixtures.patients.get(DHARTI);
  client.setQueryData<PatientFile>(patientFileQueryKeys.detail(DHARTI), {
    patient,
  } as PatientFile);
  return renderHook(() => useClinicalLists(patient), { wrapper });
}

const savedComplaints = async () =>
  (await clinicFixtures.patients.get(DHARTI)).complaints;

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('useClinicalLists (updatePatient, S:1640)', () => {
  it('reads each note as chips, one per line', async () => {
    const { result } = await renderLists();
    expect(result.current.items('complaints')).toEqual([
      'Tanning on face',
      'Uneven skin tone',
    ]);
    expect(result.current.items('futureSuggestions')).toEqual([
      'Hydrafacial after 4 weeks',
    ]);
  });

  it('adds a chip at once, marks it new and writes the whole note', async () => {
    const { result } = await renderLists();
    act(() => result.current.add('complaints', 'Dry patches'));
    expect(result.current.items('complaints')).toEqual([
      'Tanning on face',
      'Uneven skin tone',
      'Dry patches',
    ]);
    expect([...result.current.fresh('complaints')]).toEqual(['Dry patches']);
    await waitFor(async () =>
      expect(await savedComplaints()).toBe(
        'Tanning on face\nUneven skin tone\nDry patches',
      ),
    );
    expect(
      client.getQueryData<PatientFile>(patientFileQueryKeys.detail(DHARTI))?.patient
        .complaints,
    ).toBe('Tanning on face\nUneven skin tone\nDry patches');
  });

  it('adds a smart note’s chips at once — each list written once, a chip it holds skipped', async () => {
    const { result } = await renderLists();
    const added: number[] = [];
    act(() => {
      added.push(
        result.current.addAll([
          { field: 'complaints', text: 'Hair fall' },
          { field: 'complaints', text: 'tanning on face' },
          { field: 'complaints', text: 'hair fall' },
          { field: 'diagnosis', text: 'Melasma' },
        ]),
      );
    });
    expect(added).toEqual([2]);
    expect(result.current.items('complaints')).toEqual([
      'Tanning on face',
      'Uneven skin tone',
      'Hair fall',
    ]);
    expect([...result.current.fresh('complaints')]).toEqual(['Hair fall']);
    expect([...result.current.fresh('diagnosis')]).toEqual(['Melasma']);
    await waitFor(async () =>
      expect(await savedComplaints()).toBe(
        'Tanning on face\nUneven skin tone\nHair fall',
      ),
    );
    expect((await clinicFixtures.patients.get(DHARTI)).diagnosis).toBe(
      'Post-inflammatory hyperpigmentation\nMelasma',
    );
  });

  it('adds nothing when the note holds only chips the lists have', async () => {
    const { result } = await renderLists();
    const added: number[] = [];
    act(() => {
      added.push(
        result.current.addAll([{ field: 'complaints', text: 'UNEVEN SKIN TONE' }]),
      );
    });
    expect(added).toEqual([0]);
    expect(result.current.items('complaints')).toHaveLength(2);
  });

  it('removes a chip — the last one leaves no note', async () => {
    const { result } = await renderLists();
    act(() => result.current.remove('futureSuggestions', 'Hydrafacial after 4 weeks'));
    expect(result.current.items('futureSuggestions')).toEqual([]);
    await waitFor(async () =>
      expect((await clinicFixtures.patients.get(DHARTI)).futureSuggestions).toBeNull(),
    );
  });

  it('puts the chips back when the write is refused', async () => {
    const { result } = await renderLists();
    act(() => result.current.add('complaints', 'x'.repeat(4100)));
    expect(result.current.items('complaints')).toHaveLength(3);
    await waitFor(() => expect(result.current.items('complaints')).toHaveLength(2));
    expect(await savedComplaints()).toBe('Tanning on face\nUneven skin tone');
  });
});
